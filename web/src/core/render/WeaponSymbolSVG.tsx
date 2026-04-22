/**
 * Ported from `python/src/attack_symbols.py::draw_weapon_symbol`.
 *
 * A weapon symbol is the arrow PNG (short or long variant) with a damage
 * number on the left and a range value on the right, both centered on the
 * coordinates Python used (28, 79) or (28, 103) for long.
 *
 * The arrow PNGs are served from `/resources/` via the Vite dev middleware
 * and the build-time copy step in `web/vite.config.ts`.
 */

import type { JSX } from "solid-js";
import { cssFont, FONT_EUROSTILE, TILE_COMBAT_NUMBER_SIZE } from "./constants";

interface Props {
  damage: number;
  range: string | number;
  /** SVG user-space position for the top-left corner of the symbol. */
  x: number;
  y: number;
}

/** Width of the arrow PNG after scaling to 60 px tall. */
const SHORT_WIDTH = 96;
const LONG_WIDTH = 132;
const HEIGHT = 60;

export function weaponSymbolWidth(range: string | number): number {
  return isLongArrow(range) ? LONG_WIDTH : SHORT_WIDTH;
}

export function weaponSymbolHeight(): number {
  return HEIGHT;
}

function isLongArrow(range: string | number): boolean {
  return typeof range === "string" && range.length > 2;
}

export function WeaponSymbolSVG(props: Props): JSX.Element {
  const longArrow = () => isLongArrow(props.range);
  const width = () => (longArrow() ? LONG_WIDTH : SHORT_WIDTH);
  const href = () =>
    longArrow() ? "/resources/arrow_long_symbol.png" : "/resources/arrow_symbol.png";

  const damageX = 28;
  const rangeX = () => (longArrow() ? 103 : 79);

  const font = cssFont(TILE_COMBAT_NUMBER_SIZE, FONT_EUROSTILE);

  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <image href={href()} x={0} y={0} width={width()} height={HEIGHT} />
      <text
        x={damageX}
        y={HEIGHT / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font, fill: "black" }}
      >
        {props.damage}
      </text>
      <text
        x={rangeX()}
        y={HEIGHT / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font, fill: "black" }}
      >
        {props.range}
      </text>
    </g>
  );
}
