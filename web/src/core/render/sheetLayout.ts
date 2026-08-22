/**
 * Sheet geometry shared by the ship console ({@link ShipSVG}) and the modular
 * cut-out tile pages ({@link ModularTilesSVG}).
 *
 * These live here rather than inside `ShipSVG` because **modular printing only
 * works if both sheets agree on sizes to the unit**. A cut-out tile is placed
 * on a console slot physically, so a tile drawn `COLUMN_WIDTH` units wide on the
 * tile page must land on a slot drawn `COLUMN_WIDTH` units wide on the console.
 *
 * Both sheets are rendered at the same {@link SHEET_WIDTH} x {@link SHEET_HEIGHT}
 * (A5 landscape) and placed into the PDF by the same fit-to-box routine, so
 * equal user-space units guarantee equal millimetres on paper.
 */

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
import { measureText } from "./measure";

// ---------------------------------------------------------------------------
// Console geometry (was inline in ShipSVG)
// ---------------------------------------------------------------------------

/** SYSTEM_SCALE from python/src/ship_profile.py line 12. */
export const SCALE = 0.75;
export const BOX_MARGIN = 20;
export const COLUMN_MARGIN = 12;
export const SIDE_MARGIN = 16;

/** Width of each of the three system columns (LEFT / CENTER / RIGHT). */
export const COLUMN_WIDTH = Math.floor(
  (SHEET_WIDTH - 2 * SIDE_MARGIN - 2 * COLUMN_MARGIN) / 3,
);

export const TOTAL_COLUMNS_WIDTH = 3 * COLUMN_WIDTH + 2 * COLUMN_MARGIN;
export const COLUMNS_START_X = Math.floor(
  (SHEET_WIDTH - TOTAL_COLUMNS_WIDTH) / 2,
);

/** Bottom-row boxes: reactor, mess (left) and shields (right). */
export const BOTTOM_BOX_WIDTH = SHEET_WIDTH / 3 - BOX_MARGIN;
export const BOTTOM_BOX_HEIGHT = 300;
export const CORE_BOTTOM_GAP = 24;

/**
 * Scale applied to a {@link layoutSystem} tile (drawn in TILE_WIDTH-wide tile
 * space) when it is placed into a console column.
 */
export const COLUMN_TILE_SCALE = COLUMN_WIDTH / TILE_WIDTH;

/** Same, for the narrower bottom boxes (reactor / mess). */
export const BOTTOM_TILE_SCALE = BOTTOM_BOX_WIDTH / TILE_WIDTH;

// ---------------------------------------------------------------------------
// Header / column origin
// ---------------------------------------------------------------------------

/**
 * Y where the header text ends. Shared with `ShipSVG::renderHeader` so the
 * modular sizing maths sees the same column origin the console actually draws
 * at (a longer ship name pushes the columns down and leaves less room).
 */
export function headerBottomY(name: string, description: string): number {
  const titleFont = cssFont(SHEET_TITLE_SIZE, FONT_EUROSTILE);
  const subtitleFont = cssFont(SHEET_SUBTITLE_SIZE, FONT_TITILLIUM);
  const titleY = 50;
  const titleHeight = measureText(name.toUpperCase(), titleFont).height;
  const subtitleY = titleY + titleHeight + 20;
  return subtitleY + measureText(description, subtitleFont).height;
}

/** Y where the three system columns start. */
export function columnsTopY(name: string, description: string): number {
  return headerBottomY(name, description) + 50 + SHEET_LABEL_SIZE + 20;
}

// ---------------------------------------------------------------------------
// Modular ("print class") sizing
// ---------------------------------------------------------------------------

/**
 * The uniform height of a section slot, in sheet units.
 *
 * Every section slot on the console and every section cut-out is drawn at
 * exactly this height and at {@link COLUMN_WIDTH} wide — one fixed size, so any
 * tile fits any slot on any class.
 *
 * Only the left column (under Reactor/Mess) and the right column (under
 * Shields) are height-limited; the centre column runs to the bottom of the
 * sheet. There is plenty of slack, so this is a plain constant — raise it if
 * a system's text needs more room. `modularOversizedSystems` reports anything
 * whose natural layout no longer fits.
 */
