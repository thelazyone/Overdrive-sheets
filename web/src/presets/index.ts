import { charterTemplates, prepareConsole } from "./charterTemplates";
import content from "../charter/content.json";
/**
 * Ship presets shown in the "Load preset..." dropdown.
 *
 * Presets live in `web/src/presets/` as static JSON modules so they're
 * validated by `parseShipDocument` when loaded in the app.
 */

import contemplation from "./contemplation_escort_vessel.json";
import opulence from "./opulence_freighter.json";
import providence from "./providence_salvager.json";
import salvation from "./salvation_utility_vessel.json";

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

const existingPresets: PresetEntry[] = [
  { id: "opulence_freighter", name: labelOf(opulence, "Opulence Freighter"), data: opulence },
  {
    id: "providence_salvager",
    name: labelOf(providence, "Providence Salvager"),
    data: providence,
  },
  {
    id: "contemplation_escort_vessel",
    name: labelOf(contemplation, "Contemplation Escort Vessel"),
    data: contemplation,
  },
  {
    id: "salvation_utility_vessel",
    name: labelOf(salvation, "Salvation Utility Vessel"),
    data: salvation,
  },
];

export const DEFAULT_PRESET_ID = "opulence_freighter";

export const PRESETS: PresetEntry[] = [
  ...existingPresets.map(entry => {
    const hull = content.hulls[`preset:${entry.id}` as keyof typeof content.hulls];
    const className = hull.className === "TBD" ? "" : `${hull.className} `;
    const name = `${className}${hull.role} · Size ${hull.size}`;
    const data = prepareConsole(entry.data);
    data.description = name;
    // Preserve historical label identity for existing exported ships.
    return {...entry, name, data};
  }),
  ...charterTemplates(),
];
