import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {Input, BufferSource, ALL_FORMATS} from 'mediabunny';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const has=(v)=>args.includes(v);
const value=(v)=>{const i=args.indexOf(v); if(i<0)return undefined; if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`${v} requires a value`); return args[i+1];};
if(has('--help')){console.log('node scripts/setup.mjs [--bgm path] [--trim seconds] [--silent] [--force]\nDefault: bundled reference music. --bgm: copy custom music; --silent: deliberate silent laboratory.');process.exit(0);}
const known=new Set(['--bgm','--trim','--silent','--force']);
for(let i=0;i<args.length;i++){if(!known.has(args[i]))throw Error(`Unknown argument: ${args[i]}`); if(['--bgm','--trim'].includes(args[i]))i++;}
if(has('--bgm')&&has('--silent'))throw Error('Choose either --bgm or --silent.');
const configPath=path.join(root,'src/audio-config.json');
if(fs.existsSync(configPath)&&!has('--force'))throw Error('Audio configuration already exists. Use --force intentionally to replace it.');
const custom=value('--bgm'), silent=has('--silent');
const candidates=[path.resolve(root,'../music/reference-bgm.m4a'),path.resolve(root,'../assets/music/reference-bgm.m4a')];
const source=custom?path.resolve(custom):candidates.find(p=>fs.existsSync(p))??candidates[0];
const trim=Number(value('--trim')??(custom?0:5.533333333333333));
if(!Number.isFinite(trim)||trim<0)throw Error('--trim must be a nonnegative number.');
let config={silent,file:'',trimStartSeconds:trim,volume:.72,sourceSha256:null};
fs.mkdirSync(path.join(root,'public/audio'),{recursive:true});
if(!silent){
  if(!fs.existsSync(source))throw Error('Music not found. Keep assets/music next to starter, or use npm run setup -- --bgm "path/to/music.wav". Choose --silent only for an intentionally silent test.');
  const ext=path.extname(source).toLowerCase();
  if(!['.wav','.mp3','.m4a','.aac','.mp4','.ogg','.flac'].includes(ext))throw Error('Use wav, mp3, m4a, aac, mp4, ogg or flac.');
  const data=fs.readFileSync(source), dst=path.join(root,'public/audio',`bgm${ext}`);
  const media=new Input({source:new BufferSource(data),formats:ALL_FORMATS});
  const track=await media.getPrimaryAudioTrack();
  if(!track){media.dispose();throw Error('Selected file has no audio track.');}
  const duration=await track.computeDuration();
  media.dispose();
  if(!Number.isFinite(duration)||duration<trim+12-.04)throw Error(`Music is ${duration.toFixed(3)}s; this 12s laboratory needs at least ${(trim+12).toFixed(3)}s at the chosen trim. Extend/edit the music intentionally or choose a longer file. No silent tail is accepted.`);
  fs.writeFileSync(dst,data);
  config={...config,file:`audio/bgm${ext}`,sourceSha256:crypto.createHash('sha256').update(data).digest('hex')};
}
// Original synthesized notification. No downloaded sound-effect dependency.
const rate=48000,n=Math.round(.85*rate), pcm=Buffer.alloc(n*2);
for(let i=0;i<n;i++){
  const t=i/rate,envelope=Math.min(1,t/.004)*Math.exp(-t*7.2);
  const v=envelope*(Math.sin(2*Math.PI*880*t)+.38*Math.sin(2*Math.PI*1320*t)+.12*Math.sin(2*Math.PI*2640*t))*.32;
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),i*2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
fs.writeFileSync(path.join(root,'public/audio/activation.wav'),Buffer.concat([header,pcm]));
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
console.log(silent?'Ready: deliberately silent.':'Ready: BGM copied, cue bell generated.');
if(custom)console.log('Custom BGM selected: analyze this file and retime src/timing.ts before claiming beat alignment.');
console.log('Next: npm run check; npm run preview; npm run render');
