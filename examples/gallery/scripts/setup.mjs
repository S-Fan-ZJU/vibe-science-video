import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Input, BufferSource, ALL_FORMATS} from 'mediabunny';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const values=new Map();
for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--help'){
    console.log('node scripts/setup.mjs [--bgm "path/to/music"] [--trim seconds] [--force]\nDefault music trim: 8.8s. Custom music trim: 0s unless --trim is supplied. Re-analyze custom music before claiming beat alignment.');
    process.exit(0);
  }
  if(arg==='--force'){values.set(arg,true);continue;}
  if(!['--bgm','--trim'].includes(arg))throw Error(`Unknown argument: ${arg}`);
  const value=args[++i];
  if(!value||value.startsWith('--'))throw Error(`${arg} requires a value.`);
  values.set(arg,value);
}
const configPath=path.join(root,'src/audio-config.json');
if(fs.existsSync(configPath)&&!values.has('--force'))throw Error('Audio is already configured. Use --force to deliberately replace the copied music and cue.');
const custom=values.get('--bgm');
const source=custom?path.resolve(custom):path.resolve(root,'../../skills/vibe-science-video/assets/music/reference-bgm.m4a');
const trim=Number(values.get('--trim')??(custom?0:8.8));
if(!Number.isFinite(trim)||trim<0)throw Error('--trim must be a nonnegative number of seconds.');
if(!fs.existsSync(source))throw Error('Music not found. Keep the complete repository layout or run npm run setup -- --bgm "path/to/music.wav".');
const ext=path.extname(source).toLowerCase();
if(!['.wav','.mp3','.m4a','.aac','.mp4','.ogg','.flac'].includes(ext))throw Error('Supported music formats: wav, mp3, m4a, aac, mp4, ogg, flac.');
const data=fs.readFileSync(source);
const media=new Input({source:new BufferSource(data),formats:ALL_FORMATS});
let duration;
try{
  const track=await media.getPrimaryAudioTrack();
  if(!track)throw Error('Selected file has no audio track.');
  duration=await track.computeDuration();
}finally{media.dispose();}
if(!Number.isFinite(duration)||duration<trim+18-.025)throw Error(`Music is ${duration?.toFixed(3)}s; this 18s gallery needs at least ${(trim+18).toFixed(3)}s at the chosen trim. Extend the music deliberately or select a longer file.`);
const audioDir=path.join(root,'public/audio');
fs.mkdirSync(audioDir,{recursive:true});
fs.writeFileSync(path.join(audioDir,`bgm${ext}`),data);

// Original, deterministic two-note reveal: short bell transients over a bass
// impact. No downloaded SFX, random samples, or additional audio software.
const rate=48000,seconds=.92,count=Math.round(seconds*rate);
const samples=new Float64Array(count);
const bell=(t,hz)=>t<0?0:Math.min(1,t/.0025)*Math.exp(-t*8.8)*(
  Math.sin(2*Math.PI*hz*t)+.28*Math.sin(2*Math.PI*hz*2*t)+.11*Math.sin(2*Math.PI*hz*3.01*t));
let peak=0;
for(let i=0;i<count;i++){
  const t=i/rate;
  const bass=Math.min(1,t/.0018)*Math.exp(-t*19)*Math.sin(2*Math.PI*(46*t+(96-46)*.055*(1-Math.exp(-t/.055))));
  const end=Math.min(1,(seconds-t)/.045);
  const sample=(.52*bell(t,1046.502)+.46*bell(t-.115,783.991)+.48*bass)*end;
  samples[i]=sample;peak=Math.max(peak,Math.abs(sample));
}
const pcm=Buffer.alloc(count*2),gain=.88/Math.max(peak,.001);
for(let i=0;i<count;i++)pcm.writeInt16LE(Math.round(samples[i]*gain*32767),i*2);
const header=Buffer.alloc(44);
header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);
header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);
header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
fs.writeFileSync(path.join(audioDir,'reveal.wav'),Buffer.concat([header,pcm]));
const config={
  file:`audio/bgm${ext}`,trimStartSeconds:trim,volume:.26,cueVolume:.7,
  cueSeconds:8.4,durationSeconds:18,customMusic:Boolean(custom),
  sourceSha256:createHash('sha256').update(data).digest('hex'),
  defaultSourceOnsetSeconds:17.194376,
  defaultOnsetAfterTrimSeconds:8.394376,
  defaultVisualCueOffsetMilliseconds:5.624,
};
fs.mkdirSync(path.dirname(configPath),{recursive:true});
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
console.log(`Ready: ${duration.toFixed(3)}s music copied; trim ${trim}s; original 0.92s reveal cue generated.`);
console.log(custom?'Custom BGM: measure its beat and revise the visual/cue timing before claiming sync.':'Reference sync: source onset 17.194376s − trim 8.8s = 8.394376s; visual/SFX at 8.4s (5.624ms later).');
console.log('Next: npm run check; npm run preview; npm run render -- PrismReveal');
