import gunshipProfile from "./hullProfiles/hierarchy_gunship.json";
import content from "../charter/content.json";
import weapons from "../core/library/main_weapons.json";
import { parseShipDocument, SystemSchema, type Ship } from "../core/schema";

export const statsPending = (rules?: string) => /(?:profile|stats) pending/i.test(rules ?? "");

// These hulls have Charter fittings but no authored console stats yet. Keep the
// fitting lists in their existing source; do not introduce a second roster.
export function charterTemplates(): { id: string; name: string; data: Ship }[] {
  return Object.entries(content.slotLayouts).map(([hullId, slots]) => {
    const hull = content.hulls[hullId as keyof typeof content.hulls];
    const id = hullId.replace(/^hull:/, "");
    const profile = id === "hierarchy_gunship" ? gunshipProfile : undefined;
    const sections: Ship["sections"] = { left: [], core: [], right: [] };
    for (const slot of slots) {
      for (const location of slot.locations) {
        const side = /^left/i.test(location) ? "left" : /^right/i.test(location) ? "right" : "core";
        sections[side].push({kind: "slot", label: slot.name, selectedIndex: null,
          options: slot.options.map(name => {
            // Reuse only the explicitly shared weapon profile, never a similarly
            // named hull-specific cargo/effector profile with unconfirmed stats.
            const variant = profile?.weaponOptions as Record<string,unknown> | undefined;
            const known = slot.name === "Weapon" ? variant?.[name] ?? Object.values(weapons).find(w => w.name === name) : (profile?.systemOptions as Record<string,unknown> | undefined)?.[name];
            return SystemSchema.parse(known ?? { kind: "generic", name,
              rules: name === "Hull" ? "" : "Stats pending.",
              weapon: slot.name === "Weapon", areas: [] });
          })});
      }
    }
    if (profile) {
      for (const refs of Object.values(sections)) for (const ref of refs) {
        if (ref.kind !== "slot") continue;
        const selected = (profile.selectedOptions as Record<string,string>)[ref.label];
        const index = ref.options.findIndex(option => option.name === selected);
        if (index >= 0) ref.selectedIndex = index;
      }
      sections.core.unshift({kind: "system", system: SystemSchema.parse(profile.bridge)});
      sections.core.push({kind: "system", system: SystemSchema.parse(profile.engine)});
    }
    const className = hull.className === "TBD" ? "" : `${hull.className} `;
    const name = `${className}${hull.role} · Size ${hull.size}`;
    return { id, name, data: parseShipDocument({ name: "Unnamed Ship", label: name,
      presetId: id, description: name,
      shields: profile?.shields ?? {name: "Shields", rules: "Stats pending.", front: [], rear: []},
      reactor: profile?.reactor ?? {name: "Reactor", rules: "Stats pending.", circles: 0},
      quarters: profile?.quarters ?? {name: "Quarters", rules: "Stats pending.", med_bay: 0}, sections }) };
  });
}

// Short, printable notes without changing the Charter's catalog fingerprint.
export function prepareConsole(raw: unknown): Ship {
  const ship = parseShipDocument(raw);
  for (const refs of Object.values(ship.sections)) for (const ref of refs) {
    for (const system of ref.kind === "slot" ? ref.options : [ref.system]) {
      if (statsPending(system.rules)) system.rules = "Stats pending.";
    }
  }
  return ship;
}
