/**
 * Verify that every preset in `web/src/presets/*.json` parses as a 0.1 ship
 * document, and that merged `web/src/core/library/*.json` passes the system
 * library schema.
 *
 * Run from the `web/` folder:
 *   npx tsx scripts/verify-ships.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mergeSystemLibraries,
  parseShipDocument,
  SystemLibrarySchema,
  type SystemLibrary,
} from "../src/core/schema";

const here = dirname(fileURLToPath(import.meta.url));
const presetsDir = resolve(here, "..", "src", "presets");
const libraryDir = resolve(here, "..", "src", "core", "library");

let anyFail = false;

const libraryJsonFiles = readdirSync(libraryDir).filter((f) => f.endsWith(".json"));
try {
  const parts: SystemLibrary[] = [];
  for (const f of libraryJsonFiles) {
    const raw = JSON.parse(
      readFileSync(join(libraryDir, f), "utf-8")
    ) as unknown;
    parts.push(SystemLibrarySchema.parse(raw));
  }
  const lib = parts.length > 0 ? mergeSystemLibraries(...parts) : {};
  console.log(
    `library: ok (${Object.keys(lib).length} systems from ${libraryJsonFiles.length} file(s))`
  );
} catch (e: any) {
  anyFail = true;
  console.error(`library: FAIL`);
  console.error(e?.message ?? e?.errors ?? e);
}

function verifyPresets(): void {
  const jsonFiles = readdirSync(presetsDir).filter((f) => f.endsWith(".json"));
  for (const file of jsonFiles) {
    const path = resolve(presetsDir, file);
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const ship = parseShipDocument(raw);
      const sections = ship.sections;
      const total =
        sections.left.length + sections.core.length + sections.right.length;
      console.log(`presets/${file}: ok (${total} systems)`);
    } catch (e: any) {
      anyFail = true;
      console.error(`presets/${file}: FAIL`);
      console.error(e?.errors ?? e?.message ?? e);
    }
  }
}

verifyPresets();

if (anyFail) {
  process.exit(1);
}
