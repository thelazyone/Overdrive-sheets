/**
 * Ship presets shown in the "Load preset..." dropdown.
 *
 * Each preset showcases slots: most fields are inline systems, a few are
 * `{ kind: "slot", allowed: [...], selectedId }` entries that the user can
 * change via the (future) inspector UI or by editing the JSON directly.
 *
 * Presets live in `web/src/presets/` as static JSON modules so they're
 * type-checked through {@link migrateShip} at load time.
 */

import opulence from "./opulence_freighter.json";
import parsimony from "./parsimony_utility.json";
import bishok from "./bishok_cruiser.json";
import blank from "./blank.json";

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
  { id: "parsimony_utility", name: labelOf(parsimony, "Parsimony (utility)"), data: parsimony },
  { id: "bishok_cruiser", name: labelOf(bishok, "Bishok Cruiser"), data: bishok },
  { id: "blank", name: labelOf(blank, "Blank template"), data: blank },
];

export const DEFAULT_PRESET_ID = "opulence_freighter";
