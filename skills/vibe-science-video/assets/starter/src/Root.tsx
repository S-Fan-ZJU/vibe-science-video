import React from 'react';
import {Composition} from 'remotion';
import {MotionLab} from './Scene';

export const Root = () => <Composition
  id="MotionLab" component={MotionLab} width={1920} height={1080}
  fps={60} durationInFrames={720}
  defaultProps={{title: '两个条件，才有一个答案', subtitle: '用动作解释逻辑，用节奏揭晓答案。'}}
/>;
