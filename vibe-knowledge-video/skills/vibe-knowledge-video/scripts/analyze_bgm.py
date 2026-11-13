#!/usr/bin/env python3
"""Estimate local audio rhythm/energy. Transient candidates are NOT verified beats."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from _common import check_output, sha256_file, write_json


def decode_audio(path, rate, max_seconds):
    import av
    import numpy as np

    chunks = []
    count = 0
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError("Input has no audio stream.")
        stream = container.streams.audio[0]
        info = {"codec": stream.codec_context.name,
                "source_sample_rate": stream.codec_context.sample_rate,
                "source_channels": stream.codec_context.channels}
        resampler = av.AudioResampler(format="fltp", layout="mono", rate=rate)
        for frame in container.decode(stream):
            for result in resampler.resample(frame):
                chunk = result.to_ndarray().reshape(-1)
                count += len(chunk)
                if count > max_seconds * rate:
                    raise ValueError(f"Audio exceeds --max-seconds {max_seconds}; explicitly raise the limit.")
                chunks.append(chunk)
        for result in resampler.resample(None):
            chunks.append(result.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError("Audio stream decoded no samples.")
    y = np.concatenate(chunks).astype(np.float32, copy=False)
    if len(y) < rate:
        raise ValueError("Need at least one second of audio for rhythm analysis.")
    if not np.all(np.isfinite(y)):
        raise ValueError("Decoded audio contains non-finite samples.")
    return y, info


def tempo_candidates(envelope, frame_rate, min_bpm, max_bpm):
    import numpy as np
    from scipy import signal

    if len(envelope) < 8 or float(np.max(envelope)) < 1e-9:
        return []
    centered = np.maximum(envelope - np.mean(envelope), 0)
    ac = signal.correlate(centered, centered, method="fft", mode="full")[len(centered)-1:]
    ac /= np.arange(len(ac), 0, -1)
    lo = max(1, int(frame_rate * 60 / max_bpm))
    hi = min(len(ac)-1, int(frame_rate * 60 / min_bpm) + 1)
    if hi <= lo:
        return []
    peaks, _ = signal.find_peaks(ac[lo:hi+1])
    peaks = [int(p + lo) for p in peaks]
    if not peaks:
        peaks = [int(lo + np.argmax(ac[lo:hi+1]))]
    ordered = sorted(peaks, key=lambda p: float(ac[p]), reverse=True)[:6]
    best = max(float(ac[p]) for p in ordered)
    if best <= 1e-12:
        return []
    result = []
    for p in ordered:
        denominator = ac[p-1] - 2 * ac[p] + ac[p+1] if p + 1 < len(ac) else 0
        offset = 0.5 * (ac[p-1] - ac[p+1]) / denominator if abs(denominator) > 1e-12 else 0
        offset = float(np.clip(offset, -0.5, 0.5))
        bpm = 60 * frame_rate / (p + offset)
        if min_bpm <= bpm <= max_bpm:
            result.append({"bpm": round(bpm, 3), "relative_score": round(float(ac[p]) / best, 4)})
    return result


def analyze(y, rate, min_bpm=45, max_bpm=200):
    import numpy as np
    from scipy import signal

    fft, hop = 2048, 256
    frequencies, times, spectrum = signal.stft(y, fs=rate, nperseg=fft,
        noverlap=fft-hop, boundary="zeros", padded=True)
    magnitude = np.abs(spectrum)
    log_magnitude = np.log1p(magnitude * 1000)
    full_flux = np.mean(np.maximum(np.diff(log_magnitude, axis=1, prepend=log_magnitude[:, :1]), 0), axis=0)
    low_bins = (frequencies >= 30) & (frequencies <= 200)
    low_flux = np.mean(np.maximum(np.diff(log_magnitude[low_bins], axis=1,
                    prepend=log_magnitude[low_bins, :1]), 0), axis=0)
    def scale(values):
        return values / max(float(np.percentile(values, 98)), 1e-9)
    envelope = 0.7 * scale(full_flux) + 0.3 * scale(low_flux)
    duration = len(y) / rate
    usable = times < duration
    times, envelope = times[usable], envelope[usable]
    if float(np.max(np.abs(y))) < 1e-7:
        envelope[:] = 0
    frame_rate = rate / hop
    peaks, properties = signal.find_peaks(envelope,
        distance=max(1, int(.12 * frame_rate)),
        prominence=max(.15, float(np.percentile(envelope, 75)) * .35))
    onset_candidates = [{"time_seconds": round(float(times[p]), 6),
                         "strength": round(float(envelope[p]), 5),
                         "prominence": round(float(prom), 5)}
                        for p, prom in zip(peaks, properties["prominences"])]
    energy = []
    step = .25
    for start in np.arange(0, duration, step):
        segment = y[int(start*rate):min(len(y), int((start+step)*rate))]
        rms = float(np.sqrt(np.mean(segment.astype(np.float64)**2)))
        energy.append({"start_seconds": round(float(start), 3),
                       "end_seconds": round(min(float(start+step), duration), 6),
                       "rms_dbfs": round(20 * np.log10(max(rms, 1e-9)), 3)})
    db = np.array([item["rms_dbfs"] for item in energy])
    changes = np.zeros(len(db))
    for i in range(8, len(db)-8):
        changes[i] = np.mean(db[i:i+8]) - np.mean(db[i-8:i])
    change_ids, _ = signal.find_peaks(np.abs(changes), distance=24, prominence=2)
    sections = [{"time_seconds": round(float(i*step), 3),
                 "delta_db": round(float(changes[i]), 3),
                 "kind": "rise" if changes[i] > 0 else "fall"} for i in change_ids]
    local_tempos = []
    for start in np.arange(0, max(duration-10, 1), 20):
        end = min(float(start+30), duration)
        selected = (times >= start) & (times < end)
        local_tempos.append({"start_seconds": float(start), "end_seconds": round(end, 6),
            "candidates": tempo_candidates(envelope[selected], frame_rate, min_bpm, max_bpm)})
    active = np.flatnonzero(np.abs(y) > 10**(-50/20))
    return {"decoded_duration_seconds": round(duration, 6),
            "analysis_sample_rate": rate,
            "analysis_hop_seconds": round(hop/rate, 8),
            "analysis_window_seconds": round(fft/rate, 8),
            "mono_sample_peak_dbfs": round(20*np.log10(max(float(np.max(np.abs(y))), 1e-9)), 3),
            "last_sample_above_minus50db_seconds": round(float(active[-1]/rate), 6) if len(active) else None,
            "tempo_candidates": tempo_candidates(envelope, frame_rate, min_bpm, max_bpm),
            "local_tempo_candidates": local_tempos,
            "onset_candidates": onset_candidates, "energy_windows": energy,
            "energy_change_candidates": sections}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sample-rate", type=int, default=22050)
    parser.add_argument("--min-bpm", type=float, default=45)
    parser.add_argument("--max-bpm", type=float, default=200)
    parser.add_argument("--max-seconds", type=float, default=1800)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    try:
        if not args.input.is_file():
            raise ValueError("Input file does not exist.")
        if args.input.resolve() == args.output.resolve():
            raise ValueError("Output must differ from the input.")
        if not 8000 <= args.sample_rate <= 48000:
            raise ValueError("--sample-rate must be between 8000 and 48000.")
        if not 20 <= args.min_bpm < args.max_bpm <= 400 or args.max_seconds <= 0:
            raise ValueError("Use 20 <= min-bpm < max-bpm <= 400 and a positive max-seconds.")
        check_output(args.output, args.force)
        y, info = decode_audio(args.input, args.sample_rate, args.max_seconds)
        report = {"schema_version": 1, "kind": "estimated-audio-analysis",
                  "source": {"file_name": args.input.name, "sha256": sha256_file(args.input),
                             "bytes": args.input.stat().st_size, **info},
                  "limitations": ["Onsets are transient candidates, not identified drums or verified beats.",
                    "Tempo scores are relative periodicity scores, not probabilities; half/double tempo ambiguity remains.",
                    "The analysis window smears transients. Listen and inspect waveform before selecting the exact frame.",
                    "Energy changes are suggestions, not automatically labeled musical phrases.",
                    "Mono sample peak is not stereo sample peak, true peak, or integrated loudness.",
                    "Analyze the final edited music again after any trim, loop, crossfade, speed or gain-envelope change."],
                  **analyze(y, args.sample_rate, args.min_bpm, args.max_bpm)}
        write_json(args.output, report, args.force)
        print(json.dumps({"output": args.output.name, "duration_seconds": report["decoded_duration_seconds"],
                          "tempo_candidates": report["tempo_candidates"],
                          "onset_count": len(report["onset_candidates"])}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, ImportError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        print(f"ERROR: audio analysis failed ({type(error).__name__}): {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
