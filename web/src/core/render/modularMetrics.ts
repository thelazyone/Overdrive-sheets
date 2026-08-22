/**
 * Diagnostics for modular ("print class") printing.
 *
 * Tile sizes themselves are plain constants in `sheetLayout.ts` — one fixed
 * size per class, for every ship, so a cut-out from one class fits any other
 * class's console. This module only answers "does that fixed size still work
 * for this ship?", so the preview can warn instead of silently misprinting.
 *
 * Column geometry worth remembering: the Reactor/Mess boxes sit under the
 * **left** column and the Shields box under the **right** one. The **centre**
 * column is unobstructed and runs to the bottom of the sheet.
 */

import { resolveRef, type Ship, type SystemRef } from "../schema";
import { SHEET_HEIGHT, TILE_WIDTH } from "./constants";
import {
  BOTTOM_BOX_HEIGHT,
  BOTTOM_BOX_WIDTH,
  BOX_MARGIN,
  COLUMN_MARGIN,
  COLUMN_TILE_SCALE,
  columnsTopY,
  CORE_BOTTOM_GAP,
  MODULAR_CORE_TILE_HEIGHT,
  MODULAR_ENGINE_TILE_HEIGHT,
  MODULAR_MAX_SLOTS_PER_COLUMN,
  MODULAR_SECTION_TILE_HEIGHT,
  SCALE,
  tileBoxFor,
  type ModularTileSize,
} from "./sheetLayout";
import { layoutSystem } from "./SystemSVG";

type SectionName = "left" | "core" | "right";
const SECTION_NAMES: SectionName[] = ["left", "core", "right"];

/** A slot counts as an engine slot when any of its options is an engine. */
export function isEngineSlot(ref: SystemRef): boolean {
  return ref.kind === "slot" && ref.options.some((o) => o.kind === "engine");
}

/** Standard box class for a section-column slot. */
export function sectionSlotSize(ref: SystemRef): ModularTileSize {
  return isEngineSlot(ref) ? "engine" : "section";
}

/** Height a ref occupies in a modular console column, in sheet units. */
function modularRefHeight(ref: SystemRef): number {
  if (ref.kind === "slot") {
    return isEngineSlot(ref)
      ? MODULAR_ENGINE_TILE_HEIGHT
      : MODULAR_SECTION_TILE_HEIGHT;
  }
  const sys = resolveRef(ref);
  if (!sys) return 200 * SCALE;
  return layoutSystem(sys).height * COLUMN_TILE_SCALE;
}

/** Bottom-box height for reactor / mess in modular mode. */
function coreBlockHeight(ref: SystemRef): number {
  if (ref.kind === "slot") return MODULAR_CORE_TILE_HEIGHT;
  const sys = resolveRef(ref);
  if (!sys) return 240;
  return layoutSystem(sys).height * (BOTTOM_BOX_WIDTH / TILE_WIDTH);
}

/**
 * Lowest Y each column may reach.
 *
 * Left is stopped by the Mess box (which sits above the Reactor box), right by
 * the Shields box, centre only by the sheet edge.
 */
export function columnBottomLimits(ship: Ship): Record<SectionName, number> {
  const sheetBottom = SHEET_HEIGHT - BOX_MARGIN;

  const reactorH = coreBlockHeight(ship.reactor);
  const messH = coreBlockHeight(ship.mess);
  const messTop = sheetBottom - reactorH - messH - CORE_BOTTOM_GAP;

  return {
    left: messTop,
    core: sheetBottom,
    right: sheetBottom - BOTTOM_BOX_HEIGHT,
  };
}

export interface ColumnFit {
  column: SectionName;
  bottom: number;
  limit: number;
  overflow: number;
}

/** Where each column actually ends in modular mode, versus its limit. */
export function columnFits(ship: Ship): ColumnFit[] {
  const top = columnsTopY(ship.name, ship.description);
  const limits = columnBottomLimits(ship);

  return SECTION_NAMES.map((column) => {
    const bottom = ship.sections[column].reduce(
      (y, ref) => y + modularRefHeight(ref) + COLUMN_MARGIN,
      top,
    );
    const limit = limits[column];
    return {
      column,
      bottom: Math.round(bottom),
      limit: Math.round(limit),
      overflow: Math.round(bottom - limit),
    };
  });
}

/** Columns whose systems run past the space available to them. */
export function overflowingColumns(ship: Ship): ColumnFit[] {
  return columnFits(ship).filter((f) => f.overflow > 0);
}

/**
 * Systems whose natural layout is taller than the fixed box they print into.
 * These would overflow their cut-out, so the box constant needs raising.
 */
export function modularOversizedSystems(
  ship: Ship,
): Array<{ name: string; needed: number; box: number }> {
  const out: Array<{ name: string; needed: number; box: number }> = [];

  const check = (ref: SystemRef, size: ModularTileSize) => {
    if (ref.kind !== "slot") return;
    const box = tileBoxFor(size);
    for (const opt of ref.options) {
      const layout = layoutSystem(opt);
      const needed = layout.height * (box.width / layout.width);
      if (needed > box.height + 0.5) {
        out.push({
          name: opt.name,
          needed: Math.round(needed),
          box: Math.round(box.height),
        });
      }
    }
  };

  for (const side of SECTION_NAMES) {
    for (const ref of ship.sections[side]) check(ref, sectionSlotSize(ref));
  }
  check(ship.reactor, "core");
  check(ship.mess, "core");
  check(ship.shields, "shields");

  return out;
}

/**
 * Columns holding more than {@link MODULAR_MAX_SLOTS_PER_COLUMN} section slots.
 */
export function columnsOverSlotCap(ship: Ship): SectionName[] {
  return SECTION_NAMES.filter((side) => {
    const n = ship.sections[side].filter(
      (r) => r.kind === "slot" && !isEngineSlot(r),
    ).length;
    return n > MODULAR_MAX_SLOTS_PER_COLUMN;
  });
}
