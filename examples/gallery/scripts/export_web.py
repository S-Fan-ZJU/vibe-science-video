"""Encode a small web copy, preserving all frames and the original AAC audio."""
import argparse
from fractions import Fraction
from pathlib import Path
import av

def main():
    p=argparse.ArgumentParser()
    p.add_argument('source',type=Path)
    p.add_argument('output',type=Path)
    p.add_argument('--poster-frame',type=int,default=540)
    args=p.parse_args()
    if args.output.exists():
        p.error('Output already exists. Choose a new destination to preserve the previous render.')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with av.open(str(args.source)) as source, av.open(str(args.output),'w',options={'movflags':'+faststart'}) as target:
        vin=source.streams.video[0]
        fps=vin.average_rate
        vout=target.add_stream('libx264',rate=fps)
        vout.width,vout.height,vout.pix_fmt=1280,720,'yuv420p'
        vout.options={'crf':'20','preset':'medium'}
        vout.codec_context.thread_count=4
        ain=source.streams.audio[0] if source.streams.audio else None
        if ain is None:
            raise ValueError('The showcase must contain the verified soundtrack.')
        aout=target.add_stream_from_template(ain)
        frames=0
        for packet in source.demux(vin,ain):
            if packet.stream==ain:
                if packet.dts is not None:
                    packet.stream=aout
                    target.mux(packet)
            else:
                for frame in packet.decode():
                    if frames==args.poster_frame:
                        frame.to_image().resize((1280,720)).save(args.output.with_suffix('.jpg'),quality=94)
                    frame=frame.reformat(width=1280,height=720,format='yuv420p')
                    frame.pts,frame.time_base=frames,Fraction(1,fps)
                    for encoded in vout.encode(frame): target.mux(encoded)
                    frames+=1
        for encoded in vout.encode(): target.mux(encoded)
    print(f'{args.output.name}: {frames} frames, {fps} fps, 1280x720; original audio copied')

if __name__=='__main__': main()
