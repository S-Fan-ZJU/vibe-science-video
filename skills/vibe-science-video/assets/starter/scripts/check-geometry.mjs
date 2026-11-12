import assert from 'node:assert/strict';
import {dimensions as d} from '../src/geometry.mjs';
// Conservative box sweep bound, not a claim of general triangle collision checking.
const radius=Math.hypot(d.keyToothReach,d.keyBladeHalfThickness+.06);
assert(radius<d.boreInnerRadius,'The rotating blade would intersect the socket.');
assert(d.insertedTipZ<-d.boreHalfDepth,'The blade does not pass through the bore.');
assert(d.insertedBowZ-.065>d.boreHalfDepth,'The bow collides with the socket.');
console.log(JSON.stringify({check:'key-bore conservative sweep',clearance:d.boreInnerRadius-radius,pass:true},null,2));
