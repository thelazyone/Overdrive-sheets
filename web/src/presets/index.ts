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

import sosg from "./sound_of_shattered_glass.json";
import parsimony from "./parsimony_utility.json";
import bishok from "./bishok_cruiser.json";
import blank from "./blank.json";

export interface PresetEntry {
  id: string;
  name: string;
  data: unknown;
}

export const PRESETS: PresetEntry[] = [
  { id: "sound_of_shattered_glass", name: "Sound of Shattered Glass", data: sosg },
  { id: "parsimony_utility", name: "Parsimony (utility)", data: parsimony },
  { id: "bishok_cruiser", name: "Bishok Cruiser", data: bishok },
  { id: "blank", name: "Blank template", data: blank },
];

export const DEFAULT_PRESET_ID = "sound_of_shattered_glass";
