/**
 * Ported from `python/src/attack_symbols.py::draw_engine_symbol`.
 *
 * An engine symbol is the empty arrow PNG with a speed value centered in it,
 * optionally followed by a steer/rotation label beneath.
 */

import type { JSX } from "solid-js";
import { cssFont, FONT_EUROSTILE, TILE_COMBAT_NUMBER_SIZE } from "./constants";
import { measureText } from "./measure";

interface Props {
  speed: string | number;
  steer?: string;
  x: number;
  y: number;
  /** Optional override for the combat-number font size (matches Python's 41 by default). */
  fontSize?: number;
}

/** Arrow PNG scaled to 60 tall has ~120 width when empty-arrow. */
const WIDTH = 120;
const HEIGHT = 60;

export function engineSymbolWidth(): number {
  return WIDTH;
}

export function engineSymbolHeight(steer?: string, fontSize = TILE_COMBAT_NUMBER_SIZE): number {
  if (!steer) return HEIGHT;
  const { height } = measureText(steer, cssFont(fontSize, FONT_EUROSTILE));
  return HEIGHT + height + 10;
}

export function EngineSymbolSVG(props: Props): JSX.Element {
  const fontSize = () => props.fontSize ?? TILE_COMBAT_NUMBER_SIZE;
  const font = () => cssFont(fontSize(), FONT_EUROSTILE);

  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <image
        href="/resources/arrow_empty_symbol.png"
        x={0}
        y={0}
        width={WIDTH}
        height={HEIGHT}
        preserveAspectRatio="none"
      />
      <text
        x={55}
        y={HEIGHT / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font: font(), fill: "black" }}
      >
        {props.speed}
      </text>
      {props.steer && (
        <text
          x={WIDTH / 2}
          y={HEIGHT + 5}
          text-anchor="middle"
          dominant-baseline="hanging"
          style={{ font: font(), fill: "black" }}
        >
          {props.steer.replace(/\u00c2\u00b0/g, "\u00b0")}
        </text>
      )}
    </g>
  );
}