export const MODULAR_SECTION_TILE_HEIGHT = 240;

/**
 * Engines get their own standard size. They are much taller than any other
 * system (their speed slots alone are 200 tile units), so folding them into the
 * shared section size would drag every tile up to engine height and waste most
 * of the page. Engine slots take engine-sized cut-outs; everything else shares
 * the section size.
 */
export const MODULAR_ENGINE_TILE_HEIGHT = 380;

/**
 * Design cap on section slots per console column. Uniform slots are taller than
 * content-fitted ones, so a column deeper than this forces the shared height
 * down until tiles stop being readable — move the extra slot to another column
 * instead. Ships over the cap still render (the height maths is honest about
 * actual counts); {@link columnsOverSlotCap} reports them.
 */
export const MODULAR_MAX_SLOTS_PER_COLUMN = 4;

/** Breathing room kept below a column before the bottom boxes / sheet edge. */
export const MODULAR_COLUMN_BOTTOM_PADDING = 16;

/**
 * Uniform height for reactor / mess cut-outs, in sheet units. These sit in the
 * narrower bottom-left boxes, so they get their own standard size (per design:
 * "exactly the size that current shields-mess-reactor use").
 */
export const MODULAR_CORE_TILE_HEIGHT = 260;

/** Shields cut-outs match the existing shields box exactly. */
export const MODULAR_SHIELDS_TILE_HEIGHT = BOTTOM_BOX_HEIGHT;

/** Which standard box a given ship position uses. */
export type ModularTileSize = "section" | "engine" | "core" | "shields";

export interface TileBox {
  width: number;
  height: number;
}

/** Standard box for a size class — one fixed size per class, for every ship. */
export function tileBoxFor(size: ModularTileSize): TileBox {
  switch (size) {
    case "section":
      return { width: COLUMN_WIDTH, height: MODULAR_SECTION_TILE_HEIGHT };
    case "engine":
      return { width: COLUMN_WIDTH, height: MODULAR_ENGINE_TILE_HEIGHT };
    case "core":
      return { width: BOTTOM_BOX_WIDTH, height: MODULAR_CORE_TILE_HEIGHT };
    case "shields":
      return { width: BOTTOM_BOX_WIDTH, height: MODULAR_SHIELDS_TILE_HEIGHT };
  }
}

/**
 * Scale for drawing a tile-space layout into a standard box.
 *
 * **Width only, always.** Every cut-out must come out exactly `box.width` wide,
 * the same as the slot it covers, so this deliberately ignores the layout's
 * height. Scaling to fit the height too (`min(byWidth, byHeight)`) would shrink
 * taller systems horizontally as well, which is what made tiles come out at
 * visibly different widths.
 *
 * This is the same scale the console itself uses (`COLUMN_WIDTH / TILE_WIDTH`),
 * so a tile is drawn identically whether it is printed in place or cut out.
 * Content shorter than the box is centred vertically by the caller; content
 * taller than the box would overflow, which `modularOversizedSystems` reports.
 */
export function tileScaleForBox(box: TileBox, layoutWidth: number): number {
  return box.width / layoutWidth;
}

// ---------------------------------------------------------------------------
// Tile page packing
// ---------------------------------------------------------------------------

/**
 * Margin and gap for the cut-out grid. Deliberately the console's own
 * {@link SIDE_MARGIN} / {@link COLUMN_MARGIN}: that is exactly what lets three
 * {@link COLUMN_WIDTH} tiles pack across a page, matching the console's column
 * rhythm. Neighbouring tiles share a cut line, so a small gap is enough.
 */
export const TILE_PAGE_MARGIN = SIDE_MARGIN;
export const TILE_PAGE_GAP = COLUMN_MARGIN;
/** Space reserved at the top of a tile page for its heading. */
export const TILE_PAGE_HEADER_HEIGHT = 90;

export const TILE_PAGE_WIDTH = SHEET_WIDTH;
export const TILE_PAGE_HEIGHT = SHEET_HEIGHT;
