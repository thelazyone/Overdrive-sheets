import { Show } from "solid-js";
import { FEATURE_LAYOUT } from "./sheetLayout";
import { cssFont, FONT_EUROSTILE } from "./constants";
import type { Ship } from "../schema";
import { ShieldTrackSVG } from "./ShieldTrackSVG";
import { ReactorSVG } from "./ReactorSVG";
import { QuartersSVG } from "./QuartersSVG";

const pending = (rules: string) => /stats pending/i.test(rules);
function PendingFeature(props: { location: keyof typeof FEATURE_LAYOUT; name: string }) {
  const box = FEATURE_LAYOUT[props.location];
  return <g transform={`translate(${box.x} ${box.y})`}>
    <rect width={box.width} height={box.height} fill="white" stroke="#777" stroke-dasharray="8 6" />
    <text x={box.width/2} y={box.height/2-15} text-anchor="middle" style={{font:cssFont(23,FONT_EUROSTILE)}}>{props.name}</text>
    <text x={box.width/2} y={box.height/2+20} text-anchor="middle" style={{font:cssFont(23,FONT_EUROSTILE)}}>Stats pending</text>
  </g>;
}
export function FixedFeaturesSVG(props: { ship: Ship }) {
  return <g>
    <Show when={!pending(props.ship.shields.rules)} fallback={<><PendingFeature location="front" name="FRONT SHIELD" /><PendingFeature location="rear" name="REAR SHIELD" /></>}>
    <ShieldTrackSVG values={props.ship.shields.front} side="front" />
    <ShieldTrackSVG values={props.ship.shields.rear} side="rear" />
    </Show>
    <Show when={!pending(props.ship.reactor.rules)} fallback={<PendingFeature location="reactor" name="REACTOR" />}>
    <ReactorSVG reactor={props.ship.reactor} />
    </Show>
    <Show when={!pending(props.ship.quarters.rules)} fallback={<PendingFeature location="quarters" name="QUARTERS / MED BAY" />}>
    <QuartersSVG quarters={props.ship.quarters} />
    </Show>
  </g>;
}
