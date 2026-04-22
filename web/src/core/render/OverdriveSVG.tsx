/**
 * Ported from `python/src/overdrive.py::render_overdrive_tokens`.
 *
 * Draws the "OVERDRIVE" label followed by a row of numbered rounded squares
 * aligned with the ship title at the top-left of the sheet.
 */

import { For, type JSX } from "solid-js";
import {
  cssFont,
  FONT_EUROSTILE,
  OVERDRIVE_SQUARE_MARGIN,
  OVERDRIVE_SQUARE_SIZE,
  SHEET_LABEL_SIZE,
  SHEET_STATS_SIZE,
} from "./constants";

interface Props {
  tokens: number[];
  /** Top-left anchor for the whole group (label + squares). */
  x: number;
  y: number;
}

export function OverdriveSVG(props: Props): JSX.Element {
  const labelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
  const numberFont = cssFont(SHEET_STATS_SIZE, FONT_EUROSTILE);
  const borderWidth = 6;
  const radius = Math.round(OVERDRIVE_SQUARE_SIZE * 0.15);

  return (
    <g>
      <text
        x={props.x}
        y={props.y}
        dominant-baseline="hanging"
        style={{ font: labelFont, fill: "black" }}
      >
        OVERDRIVE
      </text>
      <For each={props.tokens}>
        {(token, i) => {
          const sx = () => props.x + i() * (OVERDRIVE_SQUARE_SIZE + OVERDRIVE_SQUARE_MARGIN);
          const sy = props.y + SHEET_LABEL_SIZE + 10;
          return (
            <g>
              <rect
                x={sx()}
                y={sy}
                width={OVERDRIVE_SQUARE_SIZE}
                height={OVERDRIVE_SQUARE_SIZE}
                rx={radius}
                ry={radius}
                fill="white"
                stroke="black"
                stroke-width={borderWidth}
              />
              <text
                x={sx() + OVERDRIVE_SQUARE_SIZE / 2}
                y={sy + OVERDRIVE_SQUARE_SIZE / 2}
                text-anchor="middle"
                dominant-baseline="central"
                style={{ font: numberFont, fill: "black" }}
              >
                {token}
              </text>
            </g>
          );
        }}
      </For>
    </g>
  );
}
