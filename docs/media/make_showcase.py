"""Rebuild the short montage from a user-supplied final film; never downloads media."""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import av
import numpy as np

CLIPS = [(0, 3), (12, 16), (66, 71.5), (97.5, 101), (119.5, 124), (144.5, 148)]

def main():
    p = argparse.ArgumentParser()
    p.add_argument('source', type=Path)
    p.add_argument('--output', type=Path, default=Path(__file__).parent / 'showcase.mp4')
    p.add_argument('--force', action='store_true')
    args = p.parse_args()
    if args.output.exists() and not args.force:
        p.error('Output exists; pass --force to replace deliberately.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out = av.open(str(args.output), 'w', options={'movflags': '+faststart'})
    vs = out.add_stream('libx264', rate=30)
    vs.width, vs.height, vs.pix_fmt = 1280, 720, 'yuv420p'
    vs.options = {'crf': '21', 'preset': 'medium'}
    vs.codec_context.thread_count = 4
    ast = out.add_stream('aac', rate=48000)
    ast.layout = 'stereo'
    ast.bit_rate = 192000
    count = 0
    for start, end in CLIPS:
        with av.open(str(args.source)) as source:
            stream = source.streams.video[0]
            source.seek(int(start / float(stream.time_base)), stream=stream, backward=True)
            wanted = round((end-start) * 30)
            emitted = 0
            for frame in source.decode(stream):
                time = float(frame.pts * frame.time_base)
                target = start + emitted / 30
                if time < target - 1e-5:
                    continue
                if emitted >= wanted or time >= end - 1e-5:
                    break
                frame = frame.reformat(width=1280, height=720, format='yuv420p')
                frame.pts, frame.time_base = count, Fraction(1, 30)
                for packet in vs.encode(frame):
                    out.mux(packet)
                count += 1
                emitted += 1
            if emitted != wanted:
                raise RuntimeError(f'Clip {start}-{end}: only {emitted}/{wanted} frames')
    for packet in vs.encode():
        out.mux(packet)

    # Decode one reference clock, then cut on the sample grid. 15 ms edge fades
    # remove editing clicks; they are not a claim of phrase-continuous music.
    blocks = []
    resampler = av.AudioResampler(format='fltp', layout='stereo', rate=48000)
    with av.open(str(args.source)) as source:
        for frame in source.decode(audio=0):
            blocks.extend(f.to_ndarray() for f in resampler.resample(frame))
        blocks.extend(f.to_ndarray() for f in resampler.resample(None))
    samples = np.concatenate(blocks, axis=1)
    edited = []
    for start, end in CLIPS:
        part = samples[:, round(start*48000):round(end*48000)].copy()
        n = min(720, part.shape[1]//2)
        ramp = np.linspace(0,1,n,dtype=np.float32)
        part[:,:n] *= ramp
        part[:,-n:] *= ramp[::-1]
        edited.append(part)
    mixed = np.concatenate(edited, axis=1)
    for i in range(0,mixed.shape[1],1024):
        f = av.AudioFrame.from_ndarray(np.ascontiguousarray(mixed[:,i:i+1024]), format='fltp', layout='stereo')
        f.sample_rate, f.pts, f.time_base = 48000, i, Fraction(1,48000)
        for packet in ast.encode(f):
            out.mux(packet)
    for packet in ast.encode():
        out.mux(packet)
    out.close()
    with av.open(str(args.source)) as source:
        stream = source.streams.video[0]
        source.seek(int(14 / float(stream.time_base)), stream=stream)
        for frame in source.decode(stream):
            if float(frame.pts*frame.time_base)>=14:
                frame.to_image().resize((1280,720)).save(args.output.parent/'poster.jpg', quality=92)
                break
    report = {'source_filename': args.source.name, 'source_sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
      'clips_seconds_start_inclusive_end_exclusive': CLIPS, 'duration_seconds': 24,
      'frames': count, 'fps': 30, 'width': 1280, 'height': 720, 'audio': 'source audio with 15 ms edge fades at cuts',
      'output_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}
    (args.output.parent/'showcase-edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

if __name__ == '__main__':
    main()
