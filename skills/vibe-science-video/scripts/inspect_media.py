#!/usr/bin/env python3
"""Fully decode an exported movie and optionally build a sampled contact sheet."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

from _common import check_output, sha256_file, write_json


def inspect(path, expected_fps=None, expected_width=None, expected_height=None,
            expected_duration=None, require_audio=True):
    import av
    import numpy as np

    findings = []
    def add(level, code, detail):
        findings.append({"level": level, "code": code, "detail": detail})
    with av.open(str(path)) as container:
        if not container.streams.video:
            raise ValueError("Input has no video stream.")
        video = container.streams.video[0]
        audio = container.streams.audio[0] if container.streams.audio else None
        header_fps = float(video.average_rate) if video.average_rate else None
        video_info = {"codec": video.codec_context.name, "width": video.codec_context.width,
                      "height": video.codec_context.height, "header_average_fps": header_fps,
                      "pixel_format": video.codec_context.format.name if video.codec_context.format else None}
        audio_info = {"present": audio is not None}
        if audio:
            audio_info.update(codec=audio.codec_context.name,
                              sample_rate=audio.codec_context.sample_rate,
                              channels=audio.codec_context.channels)
        if require_audio and audio is None:
            add("FAIL", "missing_audio", "No audio stream; use --allow-no-audio only for an intentionally silent export.")
        for name, expected in (("width", expected_width), ("height", expected_height)):
            if expected is not None and video_info[name] != expected:
                add("FAIL", name, f"Expected {expected}, got {video_info[name]}.")
        if expected_fps is not None and (header_fps is None or abs(header_fps-expected_fps) > .01):
            add("FAIL", "header_fps", f"Expected {expected_fps}, got {header_fps}.")
        frames, audio_frames, audio_samples = 0, 0, 0
        first_pts = last_pts = None
        first_audio_pts = last_audio_end = None
        missing_pts = nonmonotonic = off_cadence = 0
        audio_missing_pts = audio_backwards = 0
        last_audio_pts = None
        audio_peak = 0.0
        audio_clipped, total_channel_samples = 0, 0
        max_interval_error = 0.0
        min_interval = max_interval = None
        interval_target = 1/(expected_fps or header_fps) if (expected_fps or header_fps) else None
        selected = [video] + ([audio] if audio else [])
        for packet in container.demux(selected):
            for frame in packet.decode():
                if isinstance(frame, av.VideoFrame):
                    frames += 1
                    if frame.pts is None:
                        missing_pts += 1
                        continue
                    pts = float(frame.pts * frame.time_base)
                    if first_pts is None:
                        first_pts = pts
                    if last_pts is not None:
                        interval = pts-last_pts
                        if interval <= 0:
                            nonmonotonic += 1
                        min_interval = interval if min_interval is None else min(min_interval, interval)
                        max_interval = interval if max_interval is None else max(max_interval, interval)
                        if interval_target:
                            error = abs(interval-interval_target)
                            max_interval_error = max(max_interval_error, error)
                            if error > max(.0001, interval_target * .02):
                                off_cadence += 1
                    last_pts = pts
                elif isinstance(frame, av.AudioFrame):
                    audio_frames += 1
                    audio_samples += frame.samples
                    samples = frame.to_ndarray()
                    if np.issubdtype(samples.dtype, np.integer):
                        # Unsigned 8-bit PCM is centered at 128; signed PCM is centered at 0.
                        info = np.iinfo(samples.dtype)
                        if info.min == 0:
                            midpoint = (info.max+1)/2
                            samples = (samples.astype(np.float64)-midpoint)/midpoint
                        else:
                            samples = samples.astype(np.float64)/(-info.min)
                    else:
                        samples = samples.astype(np.float64, copy=False)
                    if not np.all(np.isfinite(samples)):
                        raise ValueError("Audio decoded non-finite sample values.")
                    if samples.size:
                        audio_peak = max(audio_peak, float(np.max(np.abs(samples))))
                        audio_clipped += int(np.count_nonzero(np.abs(samples) >= 1))
                        total_channel_samples += int(samples.size)
                    if frame.pts is None:
                        audio_missing_pts += 1
                    else:
                        pts = float(frame.pts * frame.time_base)
                        if first_audio_pts is None:
                            first_audio_pts = pts
                        if last_audio_pts is not None and pts <= last_audio_pts:
                            audio_backwards += 1
                        last_audio_pts = pts
                        last_audio_end = pts + frame.samples/frame.sample_rate
        if not frames:
            add("FAIL", "empty_video", "Video decoded zero frames.")
        if missing_pts or nonmonotonic:
            add("FAIL", "video_timestamps", f"Missing PTS: {missing_pts}; non-increasing PTS: {nonmonotonic}.")
        if off_cadence:
            add("FAIL" if expected_fps else "WARN", "video_cadence",
                f"{off_cadence} intervals depart from nominal frame spacing; max error {max_interval_error*1000:.3f}ms.")
        cadence = interval_target or max_interval or 0
        video_duration = last_pts-first_pts+cadence if last_pts is not None else 0
        if expected_duration is not None and abs(video_duration-expected_duration) > max(cadence*1.1, .025):
            add("FAIL", "duration", f"Expected {expected_duration:.6f}s, decoded video {video_duration:.6f}s.")
        if expected_duration is not None and expected_fps is not None:
            expected_frames = round(expected_duration * expected_fps)
            if frames != expected_frames:
                add("FAIL", "frame_count", f"Expected {expected_frames} frames, decoded {frames}.")
        if audio:
            if not audio_frames:
                add("FAIL", "empty_audio", "Audio stream decoded zero frames.")
            if audio_missing_pts or audio_backwards:
                add("FAIL", "audio_timestamps", f"Missing PTS: {audio_missing_pts}; non-increasing PTS: {audio_backwards}.")
            if total_channel_samples and audio_peak < 1e-6:
                add("WARN", "silent_audio", "Audio track is effectively silent.")
            if audio_clipped:
                add("WARN", "sample_clipping", f"{audio_clipped} decoded channel samples are at or above full scale.")
            if first_audio_pts is not None and first_pts is not None:
                start_delta = first_audio_pts-first_pts
                end_delta = last_audio_end-(last_pts+cadence)
                # Tolerate ordinary encoder delay/padding, not creative sync errors.
                if abs(start_delta) > .1 or abs(end_delta) > .1:
                    add("WARN", "stream_extent", f"Audio-video stream extent difference: start {start_delta:+.3f}s, end {end_delta:+.3f}s. This does not measure perceptual beat alignment.")
                audio_info.update(start_minus_video_seconds=round(start_delta, 6),
                                  end_minus_video_seconds=round(end_delta, 6))
            audio_info.update(decoded_frames=audio_frames, decoded_samples_per_channel=audio_samples,
                first_pts_seconds=first_audio_pts, end_pts_seconds=last_audio_end,
                sample_peak_dbfs=round(20*math.log10(max(audio_peak, 1e-9)), 4),
                samples_at_or_above_full_scale=audio_clipped,
                peak_scope="Decoded sample peak; not oversampled true peak or integrated loudness.")
        video_info.update(decoded_frames=frames, first_pts_seconds=first_pts,
            last_pts_seconds=last_pts, decoded_duration_seconds=round(video_duration, 6),
            missing_pts=missing_pts, non_increasing_pts=nonmonotonic,
            intervals_off_nominal=off_cadence, max_interval_error_seconds=round(max_interval_error, 9))
    status = "FAIL" if any(x["level"] == "FAIL" for x in findings) else "WARN" if findings else "PASS"
    return {"schema_version": 1, "status": status, "decode_complete": True,
        "source": {"file_name": path.name, "bytes": path.stat().st_size, "sha256": sha256_file(path)},
        "video": video_info, "audio": audio_info, "findings": findings,
        "limitations": ["Checks the first video stream and first audio stream only.",
            "Full decode cannot prove visual correctness, geometry clearance, legibility or scientific accuracy.",
            "PTS checks do not establish that a visible event hits a musical transient.",
            "A decoder may conceal damaged frames without raising an exception."]}


def contact_sheet(path, output, duration, first_pts, count):
    import av
    from PIL import Image, ImageDraw

    columns = min(4, count)
    width, height, label_height = 400, 225, 28
    rows = math.ceil(count/columns)
    sheet = Image.new("RGB", (columns*width, rows*(height+label_height)), "#101722")
    draw = ImageDraw.Draw(sheet)
    samples = []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        for i in range(count):
            relative_time = duration*(i+.5)/count
            absolute_time = (first_pts or 0)+relative_time
            container.seek(int(absolute_time/float(stream.time_base)), stream=stream, backward=True)
            chosen = None
            for frame in container.decode(stream):
                chosen = frame
                if frame.pts is not None and float(frame.pts*frame.time_base) >= absolute_time:
                    break
            if chosen is None:
                continue
            actual_time = float(chosen.pts*chosen.time_base)-(first_pts or 0) if chosen.pts is not None else relative_time
            tile = chosen.to_image().convert("RGB")
            tile.thumbnail((width, height), Image.Resampling.LANCZOS)
            x, y = (i % columns)*width, (i//columns)*(height+label_height)
            sheet.paste(tile, (x+(width-tile.width)//2, y+(height-tile.height)//2))
            draw.text((x+10, y+height+5), f"{actual_time:.3f}s", fill="white")
            samples.append(round(actual_time, 6))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    return samples


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fps", type=float)
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--duration", type=float)
    parser.add_argument("--allow-no-audio", action="store_true")
    parser.add_argument("--contact-sheet", type=Path)
    parser.add_argument("--contact-count", type=int, default=12)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    try:
        if not args.input.is_file():
            raise ValueError("Input file does not exist.")
        paths = [args.input.resolve(), args.output.resolve()]
        if args.contact_sheet:
            paths.append(args.contact_sheet.resolve())
        if len(paths) != len(set(paths)):
            raise ValueError("Input, JSON report and contact sheet must have different paths.")
        for value in (args.fps, args.width, args.height, args.duration):
            if value is not None and (not math.isfinite(value) or value <= 0):
                raise ValueError("Expected fps, dimensions and duration must be positive finite numbers.")
        if not 1 <= args.contact_count <= 48:
            raise ValueError("--contact-count must be in [1, 48].")
        check_output(args.output, args.force)
        if args.contact_sheet:
            check_output(args.contact_sheet, args.force)
        report = inspect(args.input, args.fps, args.width, args.height, args.duration, not args.allow_no_audio)
        if args.contact_sheet:
            samples = contact_sheet(args.input, args.contact_sheet,
                report["video"]["decoded_duration_seconds"], report["video"]["first_pts_seconds"], args.contact_count)
            report["contact_sheet"] = {"file_name": args.contact_sheet.name,
                "sample_times_seconds": samples, "scope": "Sampled stills only; not full subjective playback."}
        write_json(args.output, report, args.force)
        print(json.dumps({"status": report["status"], "frames": report["video"]["decoded_frames"],
            "duration_seconds": report["video"]["decoded_duration_seconds"], "output": args.output.name}))
        return 2 if report["status"] == "FAIL" else 0
    except Exception as error:
        print(f"ERROR: media inspection failed ({type(error).__name__}): {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
