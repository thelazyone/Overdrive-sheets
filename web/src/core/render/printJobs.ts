/**
 * Builds the ordered list of A5 sheets that goes into a print PDF.
 *
 * - `"custom"` — today's output: one fully-populated console per ship.
 * - `"modular"` — "print class": per ship, a console whose slots are blank
 *   uniform spaces, followed by pages of cut-out module tiles sized to drop
 *   onto those spaces.
 *
 * Every sheet is rasterised through the same offscreen path at the same target
 * width, so tiles and slots come out at the same scale on paper.
 */

import type { Ship } from "../schema";
import {
  rasterizeSheetToJpegBlobOffscreen,
  type OffscreenRasterOptions,
} from "./exportSheetImage";
import { ModularTilesSVG } from "./ModularTilesSVG";
import { ShipSVG, type SheetMode } from "./ShipSVG";
import { modularPagesFor } from "./modularTiles";

/** Sheets a single ship contributes, before rasterising. */
export function sheetCountForShip(ship: Ship, mode: SheetMode): number {
  if (mode !== "modular") return 1;
  return 1 + modularPagesFor(ship).length;
}

export interface BuildPrintSheetsOptions extends OffscreenRasterOptions {
  /** Called after each sheet is rasterised, for progress reporting. */
  onProgress?: (done: number, total: number) => void;
}

export async function buildPrintSheetJpegs(
  ships: Ship[],
  mode: SheetMode,
  options: BuildPrintSheetsOptions = {},
): Promise<Blob[]> {
  const { onProgress, ...rasterOptions } = options;

  const total = ships.reduce((n, s) => n + sheetCountForShip(s, mode), 0);
  const blobs: Blob[] = [];

  const push = async (renderSheet: () => ReturnType<typeof ShipSVG>) => {
    blobs.push(await rasterizeSheetToJpegBlobOffscreen(renderSheet, rasterOptions));
    onProgress?.(blobs.length, total);
  };

  for (const ship of ships) {
    await push(() => ShipSVG({ ship, responsive: true, mode }));

    if (mode !== "modular") continue;

    const pages = modularPagesFor(ship);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!;
      await push(() =>
        ModularTilesSVG({
          page,
          shipName: ship.name,
          pageIndex: i,
          pageCount: pages.length,
          responsive: true,
        }),
      );
    }
  }

  return blobs;
}
