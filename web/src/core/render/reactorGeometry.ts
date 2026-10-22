import { mm, roundedEnvelope, type Point } from "./featureGeometry";

export const REACTOR_DIAMETER = mm(10);
export const REACTOR_RADIUS = REACTOR_DIAMETER/2;
const dx = Math.sqrt(3)/2*REACTOR_DIAMETER;
export const REACTOR_CENTRES: Point[] = [
  ...Array.from({length:3},(_,i) => ({x:REACTOR_RADIUS,y:(i+1)*REACTOR_DIAMETER})),
  ...Array.from({length:4},(_,i) => ({x:REACTOR_RADIUS+dx,y:(i+0.5)*REACTOR_DIAMETER})),
];
export const REACTOR_HULL = [REACTOR_CENTRES[3],REACTOR_CENTRES[6],REACTOR_CENTRES[2],REACTOR_CENTRES[0]];
export const REACTOR_OUTLINE = roundedEnvelope(REACTOR_HULL,REACTOR_RADIUS);
export const REACTOR_WIDTH = dx+REACTOR_DIAMETER;
export const REACTOR_HEIGHT = 4*REACTOR_DIAMETER;
