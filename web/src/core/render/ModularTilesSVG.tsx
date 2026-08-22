/**
 * A page of cut-out module tiles for modular ("print class") printing.
 *
 * Each page is the same {@link SHEET_WIDTH} x {@link SHEET_HEIGHT} as a ship
 * console and goes through the same rasterise → fit-into-PDF-box path, so a
 * tile drawn N units wide here comes out the same number of millimetres as the
 * N-unit-wide blank space it is meant to cover on the console.
 */

import { For, type JSX } from "solid-js";
import {
  cssFont,
  FONT_EUROSTILE,
  FONT_TITILLIUM,
  SHEET_HEIGHT,
  SHEET_LABEL_SIZE,
  SHEET_SUBTITLE_SIZE,
  SHEET_TITLE_SIZE,
  SHEET_WIDTH,
  TILE_WIDTH,
} from "./constants";
import { tileScaleForBox, TILE_PAGE_MARGIN } from "./sheetLayout";
import { layoutSystem } from "./SystemSVG";
import type { PlacedTile, TilePage } from "./modularTiles";

/** Caption under a tile, e.g. `WEAPON 2/3`. */
function captionFor(placed: PlacedTile): string {
  const { slotLabel, optionIndex, optionCount } = placed.tile;
  const base = slotLabel.toUpperCase();
  return optionCount > 1 ? `${base} ${optionIndex}/${optionCount}` : base;
}

/**
 * One cut-out: the system drawn at the same scale it would take on the console,
 * centred inside its standard box, with a solid cut guide at the box bounds.
 */
function TileCutout(props: { placed: PlacedTile }): JSX.Element {
  const { placed } = props;
  const { box, x, y } = placed;

  // Width always fills the box — same scale the console draws at — so every
  // cut-out comes out exactly the same size. `targetHeight` makes the tile's
  // own border fill the box too, so the printed module is the full standard
  // size rather than a smaller tile floating inside the cut guide.
  const scale = tileScaleForBox(box, TILE_WIDTH);
  const layout = layoutSystem(placed.tile.system, box.height / scale);
  const drawnH = layout.height * scale;
  const offsetX = 0;
  const offsetY = (box.height - drawnH) / 2;

  const captionFont = cssFont(
    Math.floor(SHEET_LABEL_SIZE * 0.8),
    FONT_TITILLIUM,
  );

  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Cut guide: the exact box the tile must be cut to. */}
      <rect
        x={0}
        y={0}
        width={box.width}
        height={box.height}
        fill="none"
        stroke="rgb(140,140,140)"
        stroke-dasharray="12 10"
        stroke-width={3}
      />
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
        {layout.el}
      </g>
      <text
        x={6}
        y={box.height - 6}
        dominant-baseline="alphabetic"
        style={{ font: captionFont, fill: "rgb(120,120,120)" }}
      >
        {captionFor(placed)}
      </text>
    </g>
  );
}

export interface ModularTilesSVGProps {
  page: TilePage;
  shipName: string;
  pageIndex: number;
  pageCount: number;
  responsive?: boolean;
}

function ModularTilesInner(props: ModularTilesSVGProps): JSX.Element {
  const titleFont = cssFont(Math.floor(SHEET_TITLE_SIZE * 0.7), FONT_EUROSTILE);
  const hintFont = cssFont(SHEET_SUBTITLE_SIZE, FONT_TITILLIUM);

  const heading = `${props.shipName.toUpperCase()} — MODULES`;
  const hint =
    props.pageCount > 1
      ? `Cut along the dashed lines · sheet ${props.pageIndex + 1} of ${props.pageCount}`
      : "Cut along the dashed lines";

  const svgProps: Record<string, any> = {
    viewBox: `0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`,
    preserveAspectRatio: "xMidYMid meet",
    xmlns: "http://www.w3.org/2000/svg",
  };
  if (props.responsive) {
    svgProps.width = "100%";
    svgProps.height = "100%";
  } else {
    svgProps.width = SHEET_WIDTH;
    svgProps.height = SHEET_HEIGHT;
  }

  return (
    <svg {...svgProps}>
      <rect x={0} y={0} width={SHEET_WIDTH} height={SHEET_HEIGHT} fill="white" />
      <text
        x={TILE_PAGE_MARGIN}
        y={TILE_PAGE_MARGIN + 6}
        dominant-baseline="hanging"
        style={{ font: titleFont, fill: "black" }}
      >
        {heading}
      </text>
      <text
        x={SHEET_WIDTH - TILE_PAGE_MARGIN}
        y={TILE_PAGE_MARGIN + 12}
        text-anchor="end"
        dominant-baseline="hanging"
        style={{ font: hintFont, fill: "rgb(110,110,110)" }}
      >
        {hint}
      </text>

      <For each={props.page}>{(placed) => <TileCutout placed={placed} />}</For>
    </svg>
  );
}

export function ModularTilesSVG(props: ModularTilesSVGProps): JSX.Element {
  return <>{ModularTilesInner(props)}</>;
}
