import React from 'react';
import {Composition} from 'remotion';
import {Prism} from './Prism';
import {Noise} from './Noise';
import {Domino} from './Domino';
import {Score} from './Score';
const PrismFilm=()=> <><Prism/><Score/></>;
const NoiseFilm=()=> <><Noise/><Score/></>;
const DominoFilm=()=> <><Domino/><Score/></>;
export const GalleryRoot=()=> <>
  <Composition id="PrismReveal" component={PrismFilm} width={1920} height={1080} fps={60} durationInFrames={1080}/>
  <Composition id="NoiseCancellation" component={NoiseFilm} width={1920} height={1080} fps={60} durationInFrames={1080}/>
  <Composition id="DominoEnergy" component={DominoFilm} width={1920} height={1080} fps={60} durationInFrames={1080}/>
</>;
