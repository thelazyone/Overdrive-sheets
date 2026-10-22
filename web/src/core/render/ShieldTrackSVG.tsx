import { cssFont, FONT_EUROSTILE } from "./constants";
import { FEATURE_LAYOUT } from "./sheetLayout";
import { shieldSteps } from "./shieldTrack";
import { SHIELD_CENTRES, SHIELD_HEXES, SHIELD_OUTLINE, SHIELD_WIDTH, SHIELD_HEIGHT } from "./shieldGeometry";

export function ShieldTrackSVG(props: { values:number[]; side:"front"|"rear" }) {
  const box = FEATURE_LAYOUT[props.side];
  return <g data-feature={`${props.side}-shields`} transform={`translate(${box.x} ${box.y})`}>
    {/* Available hexes reclaim their full area, including overlaps with disabled ones. */}
    <path d={SHIELD_OUTLINE} fill="#b8b8b8" />
    {shieldSteps(props.values).map((step,index) => {
      const position = props.side === "front" ? 8-index : index;
      return step !== "disabled" && <polygon
        points={SHIELD_HEXES[position].map(p=>`${p.x},${p.y}`).join(" ")} fill="white" />;
    })}
    {shieldSteps(props.values).map((step,index) => {
      const position = props.side === "front" ? 8-index : index;
      const c = SHIELD_CENTRES[position];
      return <g data-shield-step={step}>
        <g transform={`translate(${c.x} ${c.y})`}>
          {step === "off" && <path d="M -14 -14 L 14 14 M -14 14 L 14 -14" stroke="#bc2424" stroke-width={9} />}
          {step === "recharge" && <path d="M 4 -23 L -16 5 H -2 L -6 24 L 17 -5 H 3 Z" fill="#f5c400" stroke="#715b00" stroke-width={2} />}
        </g>
      </g>;
    })}
    <text transform={`translate(${SHIELD_WIDTH+8} ${SHIELD_HEIGHT/2}) rotate(90)`}
      text-anchor="middle" style={{font:cssFont(23,FONT_EUROSTILE)}}>
      {props.side === "front" ? "FRONT SHIELD" : "REAR SHIELD"}
    </text>
  </g>;
}
