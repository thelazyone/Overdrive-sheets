import { mm } from "./featureGeometry";

export const QUARTERS_CELL = mm(8);
export const QUARTERS_EDGE = mm(0.5);
export const QUARTERS_GAP = mm(2.5);
export const QUARTERS_CREW_WIDTH = 3*QUARTERS_CELL+2*QUARTERS_EDGE;
export const QUARTERS_MED_WIDTH = QUARTERS_CELL+2*QUARTERS_EDGE;
export const QUARTERS_MED_X = QUARTERS_CREW_WIDTH+QUARTERS_GAP;
export const QUARTERS_WIDTH = QUARTERS_MED_X+QUARTERS_MED_WIDTH;
export const QUARTERS_HEIGHT = 2*QUARTERS_CELL+2*QUARTERS_EDGE;

/** White capacity regions in the fixed 3×2 aperture; no internal grid lines. */
export function crewCapacityRegions(capacity: number) {
  const count = Math.max(0, Math.min(6, Math.floor(capacity)));
  const rows = count <= 2 ? [count] : count <= 4 ? [2, count-2] : [3, count-3];
  return rows.filter(n => n > 0).map((n,i) => ({
    x: QUARTERS_EDGE+(3-n)*QUARTERS_CELL/2,
    y: QUARTERS_EDGE+(rows.length===1 ? QUARTERS_CELL/2 : i*QUARTERS_CELL),
    width: n*QUARTERS_CELL,
    height: QUARTERS_CELL,
  }));
}

export function crewCapacityFromRules(rules: string): number {
  return Number(rules.match(/\bcrew\s*:\s*(\d+)\b/i)?.[1] ?? 0);
}
