import { SHIELD_RADIUS, SHIELD_FLATS } from "./shieldGeometry";
import { COLUMN_TILE_SCALE } from "./sheetLayout";
import { TILE_WIDTH } from "./constants";

// Compensate for the tile-to-console scale: these hexes print at exactly the
// same physical size as the fixed shield track, on the console and cut-outs.
export const systemShieldTrackHeight = 2 * SHIELD_RADIUS / COLUMN_TILE_SCALE;
export function SystemShieldTrackSVG(props: {steps: ("off" | "recharge")[]; y: number}) {
  const pitch = SHIELD_FLATS + 6;
  const width = props.steps.length * pitch - 6;
  return <g data-system-shield-track="" transform={`translate(${(TILE_WIDTH-width/COLUMN_TILE_SCALE)/2} ${props.y}) scale(${1/COLUMN_TILE_SCALE})`}>
    {props.steps.map((step,i) => {
      const cx = SHIELD_FLATS/2+i*pitch;
      const cy = SHIELD_RADIUS;
      const points = Array.from({length:6},(_,n) => `${cx+Math.cos(Math.PI/6+n*Math.PI/3)*SHIELD_RADIUS},${cy+Math.sin(Math.PI/6+n*Math.PI/3)*SHIELD_RADIUS}`).join(" ");
      return <g data-shield-step={step}>
        <polygon points={points} fill="white" stroke="black" stroke-width={3} />
        <g transform={`translate(${cx} ${cy})`}>
          {step==='off' ? <path d="M -14 -14 L 14 14 M -14 14 L 14 -14" stroke="#bc2424" stroke-width={9} />
            : <path d="M 4 -23 L -16 5 H -2 L -6 24 L 17 -5 H 3 Z" fill="#f5c400" stroke="#715b00" stroke-width={2} />}
        </g>
      </g>;
    })}
  </g>;
}
