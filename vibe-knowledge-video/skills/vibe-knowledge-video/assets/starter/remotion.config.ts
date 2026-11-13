import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
// run.mjs creates an exclusive new job directory before each export. On volumes
// without hard-link support this uses rename, avoiding the no-overwrite faststart
// hard-link path. Use the wrapper to preserve earlier outputs automatically.
Config.setOverwriteOutput(true);
