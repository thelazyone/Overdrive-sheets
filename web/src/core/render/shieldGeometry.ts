import { mm, polygonUnionPath, type Point } from "./featureGeometry";

// Explicit revised construction: 5.2 mm sides (9.0067 mm across flats),
// vertical left/right edges, five left centres and four staggered right centres.
export const SHIELD_RADIUS = mm(5.2);
export const SHIELD_FLATS = Math.sqrt(3)*SHIELD_RADIUS;
export const SHIELD_VERTICAL_PITCH = mm(9.5);
export const SHIELD_COLUMN_OFFSET = mm(4);
export const SHIELD_CENTRES: Point[] = Array.from({length:9},(_,i) => ({
  x: SHIELD_FLATS/2 + (i%2)*SHIELD_COLUMN_OFFSET,
  y: SHIELD_RADIUS + i*SHIELD_VERTICAL_PITCH/2,
}));
export const SHIELD_HEXES = SHIELD_CENTRES.map(c => Array.from({length:6},(_,i) => ({
  x:c.x+Math.cos(Math.PI/6+i*Math.PI/3)*SHIELD_RADIUS,
  y:c.y+Math.sin(Math.PI/6+i*Math.PI/3)*SHIELD_RADIUS,
})));
export const SHIELD_OUTLINE = polygonUnionPath(SHIELD_HEXES);
export const SHIELD_WIDTH = SHIELD_FLATS+SHIELD_COLUMN_OFFSET;
export const SHIELD_HEIGHT = 2*SHIELD_RADIUS+4*SHIELD_VERTICAL_PITCH;
