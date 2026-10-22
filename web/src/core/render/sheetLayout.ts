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

import { SHIELD_WIDTH, SHIELD_HEIGHT } from "./shieldGeometry";
import { REACTOR_WIDTH, REACTOR_HEIGHT } from "./reactorGeometry";
import { QUARTERS_WIDTH, QUARTERS_HEIGHT } from "./quartersGeometry";
import { mm } from "./featureGeometry";
import { SHEET_HEIGHT, SHEET_WIDTH, TILE_WIDTH } from "./constants";

/** Physical mask geometry: never derived from ship capacity or content. */
export const FEATURE_LAYOUT = {
  front: { x: 80, y: 70, width: SHIELD_WIDTH, height: SHIELD_HEIGHT },
  reactor: { x: 45, y: 650, width: REACTOR_WIDTH, height: REACTOR_HEIGHT },
  rear: { x: 80, y: 1130, width: SHIELD_WIDTH, height: SHIELD_HEIGHT },
  quarters: { x: 310, y: 1480, width: QUARTERS_WIDTH, height: QUARTERS_HEIGHT },
} as const;
export const COLUMN_TOP = { left: 490, core: 400, right: 580 } as const;
export const COLUMN_BOTTOM = { left: 1360, core: 1600, right: 1600 } as const;

// ---------------------------------------------------------------------------
// Console geometry (was inline in ShipSVG)
// ---------------------------------------------------------------------------

/** SYSTEM_SCALE from python/src/ship_profile.py line 12. */
export const SCALE = 0.75;
export const BOX_MARGIN = 20;
export const COLUMN_MARGIN = 12;
export const SIDE_MARGIN = 16;

/** Width of each of the three system columns (LEFT / CENTER / RIGHT). */
export const CHARACTERS_X = 2370;
export const LEFT_FEATURE_BAND_RIGHT = FEATURE_LAYOUT.quarters.x - 25 + mm(3);
export const SYSTEM_SIDE_CLEARANCE = mm(3);
export const COLUMNS_START_X = LEFT_FEATURE_BAND_RIGHT + SYSTEM_SIDE_CLEARANCE;
export const COLUMN_WIDTH = (CHARACTERS_X - mm(2.5) - COLUMNS_START_X - 2*COLUMN_MARGIN)/3;
export const TOTAL_COLUMNS_WIDTH = 3 * COLUMN_WIDTH + 2 * COLUMN_MARGIN;

/**
 * Scale applied to a {@link layoutSystem} tile (drawn in TILE_WIDTH-wide tile
 * space) when it is placed into a console column.
 */
export const COLUMN_TILE_SCALE = COLUMN_WIDTH / TILE_WIDTH;

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
 * Column limits reserve room for quarters and cargo.
 */
export const MODULAR_SECTION_TILE_HEIGHT = 210 * COLUMN_WIDTH / 580;

/**
 * Engines get their own standard size. They are much taller than any other
 * system (their speed slots alone are 200 tile units), so folding them into the
 * shared section size would drag every tile up to engine height and waste most
 * of the page. Engine slots take engine-sized cut-outs; everything else shares
 * the section size.
 */
export const MODULAR_ENGINE_TILE_HEIGHT = 300 * COLUMN_WIDTH / 580;

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
 * Which console column a modular tile belongs to. Left and right tiles get a
 * cut corner so a pile of loose cardboard can be sorted at a glance; centre
 * tiles stay square.
 */
export type ModularColumn = "left" | "core" | "right";

/** Corner chamfer for a column, as a {@link layoutSystem} corner. */
export type TileCorner = "none" | "left" | "right";

export function cornerForColumn(column: ModularColumn): TileCorner {
  if (column === "left") return "left";
  if (column === "right") return "right";
  return "none";
}

/**
 * Size of the diagonal cut across a tile's top corner, in **tile-space** units
 * (the space {@link layoutSystem} draws in). ~50 units lands near 3.5 mm
 * printed — readable across a table without biting into the title.
 *
 * Applied to every system, fixed ones included, so a console column reads the
 * same whether a position is a swappable slot or welded in place.
 */
export const TILE_CORNER_CUT = 50;

/**
 * Outline of a tile `width` x `height` with an optional cut top corner.
 * Shared by the printed tile border and the console's blank placement target,
 * so a cut-out and the space it drops into are the same shape.
 */
export function tileOutlinePath(
  width: number,
  height: number,
  corner: TileCorner,
  cut: number,
): string {
  if (corner === "left") {
    return `M ${cut} 0 L ${width} 0 L ${width} ${height} L 0 ${height} L 0 ${cut} Z`;
  }
  if (corner === "right") {
    return `M 0 0 L ${width - cut} 0 L ${width} ${cut} L ${width} ${height} L 0 ${height} Z`;
  }
  return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
}

/** Only configurable systems produce modular cut-outs. */
export type ModularTileSize = "section" | "engine";

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
