import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
// The run wrapper reserves a unique output directory before invoking Remotion.
Config.setOverwriteOutput(true);
