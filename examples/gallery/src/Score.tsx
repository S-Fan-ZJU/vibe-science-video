import React from 'react';
import {Audio} from '@remotion/media';
import {staticFile, useVideoConfig} from 'remotion';
import audio from './audio-config.json';

const clamp=(value:number)=>Math.min(1,Math.max(0,value));
const smooth=(value:number)=>{const x=clamp(value);return x*x*(3-2*x);};

/** Shared score. No narration. Default onset 17.194376 − 8.8 = 8.394376s. */
export const Score:React.FC=()=>{
  const {fps,durationInFrames}=useVideoConfig();
  const duration=durationInFrames/fps;
  return <>
    <Audio name="Reference score" src={staticFile(audio.file)} trimBefore={Math.round(audio.trimStartSeconds*fps)}
      volume={(frame)=>{
        const t=frame/fps;
        const fadeIn=smooth(t/.12),fadeOut=smooth((duration-t)/.65);
        // Brief gentle duck keeps the reveal readable without muting the beat.
        const down=smooth((t-(audio.cueSeconds-.065))/.065);
        const recovery=smooth((t-(audio.cueSeconds+.18))/.32);
        const duck=1-.52*down*(1-recovery);
        return audio.volume*fadeIn*fadeOut*duck;
      }}/>
    <Audio name="Original reveal ding-dong and impact" src={staticFile('audio/reveal.wav')}
      from={Math.round(audio.cueSeconds*fps)} volume={audio.cueVolume}/>
  </>;
};
