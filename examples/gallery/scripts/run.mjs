import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const [mode,...input]=process.argv.slice(2);
if(!['studio','render','still'].includes(mode))throw Error('Usage: node scripts/run.mjs studio|render|still [PrismReveal|NoiseCancellation|DominoEnergy] [--frame=540] [other Remotion options]');
const composition=input[0]&&!input[0].startsWith('--')?input.shift():'PrismReveal';
if(!['PrismReveal','NoiseCancellation','DominoEnergy'].includes(composition))throw Error(`Unknown composition: ${composition}`);
const extra=[...input];
if(extra.some(arg=>arg==='--output'||arg.startsWith('--output=')||arg==='--output-location'||arg.startsWith('--output-location=')))throw Error('Output paths are allocated automatically under a unique out/ directory.');
const configPath=path.join(root,'src/audio-config.json');
if(!fs.existsSync(configPath))throw Error('Run npm run setup first. Missing audio is never accepted as a successful silent render.');
const audio=JSON.parse(fs.readFileSync(configPath,'utf8'));
for(const asset of [audio.file,'audio/reveal.wav']){
  if(!asset||!fs.existsSync(path.join(root,'public',asset)))throw Error(`Missing audio asset: ${asset}. Re-run setup with --force.`);
}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const job=path.join(root,'out',`${stamp}-${composition}-${randomUUID().slice(0,8)}`);
if(mode!=='studio'){
  fs.mkdirSync(path.join(root,'out'),{recursive:true});
  fs.mkdirSync(job); // exclusive directory; never reuse a render destination
  console.log(`Output: ${job}`);
}else console.log(`Studio opens all gallery scenes; select ${composition} in the composition list.`);
const cli=path.join(path.dirname(require.resolve('@remotion/cli/package.json')),'remotion-cli.js');
const gl=process.env.REMOTION_GL?[`--gl=${process.env.REMOTION_GL}`]:[];
const stillFrame=extra.some(arg=>arg==='--frame'||arg.startsWith('--frame='))?[]:['--frame=540'];
const dimensions=['--width=1920','--height=1080','--fps=60'];
const args=mode==='studio'?['studio','src/index.ts',...extra]:mode==='still'?
  ['still','src/index.ts',composition,path.join(job,`${composition}.png`),...dimensions,...stillFrame,...gl,...extra]:
  ['render','src/index.ts',composition,path.join(job,`${composition}.mp4`),...dimensions,'--codec=h264','--crf=18','--pixel-format=yuv420p','--concurrency=2','--timeout=120000',...gl,...extra];
const result=spawnSync(process.execPath,[cli,...args],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
