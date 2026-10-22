/**
 * Collect the cut-out tiles a ship needs in modular ("print class") mode.
 *
 * Only **slots** produce tiles: every option of every slot becomes one physical
 * tile you cut out and drop onto the matching blank space on the console.
 * Inline (fixed) systems are printed straight onto the console, so they need no
 * tile — see the modular branch in `ShipSVG`.
 */

import type { Ship, System, SystemRef } from "../schema";
import {
  tileBoxFor,
  TILE_PAGE_GAP,
  TILE_PAGE_HEADER_HEIGHT,
  TILE_PAGE_HEIGHT,
  TILE_PAGE_MARGIN,
  TILE_PAGE_WIDTH,
  type ModularColumn,
  type ModularTileSize,
  type TileBox,
} from "./sheetLayout";
import { sectionSlotSize } from "./modularMetrics";

export interface ModularTile {
  system: System;
  /** Which standard box this tile is cut to. */
  size: ModularTileSize;
  /** Console column it belongs to — drives the cut-corner marking. */
  column: ModularColumn;
  /** Slot label, e.g. "Weapon" — printed as a small caption for sorting. */
  slotLabel: string;
  /** 1-based index within its slot, for captions like "Weapon 2/3". */
  optionIndex: number;
  optionCount: number;
}

function slotLabelFor(ref: Extract<SystemRef, { kind: "slot" }>, fallback: string): string {
  const t = ref.label.trim();
  return t !== "" ? t : fallback;
}

function tilesForRef(
  ref: SystemRef,
  size: ModularTileSize,
  column: ModularColumn,
  fallbackLabel: string,
): ModularTile[] {
  if (ref.kind !== "slot") return [];
  const label = slotLabelFor(ref, fallbackLabel);
  return ref.options.map((system, i) => ({
    system,
    size,
    column,
    slotLabel: label,
    optionIndex: i + 1,
    optionCount: ref.options.length,
  }));
}

/**
 * Every cut-out for `ship`, grouped by box size so the page packer can build
 * homogeneous rows (all three sizes happen to be ~the same width, so they all
 * pack three across; only their heights differ).
 */
export function collectModularTiles(ship: Ship): ModularTile[] {
  const sectionRefs: Array<[SystemRef, ModularColumn, string]> = [
    ...ship.sections.left.map(
      (r) => [r, "left", "Left"] as [SystemRef, ModularColumn, string],
    ),
    ...ship.sections.core.map(
      (r) => [r, "core", "Center"] as [SystemRef, ModularColumn, string],
    ),
    ...ship.sections.right.map(
      (r) => [r, "right", "Right"] as [SystemRef, ModularColumn, string],
    ),
  ];

  const all = sectionRefs.flatMap(([r, column, fallback]) =>
    tilesForRef(r, sectionSlotSize(r), column, fallback),
  );

  const section = all.filter((t) => t.size === "section");
  const engine = all.filter((t) => t.size === "engine");
  return [...section, ...engine];
}

// ---------------------------------------------------------------------------
// Page packing
// ---------------------------------------------------------------------------

export interface PlacedTile {
  tile: ModularTile;
  box: TileBox;
  x: number;
  y: number;
}

export type TilePage = PlacedTile[];

/** How many boxes of `width` fit across a tile page. */
export function columnsForWidth(width: number): number {
  const usable = TILE_PAGE_WIDTH - 2 * TILE_PAGE_MARGIN;
  let n = Math.floor((usable + TILE_PAGE_GAP) / (width + TILE_PAGE_GAP));
  if (n < 1) n = 1;
  return n;
}

/**
 * Shelf-pack tiles into pages. Tiles arrive grouped by size, so each row is
 * homogeneous and a row's height is just its box height. A row that would run
 * past the bottom margin starts a new page.
 */
export function paginateModularTiles(tiles: ModularTile[]): TilePage[] {
  const pages: TilePage[] = [];
  let current: TilePage = [];
  let rowY = TILE_PAGE_MARGIN + TILE_PAGE_HEADER_HEIGHT;
  let rowHeight = 0;
  let col = 0;
  let cols = 1;
  let currentSize: ModularTileSize | null = null;

  const bottomLimit = TILE_PAGE_HEIGHT - TILE_PAGE_MARGIN;

  const newRow = (height: number) => {
    rowY += rowHeight === 0 ? 0 : rowHeight + TILE_PAGE_GAP;
    rowHeight = height;
    col = 0;
  };

  const newPage = () => {
    if (current.length > 0) pages.push(current);
    current = [];
    rowY = TILE_PAGE_MARGIN + TILE_PAGE_HEADER_HEIGHT;
    rowHeight = 0;
    col = 0;
  };

  for (const tile of tiles) {
    const box = tileBoxFor(tile.size);

    // Size class changed, or the row is full → start a new row.
    if (currentSize !== tile.size) {
      newRow(box.height);
      cols = columnsForWidth(box.width);
      currentSize = tile.size;
    } else if (col >= cols) {
      newRow(box.height);
    }

    if (rowY + box.height > bottomLimit) {
      newPage();
      rowHeight = box.height;
    }

    const x = TILE_PAGE_MARGIN + col * (box.width + TILE_PAGE_GAP);
    current.push({ tile, box, x, y: rowY });
    col += 1;
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

/** Convenience: collect + paginate a ship's cut-outs. */
export function modularPagesFor(ship: Ship): TilePage[] {
  return paginateModularTiles(collectModularTiles(ship));
}
