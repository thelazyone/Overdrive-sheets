import type { Ship } from "../schema";
import { cssFont, FONT_EUROSTILE } from "./constants";
import { FEATURE_LAYOUT } from "./sheetLayout";
import { QUARTERS_CELL as cell, QUARTERS_EDGE as edge, QUARTERS_CREW_WIDTH,
  QUARTERS_MED_WIDTH, QUARTERS_MED_X, QUARTERS_HEIGHT, QUARTERS_WIDTH,
  crewCapacityRegions, crewCapacityFromRules } from "./quartersGeometry";

export function QuartersSVG(props: { quarters:Ship["quarters"] }) {
  const box = FEATURE_LAYOUT.quarters;
  const medCount = () => Math.max(0, Math.min(2, props.quarters.med_bay));
  const medTop = () => edge+(2-medCount())*cell/2;
  return <g data-feature="quarters" transform={`translate(${box.x} ${box.y})`}>
    <text x={QUARTERS_CREW_WIDTH/2} y={-14} text-anchor="middle"
      style={{font:cssFont(23,FONT_EUROSTILE)}}>QUARTERS</text>
    <text x={QUARTERS_MED_X+QUARTERS_MED_WIDTH/2} y={-14} text-anchor="middle"
      style={{font:cssFont(23,FONT_EUROSTILE)}}>MED BAY</text>
    <rect width={QUARTERS_WIDTH} height={QUARTERS_HEIGHT} fill="#b8b8b8" />
    {crewCapacityRegions(crewCapacityFromRules(props.quarters.rules)).map(region =>
      <rect data-crew-region="" {...region} fill="white" />)}
    <rect x={QUARTERS_MED_X+edge} y={medTop()} width={cell} height={medCount()*cell} fill="white" />
    {Array.from({length:medCount()},(_,i) =>
      <path data-med-bay-symbol="" transform={`translate(${QUARTERS_MED_X+edge+cell/2} ${medTop()+(i+0.5)*cell})`}
        d="M -8 -21 H 8 V -8 H 21 V 8 H 8 V 21 H -8 V 8 H -21 V -8 H -8 Z"
        fill="white" stroke="#333" stroke-width={2} />)}
  </g>;
}
