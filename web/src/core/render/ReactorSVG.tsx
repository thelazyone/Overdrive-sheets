import type { Ship } from "../schema";
import { cssFont, FONT_EUROSTILE } from "./constants";
import { FEATURE_LAYOUT } from "./sheetLayout";
import { REACTOR_OUTLINE, REACTOR_WIDTH, REACTOR_HEIGHT } from "./reactorGeometry";

export function ReactorSVG(props: { reactor:Ship["reactor"] }) {
  const box = FEATURE_LAYOUT.reactor;
  return <g data-feature="reactor" transform={`translate(${box.x} ${box.y})`}>
    <path d={REACTOR_OUTLINE} fill="white" />
    <text transform={`translate(${REACTOR_WIDTH+8} ${REACTOR_HEIGHT/2}) rotate(90)`}
      text-anchor="middle" style={{font:cssFont(23,FONT_EUROSTILE)}}>REACTOR</text>
    <text x={REACTOR_WIDTH/2} y={REACTOR_HEIGHT/2-35} text-anchor="middle"
      dominant-baseline="central" style={{font:cssFont(120,FONT_EUROSTILE)}}>{props.reactor.circles}</text>
    <g transform={`translate(${REACTOR_WIDTH/2+4} ${REACTOR_HEIGHT/2+75})`}>
      <path d="M -60 -26 L -22 0 L -60 26 Z" fill="#333" />
      <text x={24} y={26} text-anchor="middle" style={{font:cssFont(68,FONT_EUROSTILE)}}>
        {props.reactor.rules.match(/production\s*:\s*(\d+)/i)?.[1] ?? "?"}
      </text>
    </g>
  </g>;
}
