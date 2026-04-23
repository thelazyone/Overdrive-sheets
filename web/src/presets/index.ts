/**
 * Ship presets shown in the "Load preset..." dropdown.
 *
 * Presets live in `web/src/presets/` as static JSON modules so they're
 * type-checked through {@link migrateShip} at load time.
 */

import opulence from "./opulence_freighter.json";

export interface PresetEntry {
  id: string;
  /** Display name in the template dropdown. Sourced from the ship's `label`
   *  field (falling back to the id if missing). */
  name: string;
  data: unknown;
}

/** Pick the best label for the dropdown from a preset's JSON data. */
function labelOf(raw: any, fallback: string): string {
  const v = raw?.label;
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export const PRESETS: PresetEntry[] = [
  { id: "opulence_freighter", name: labelOf(opulence, "Opulence Freighter"), data: opulence },
];

export const DEFAULT_PRESET_ID = "opulence_freighter";
