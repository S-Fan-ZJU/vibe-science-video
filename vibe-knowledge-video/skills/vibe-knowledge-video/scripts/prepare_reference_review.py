"""Extract timestamped review frames/contact sheets without changing source media."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFont

from _common import sha256_file


def extract(source: Path, output: Path, *, interval=5.0, start=0.0, end=None,
            times=None, columns=3, per_page=12, font_path=None):
    source, output = source.expanduser().resolve(), output.expanduser().resolve()
    if output.exists():
        raise ValueError("Output directory exists; choose a new directory to preserve earlier reviews.")
    if not math.isfinite(interval) or interval <= 0 or columns < 1 or per_page < 1:
        raise ValueError("interval, columns and per-page must be positive and finite")
    if not math.isfinite(start) or start < 0 or (end is not None and (not math.isfinite(end) or end < start)):
        raise ValueError("Use finite times with 0 <= start <= end")
    # Pillow's bundled font makes the tool independent of host font paths.
    font = ImageFont.truetype(str(font_path), 20) if font_path else ImageFont.load_default(size=20)
    with av.open(str(source)) as container:
        if not container.streams.video:
            raise ValueError("Input has no video stream")
        stream = container.streams.video[0]
        duration = (float(stream.duration * stream.time_base) if stream.duration is not None
                    else container.duration / av.time_base if container.duration is not None else None)
        if duration is None or not math.isfinite(duration) or duration <= 0:
            raise ValueError("Input needs a known positive video duration")
        if times is not None:
            requested = sorted(set(times))
            if any(not math.isfinite(t) or not 0 <= t < duration for t in requested):
                raise ValueError("Each explicit sample time must be finite and inside [0, duration)")
        else:
            if start >= duration:
                raise ValueError("start must be inside the video duration")
            stop = min(end if end is not None else max(start, duration - .1),
                       math.nextafter(duration, 0.0))
            count = math.floor((stop-start)/interval)+1
            if count > 20000:
                raise ValueError("More than 20000 samples requested; narrow the range or increase interval")
            requested = [round(start+i*interval, 9) for i in range(count)]
            if requested and stop-requested[-1] > .01:
                requested.append(stop)
        if not requested or len(requested) > 20000:
            raise ValueError("Request between 1 and 20000 sample times")
        width, height = stream.codec_context.width, stream.codec_context.height
        if width <= 0 or height <= 0:
            raise ValueError("Input has invalid video dimensions")
        metadata = {
            "input": source.name, "source_sha256": sha256_file(source), "duration_seconds": duration,
            "width": width, "height": height,
            "fps": float(stream.average_rate) if stream.average_rate else None,
            "codec": stream.codec_context.name,
            "audio_streams": [{"codec": s.codec_context.name, "sample_rate": s.codec_context.sample_rate,
                               "channels": s.codec_context.channels} for s in container.streams.audio],
            "coverage_note": "Timestamped sampled frames only. Not a full playback or subjective audio review.",
            "samples": [], "contact_sheets": [],
        }
        output.mkdir(parents=True, exist_ok=False)
        frames_dir = output / "frames"
        frames_dir.mkdir()
        tile_width = 640 if width >= height else 360
        tile_height = round(tile_width*height/width)
        page = []

        def save_page():
            if not page:
                return
            sheet = Image.new("RGB", (tile_width*columns, (tile_height+32)*math.ceil(len(page)/columns)), "#101722")
            for index, tile in enumerate(page):
                sheet.paste(tile, ((index % columns)*tile_width, (index//columns)*(tile_height+32)))
            name = f"contact-{len(metadata['contact_sheets'])+1:02}.jpg"
            sheet.save(output/name, quality=94)
            metadata["contact_sheets"].append(name)
            page.clear()

        for index, sample_time in enumerate(requested):
            container.seek(int(sample_time/stream.time_base), stream=stream, backward=True)
            before = chosen = None
            for frame in container.decode(stream):
                if frame.time is None:
                    continue
                if frame.time >= sample_time:
                    chosen = before if before is not None and abs(before.time-sample_time) < abs(frame.time-sample_time) else frame
                    break
                before = frame
            chosen = chosen if chosen is not None else before
            if chosen is None:
                raise ValueError(f"No decodable frame near {sample_time:g}s; output is incomplete")
            actual = float(chosen.time)
            filename = f"frame-{index:05}-{sample_time:08.3f}s.jpg"
            picture = chosen.to_image().convert("RGB")
            picture.save(frames_dir/filename, quality=94)
            tile = Image.new("RGB", (tile_width, tile_height+32), "#101722")
            tile.paste(picture.resize((tile_width, tile_height), Image.Resampling.LANCZOS), (0, 32))
            ImageDraw.Draw(tile).text((10, 5), f"{actual:07.3f}s", font=font, fill="#ffffff")
            page.append(tile)
            metadata["samples"].append({"requested_seconds": sample_time, "actual_seconds": actual,
                                        "file": f"frames/{filename}"})
            if len(page) == per_page:
                save_page()
        save_page()
    (output/"extraction.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="New directory; existing reviews are never overwritten")
    parser.add_argument("--interval", type=float, default=5)
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--end", type=float)
    parser.add_argument("--times", help="Comma-separated sample times, seconds")
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--per-page", type=int, default=12)
    parser.add_argument("--font", type=Path, help="Optional local TrueType font; defaults to Pillow's bundled font")
    args = parser.parse_args()
    try:
        times = [float(t.strip()) for t in args.times.split(",")] if args.times is not None else None
        metadata = extract(args.input, args.output, interval=args.interval, start=args.start, end=args.end,
                           times=times, columns=args.columns, per_page=args.per_page, font_path=args.font)
    except (OSError, ValueError, av.error.FFmpegError) as error:
        parser.error(str(error))
    print(json.dumps({"source": metadata["input"], "duration": metadata["duration_seconds"],
                      "samples": len(metadata["samples"]), "sheets": metadata["contact_sheets"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
