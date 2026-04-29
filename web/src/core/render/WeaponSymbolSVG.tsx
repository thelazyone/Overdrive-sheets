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

/**
 * Baseline geometry from `python/src/attack_symbols.py` (60px tall, anchors
 * 28 / 79 / 103). Scaled up slightly: Orbitron is wider than Eurostile at the
 * same px size, and SVG `<image>` defaults to `meet` which letterboxes the PNG
 * inside width×height — use `preserveAspectRatio="none"` so the raster fills
 * the box like PIL's resize.
 */
const WEAPON_SYMBOL_SCALE = 1.18;
const BASE_HEIGHT = 60;
const HEIGHT = Math.round(BASE_HEIGHT * WEAPON_SYMBOL_SCALE);
const SHORT_WIDTH = Math.round(96 * WEAPON_SYMBOL_SCALE);
const LONG_WIDTH = Math.round(132 * WEAPON_SYMBOL_SCALE);

/**
 * Slightly under tile combat size: Orbitron is wide; keeps `2-4`-style ranges
 * inside the arrow without the 0.82 pass looking anemic.
 */
const WEAPON_LABEL_FONT_PX = Math.round(TILE_COMBAT_NUMBER_SIZE * 0.92);
const WEAPON_LABEL_FONT = cssFont(WEAPON_LABEL_FONT_PX, FONT_EUROSTILE);

/**
 * Label X anchors in the pre-scale (60px-tall) coordinate system. Tuned for web
 * fonts: damage nudged right, range nudged left vs Python 28/79/103 so the
 * pair sits closer and range isn’t pushed into the right edge.
 */
const DAMAGE_ANCHOR_X = 23;
const RANGE_ANCHOR_X_SHORT = 71;
const RANGE_ANCHOR_X_LONG = 83;

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

  const damageX = Math.round(DAMAGE_ANCHOR_X * WEAPON_SYMBOL_SCALE);
  const rangeX = () =>
    Math.round(
      (longArrow() ? RANGE_ANCHOR_X_LONG : RANGE_ANCHOR_X_SHORT) *
        WEAPON_SYMBOL_SCALE,
    );

  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <image
        href={href()}
        x={0}
        y={0}
        width={width()}
        height={HEIGHT}
        preserveAspectRatio="none"
      />
      <text
        x={damageX}
        y={HEIGHT / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font: WEAPON_LABEL_FONT, fill: "black" }}
      >
        {props.damage}
      </text>
      <text
        x={rangeX()}
        y={HEIGHT / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font: WEAPON_LABEL_FONT, fill: "black" }}
      >
        {props.range}
      </text>
    </g>
  );
}
