#!/usr/bin/env python3
"""Validate a frame-based storyboard; reading-speed flags require human judgement."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import sys

from _common import write_json


def is_number(value):
    return not isinstance(value, bool) and isinstance(value, (float, int)) and math.isfinite(value)


def is_frame(value):
    return isinstance(value, int) and not isinstance(value, bool)


def validate(data, max_cps=6.0, max_dwell=6.0, min_dwell=.8, music_analysis=None):
    findings = []
    metrics = {"captions": [], "events": []}
    def add(level, code, item, detail):
        findings.append({"level": level, "code": code, "item": item, "detail": detail})
    if not isinstance(data, dict):
        add("FAIL", "schema", "timeline", "Timeline must be a JSON object.")
        return findings, metrics
    fps, duration = data.get("fps"), data.get("duration_frames")
    if not is_frame(data.get("schema_version")) or data.get("schema_version") != 1:
        add("FAIL", "schema_version", "timeline", "schema_version must be 1.")
    if not is_number(fps) or fps <= 0:
        add("FAIL", "fps", "timeline", "fps must be a finite positive number.")
    if not is_frame(duration) or duration <= 0:
        add("FAIL", "duration", "timeline", "duration_frames must be a positive integer.")
    if any(x["code"] in ("fps", "duration") for x in findings):
        return findings, metrics
    metrics["duration_seconds"] = round(duration/fps, 6)
    captions, events = data.get("captions"), data.get("events")
    if not isinstance(captions, list):
        add("FAIL", "captions", "timeline", "captions must be an array.")
        captions = []
    if not isinstance(events, list):
        add("FAIL", "events", "timeline", "events must be an array.")
        events = []
    if not captions:
        add("WARN", "no_captions", "timeline", "No captions supplied; confirm this is intentional.")
    if not events:
        add("WARN", "no_events", "timeline", "No visible/audio event pairs supplied; sync has not been assessed.")
    seen_ids = set()
    valid_spans = []
    for i, caption in enumerate(captions):
        item = str(caption.get("id", f"caption[{i}]")) if isinstance(caption, dict) else f"caption[{i}]"
        if not isinstance(caption, dict):
            add("FAIL", "caption_type", item, "Caption must be an object.")
            continue
        if not isinstance(caption.get("id"), str) or not caption["id"].strip():
            add("FAIL", "missing_id", item, "A nonempty string id is required.")
        elif caption["id"] in seen_ids:
            add("FAIL", "duplicate_id", item, "IDs must be unique across captions and events.")
        else:
            seen_ids.add(caption["id"])
        start, end, text = caption.get("start_frame"), caption.get("end_frame"), caption.get("text")
        if not (is_frame(start) and is_frame(end) and 0 <= start < end <= duration):
            add("FAIL", "caption_range", item, "Use integer frames 0 <= start_frame < end_frame <= duration_frames; end is exclusive.")
            continue
        if not isinstance(text, str) or not text.strip():
            add("FAIL", "caption_text", item, "Caption text must be a nonempty string.")
            continue
        dwell = (end-start)/fps
        # Diagnostic only: Unicode letters/numbers, excluding spaces/punctuation.
        count = sum(1 for char in text if char.isalnum())
        cps = count/dwell
        metrics["captions"].append({"id": item, "dwell_seconds": round(dwell, 4),
            "letters_and_numbers": count, "characters_per_second": round(cps, 4)})
        valid_spans.append((start, end, item))
        if cps > max_cps:
            add("WARN", "fast_reading", item, f"{cps:.2f} letters/numbers per second exceeds diagnostic threshold {max_cps:g}; inspect actual reading load.")
        if dwell > max_dwell:
            add("WARN", "long_dwell", item, f"Visible for {dwell:.2f}s; check whether the image continues to explain something.")
        if dwell < min_dwell:
            add("WARN", "short_dwell", item, f"Visible for {dwell:.2f}s; check legibility at delivery size.")
    # Covers nested overlaps as well as adjacent ones.
    active = []
    for start, end, item in sorted(valid_spans):
        active = [(a_end, a_id) for a_end, a_id in active if a_end > start]
        for _, other_id in active:
            add("FAIL", "caption_overlap", item, f"Overlaps {other_id}; this schema represents a single primary subtitle lane. Put labels in scene data.")
        active.append((end, item))
    for i, event in enumerate(events):
        item = str(event.get("id", f"event[{i}]")) if isinstance(event, dict) else f"event[{i}]"
        if not isinstance(event, dict):
            add("FAIL", "event_type", item, "Event must be an object.")
            continue
        if not isinstance(event.get("id"), str) or not event["id"].strip():
            add("FAIL", "missing_id", item, "A nonempty string id is required.")
        elif event["id"] in seen_ids:
            add("FAIL", "duplicate_id", item, "IDs must be unique across captions and events.")
        else:
            seen_ids.add(event["id"])
        fields = ("animation_start_frame", "visible_peak_frame", "audio_peak_frame")
        if any(not is_frame(event.get(k)) or not 0 <= event[k] < duration for k in fields):
            add("FAIL", "event_range", item, "All three event frames must be integers in [0, duration_frames).")
            continue
        tolerance = event.get("tolerance_frames", 2)
        if not is_frame(tolerance) or tolerance < 0:
            add("FAIL", "event_tolerance", item, "tolerance_frames must be a nonnegative integer.")
            continue
        start, visible, sound = (event[k] for k in fields)
        if start > visible:
            add("FAIL", "event_order", item, "Animation starts after its visible result.")
        delta = visible-sound
        metrics["events"].append({"id": item, "visual_minus_audio_frames": delta,
            "visual_minus_audio_ms": round(1000*delta/fps, 3),
            "animation_lead_frames": visible-start})
        if abs(delta) > tolerance:
            add("FAIL", "event_sync", item, f"Visible result is {delta:+d} frames from audio peak; tolerance is {tolerance}. Align the visible contact/reveal, not the easing start.")
    music = data.get("music")
    if music is not None and not isinstance(music, dict):
        add("FAIL", "music_type", "music", "Optional music field must be an object.")
    elif isinstance(music, dict) and "sha256" in music:
        if not isinstance(music["sha256"], str) or re.fullmatch(r"[0-9a-f]{64}", music["sha256"]) is None:
            add("FAIL", "music_hash", "music", "music.sha256 must contain the 64 lowercase hexadecimal characters from the analysis report.")
    if music_analysis is not None:
        expected = music.get("sha256") if isinstance(music, dict) else None
        source = music_analysis.get("source") if isinstance(music_analysis, dict) else None
        actual = source.get("sha256") if isinstance(source, dict) else None
        if not expected:
            add("WARN", "music_unbound", "music", "Timeline has no music.sha256; cue positions are not bound to a particular edited track.")
        elif not actual or actual != expected:
            add("FAIL", "music_changed", "music", "Music SHA-256 differs or analysis has no hash; analyze the final edit and rebuild cues.")
    return findings, metrics


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--music-analysis", type=Path)
    parser.add_argument("--max-cps", type=float, default=6)
    parser.add_argument("--max-dwell", type=float, default=6)
    parser.add_argument("--min-dwell", type=float, default=.8)
    parser.add_argument("--warnings-as-errors", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.input.resolve() == args.output.resolve():
            raise ValueError("Output must differ from input.")
        if args.music_analysis and args.music_analysis.resolve() == args.output.resolve():
            raise ValueError("Output must differ from the music analysis input.")
        if not all(math.isfinite(v) and v > 0 for v in (args.max_cps, args.max_dwell, args.min_dwell)) or args.min_dwell > args.max_dwell:
            raise ValueError("Thresholds must be finite positive numbers with min-dwell <= max-dwell.")
        data = json.loads(args.input.read_text(encoding="utf-8-sig"))
        analysis = json.loads(args.music_analysis.read_text(encoding="utf-8-sig")) if args.music_analysis else None
        findings, metrics = validate(data, args.max_cps, args.max_dwell, args.min_dwell, analysis)
        failed = any(x["level"] == "FAIL" for x in findings)
        warned = any(x["level"] == "WARN" for x in findings)
        status = "FAIL" if failed else "WARN" if warned else "PASS"
        write_json(args.output, {"schema_version": 1, "status": status,
            "scope": "Authored timeline only; does not inspect rendered pixels or listen to audio.",
            "reading_metric": "Unicode letters/numbers per second; default threshold targets short Chinese subtitles, not all languages.",
            "thresholds": {"max_cps": args.max_cps, "max_dwell_seconds": args.max_dwell, "min_dwell_seconds": args.min_dwell},
            "findings": findings, "metrics": metrics}, args.force)
        print(json.dumps({"status": status, "failures": sum(x["level"] == "FAIL" for x in findings),
                          "warnings": sum(x["level"] == "WARN" for x in findings), "output": args.output.name}))
        return 2 if failed or (warned and args.warnings_as_errors) else 0
    except (OSError, ValueError, TypeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
