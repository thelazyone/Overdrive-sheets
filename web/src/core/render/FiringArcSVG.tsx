/**
 * Ported from `python/src/firing_arcs.py`.
 *
 * Position numbering (8-step compass, 0 = bottom, clockwise):
 *
 *          4
 *      5       3
 *    6           2
 *      7       1
 *          0
 *
 * Python maps position to angle as `(90 + pos * 45) % 360`, where 0 = bottom
 * (sin/cos angle 90 deg, i.e., downward on screen).
 */

import type { JSX } from "solid-js";

interface Props {
  arcStart: number;
  arcEnd: number;
  size?: number;
  /** SVG user-space x/y to place the arc's top-left. */
  x?: number;
  y?: number;
}

function posToAngle(pos: number): number {
  return (90 + pos * 45) % 360;
}

export function FiringArcSVG(props: Props): JSX.Element {
  const size = () => props.size ?? 80;
  const x = () => props.x ?? 0;
  const y = () => props.y ?? 0;

  const margin = 4;
  const lineWidth = 6;

  const isFullCircle = () => {
    const { arcStart, arcEnd } = props;
    return (
      (arcStart === 0 && arcEnd === 8) ||
      arcEnd - arcStart === 8 ||
      arcStart === arcEnd
    );
  };

  // Pie slice path (filled), in local coords 0..size.
  const sliceD = () => {
    const s = size();
    const cx = s / 2;
    const cy = s / 2;
    const r = (s - margin * 2) / 2 - lineWidth / 2;

    const a0 = (posToAngle(props.arcStart) * Math.PI) / 180;
    let a1 = (posToAngle(props.arcEnd) * Math.PI) / 180;
    if (a1 <= a0) a1 += Math.PI * 2;

    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);

    const large = a1 - a0 > Math.PI ? 1 : 0;

    // Use arc drawn clockwise (sweep-flag=1) to match Python's positive-angle
    // pie slice direction.
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  return (
    <g transform={`translate(${x()} ${y()})`}>
      {isFullCircle() ? (
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={(size() - margin * 2) / 2 - lineWidth / 2}
          fill="black"
        />
      ) : (
        <path d={sliceD()} fill="black" />
      )}
      <circle
        cx={size() / 2}
        cy={size() / 2}
        r={size() / 2 - margin}
        fill="none"
        stroke="black"
        stroke-width={lineWidth}
      />
    </g>
  );
}
