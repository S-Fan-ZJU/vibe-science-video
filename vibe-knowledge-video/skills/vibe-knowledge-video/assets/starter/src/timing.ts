// Seconds are authoritative; a change of fps must preserve semantic timings.
export const TIMING = {
  firstInsert: 1.35, firstTurn: 2.40,
  secondInsert: 4.20, secondTurn: 5.40,
  anticipation: 6.80,
  // This is the FIRST VISIBLE activation, not the start of its easing.
  activation: 7.20,
  transition: 9.10,
  title: 9.65,
} as const;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (v: number) => {const x=clamp(v); return x*x*(3-2*x);};
export const easeOut = (v: number) => 1-Math.pow(1-clamp(v), 3);
