import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const configPath=path.join(root,'src/audio-config.json');
if(!fs.existsSync(configPath))throw Error('Run npm run setup first. Missing music is never treated as a successful silent render.');
const audio=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(!audio.silent&&!fs.existsSync(path.join(root,'public',audio.file)))throw Error('Configured BGM is missing. Re-run setup with --force.');
const [mode,...extra]=process.argv.slice(2);
if(!['studio','render','still'].includes(mode))throw Error('Expected studio, render or still');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
fs.mkdirSync(path.join(root,'out'),{recursive:true});
const job=path.join(root,'out',`${stamp}-${randomUUID().slice(0,8)}`);
if(mode!=='studio')fs.mkdirSync(job); // exclusive directory; never reuse a destination
const pkg=path.dirname(require.resolve('@remotion/cli/package.json'));
const cli=path.join(pkg,'remotion-cli.js');
const rendererFlag=process.env.REMOTION_GL?[`--gl=${process.env.REMOTION_GL}`]:[];
const stillFrameFlag=extra.some(arg=>arg==='--frame'||arg.startsWith('--frame='))?[]:['--frame=432'];
const args=mode==='studio'?['studio','src/index.ts',...extra]:mode==='still'?
  ['still','src/index.ts','MotionLab',path.join(job,'still.png'),...stillFrameFlag,...rendererFlag,...extra]:
  ['render','src/index.ts','MotionLab',path.join(job,'motion-lab.mp4'),'--codec=h264','--crf=19','--pixel-format=yuv420p','--concurrency=2','--timeout=120000',...rendererFlag,...extra];
const result=spawnSync(process.execPath,[cli,...args],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
