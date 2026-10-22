import type { Ship } from "../schema";
import { ShieldTrackSVG } from "./ShieldTrackSVG";
import { ReactorSVG } from "./ReactorSVG";
import { QuartersSVG } from "./QuartersSVG";

export function FixedFeaturesSVG(props: { ship: Ship }) {
  return <g>
    <ShieldTrackSVG values={props.ship.shields.front} side="front" />
    <ShieldTrackSVG values={props.ship.shields.rear} side="rear" />
    <ReactorSVG reactor={props.ship.reactor} />
    <QuartersSVG quarters={props.ship.quarters} />
  </g>;
}
