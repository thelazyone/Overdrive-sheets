import {
  SystemLibrarySchema,
  mergeSystemLibraries,
  type SystemLibrary,
} from "../schema";

/**
 * Merges every `*.json` in this directory into one library. Add new top-level
 * files (e.g. `other_faction.json`) to share more systems. The editor can
 * clone library entries into a slot as ship-local copies.
 */
export function loadBaseLibraryFromModules(): SystemLibrary {
  const modules = import.meta.glob<string>("./*.json", {
    eager: true,
    import: "default",
  });
  const parts: SystemLibrary[] = [];
  for (const [path, raw] of Object.entries(modules)) {
    if (path.includes("/node_modules/")) continue;
    const parsed = SystemLibrarySchema.parse(raw as any);
    parts.push(parsed);
  }
  return parts.length > 0 ? mergeSystemLibraries(...parts) : {};
}

export const baseLibrary: SystemLibrary = loadBaseLibraryFromModules();
