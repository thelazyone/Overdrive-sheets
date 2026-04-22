/**
 * Verify that every preset in `web/src/presets/*.json`, plus every legacy
 * `python/ships/*.json`, parses through the migration layer and the Zod
 * schema, and that every library entry passes the System schema.
 *
 * Run from the `web/` folder:
 *   npx tsx scripts/verify-ships.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { migrateShip, SystemLibrarySchema } from "../src/core/schema";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const legacyShipsDir = resolve(repoRoot, "python", "ships");
const presetsDir = resolve(here, "..", "src", "presets");

let anyFail = false;

const libraryRaw = JSON.parse(
  readFileSync(resolve(here, "..", "src", "core", "library", "systems.json"), "utf-8")
);
try {
  const lib = SystemLibrarySchema.parse(libraryRaw);
  console.log(`library: ok (${Object.keys(lib).length} systems)`);
} catch (e: any) {
  anyFail = true;
  console.error(`library: FAIL`);
  console.error(e?.errors ?? e);
}

function verifyDir(label: string, dir: string): void {
  const jsonFiles = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of jsonFiles) {
    const path = resolve(dir, file);
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const ship = migrateShip(raw);
      const sections = ship.sections;
      const total =
        sections.left.length + sections.core.length + sections.right.length;
      console.log(`${label}/${file}: ok (${total} systems)`);
    } catch (e: any) {
      anyFail = true;
      console.error(`${label}/${file}: FAIL`);
      console.error(e?.errors ?? e?.message ?? e);
    }
  }
}

verifyDir("presets", presetsDir);
verifyDir("python/ships", legacyShipsDir);

if (anyFail) {
  process.exit(1);
}
