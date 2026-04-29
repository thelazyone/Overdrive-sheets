import { z } from "zod";

/**
 * Ship + system schema for **Overdrive Sheets 0.1** (web).
 *
 * - {@link SystemRef}: inline `{ kind: "system", system }` or `{ kind: "slot",
 *   options }` (optional `selectedIndex` for live web preview only; preset JSON
 *   omits it so installs start empty).
 * - {@link parseShipDocument} is the only entry point for loaded JSON.
 * - Optional on-disk {@link SystemLibrary} is for the editor’s “clone from
 *   library” helper only, not for resolving slots at runtime.
 */

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

export const CostSchema = z
  .object({
    energy: z.number().int().nonnegative().optional(),
    crew: z.number().int().nonnegative().optional(),
  })
  .default({});
export type Cost = z.infer<typeof CostSchema>;

export const ShootSchema = z.object({
  damage: z.number().int(),
  range: z.union([z.string(), z.number()]),
  "arc-start": z.number().int().min(0).max(8).optional(),
  "arc-end": z.number().int().min(0).max(8).optional(),
});
export type Shoot = z.infer<typeof ShootSchema>;

export const EngineActionSchema = z.object({
  speed: z.union([z.string(), z.number()]),
  steer: z.string().optional(),
});
export type EngineAction = z.infer<typeof EngineActionSchema>;

/**
 * An action (a.k.a. "area") performed from a system. Matches the existing
 * JSON shape: optional name + description, plus one of `shoot`/`engine`,
 * plus a cost block.
 */
export const AreaSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  shoot: ShootSchema.optional(),
  engine: EngineActionSchema.optional(),
  cost: CostSchema,
});
export type Area = z.infer<typeof AreaSchema>;

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------

export const SpeedSlotSchema = z.object({
  speed: z.union([z.string(), z.number()]),
  rotation: z.string(),
});
export type SpeedSlot = z.infer<typeof SpeedSlotSchema>;

/** Fields common to every system kind. */
const SystemBaseSchema = z.object({
  name: z.string(),
  rules: z.string().optional(),
  areas: z.array(AreaSchema).default([]),
  // Top-left chevron flags
  weapon: z.boolean().default(false),
  main: z.boolean().default(false),
  // Bottom-right chevron flags
  hull: z.boolean().default(false),
  electronics: z.boolean().default(false),
  life_support: z.boolean().default(false),
});

export const GenericSystemSchema = SystemBaseSchema.extend({
  kind: z.literal("generic"),
});
export type GenericSystem = z.infer<typeof GenericSystemSchema>;

export const MessSystemSchema = SystemBaseSchema.extend({
  kind: z.literal("mess"),
  med_bay: z.number().int().nonnegative().default(0),
});
export type MessSystem = z.infer<typeof MessSystemSchema>;

export const ReactorSystemSchema = SystemBaseSchema.extend({
  kind: z.literal("reactor"),
  circles: z.number().int().nonnegative().default(0),
});
export type ReactorSystem = z.infer<typeof ReactorSystemSchema>;

export const EngineSystemSchema = SystemBaseSchema.extend({
  kind: z.literal("engine"),
  speed_slots: z.array(SpeedSlotSchema).default([]),
});
export type EngineSystem = z.infer<typeof EngineSystemSchema>;

/**
 * Shields are treated as a first-class system so they can live in a slot
 * (as duplicated options) or inline, and edited through the same inspector as
 * any other system.
 *
 * `front` / `rear` store the shield "column" values (see shields.py): each
 * number N produces a row of N blue slot icons followed by one energy icon.
 */
export const ShieldsSystemSchema = SystemBaseSchema.extend({
  kind: z.literal("shields"),
  front: z.array(z.number().int().nonnegative()).default([]),
  rear: z.array(z.number().int().nonnegative()).default([]),
});
export type ShieldsSystem = z.infer<typeof ShieldsSystemSchema>;

export const SystemSchema = z.discriminatedUnion("kind", [
  GenericSystemSchema,
  MessSystemSchema,
  ReactorSystemSchema,
  EngineSystemSchema,
  ShieldsSystemSchema,
]);
export type System = z.infer<typeof SystemSchema>;

// ---------------------------------------------------------------------------
// Slot / inline-system reference
// ---------------------------------------------------------------------------

/**
 * A slot lists full {@link System} copies (preset templates). Preset JSON usually
 * omits `selectedIndex` (defaults to null); the web app may set it for preview.
 * `label` is editor-only metadata (shown in the web UI); exported flat ship JSON
 * omits slot objects.
 */
export const SlotSchema = z.object({
  kind: z.literal("slot"),
  /** Short name for this slot in the editor (e.g. "Weapon"). */
  label: z.string().default(""),
  options: z.array(SystemSchema).default([]),
  selectedIndex: z.number().int().min(0).nullable().default(null),
});
export type Slot = z.infer<typeof SlotSchema>;

function normalizeSlot(s: Slot): Slot {
  const n = s.options.length;
  let idx = s.selectedIndex;
  if (n === 0) idx = null;
  else if (idx != null && (idx < 0 || idx >= n)) idx = null;
  return { ...s, selectedIndex: idx };
}

/** Either an inline system or a slot holding duplicated system options. */
export const SystemRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("system"), system: SystemSchema }),
  SlotSchema,
]);
export type SystemRef = z.infer<typeof SystemRefSchema>;

/**
 * Dashed-box text on the ship SVG when {@link resolveRef} returns null (e.g. no
 * option picked for a slot). Uses the slot’s `label` when set.
 */
export function placeholderTextForUnresolvedRef(ref: SystemRef): string {
  if (ref.kind === "slot") {
    const t = ref.label.trim();
    if (t) {
      const u = t.toUpperCase();
      return u.length > 22 ? `${u.slice(0, 20)}…` : u;
    }
    return "SLOT";
  }
  return "EMPTY";
}

// ---------------------------------------------------------------------------
// Ship
// ---------------------------------------------------------------------------

export const ShipSchema = z.object({
  /** The ship's in-game name, shown at the top of the sheet. Templates ship
   *  this as e.g. "Unnamed Ship" so users rename their instance. */
  name: z.string().default("Unnamed Ship"),
  /** Short text shown below the name on the sheet (e.g. ship class). */
  description: z.string().default(""),
  /** Human-readable template name shown in the preset dropdown; optional. */
  label: z.string().default(""),
  overdrive: z.array(z.number().int()).default([]),
  control: z.number().int().default(0),
  shields: SystemRefSchema,
  reactor: SystemRefSchema,
  mess: SystemRefSchema,
  sections: z.object({
    left: z.array(SystemRefSchema).default([]),
    core: z.array(SystemRefSchema).default([]),
    right: z.array(SystemRefSchema).default([]),
  }),
});
export type Ship = z.infer<typeof ShipSchema>;

export function cloneSystem(system: System): System {
  return SystemSchema.parse(JSON.parse(JSON.stringify(system)));
}

function normalizeShipRefs(ship: Ship): Ship {
  const norm = (r: SystemRef): SystemRef =>
    r.kind === "slot" ? normalizeSlot(r) : r;
  return {
    ...ship,
    shields: norm(ship.shields),
    reactor: norm(ship.reactor),
    mess: norm(ship.mess),
    sections: {
      left: ship.sections.left.map(norm),
      core: ship.sections.core.map(norm),
      right: ship.sections.right.map(norm),
    },
  };
}

/** Values of {@link System.kind} — distinct from {@link SystemRef.kind}. */
const BARE_SYSTEM_KINDS = new Set<string>([
  "generic",
  "mess",
  "reactor",
  "engine",
  "shields",
]);

function isSystemRefDiscriminator(kind: unknown): boolean {
  return kind === "system" || kind === "slot";
}

/**
 * {@link exportShipDocument} flattens each {@link SystemRef} to a bare
 * {@link System} (`kind: "mess"` …). Parsed ships in the editor must be
 * `{ kind: "system", system }` or `{ kind: "slot", … }`; wrap legacy flat blobs.
 */
function coerceSystemRefFromImport(val: unknown): unknown {
  if (val == null || typeof val !== "object" || Array.isArray(val)) return val;
  const o = val as Record<string, unknown>;
  if (isSystemRefDiscriminator(o.kind)) return val;
  if (typeof o.kind === "string" && BARE_SYSTEM_KINDS.has(o.kind)) {
    return { kind: "system", system: val };
  }
  return val;
}

function coerceImportedShipShape(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of ["shields", "reactor", "mess"] as const) {
    if (key in out) out[key] = coerceSystemRefFromImport(out[key]);
  }
  const sections = out.sections;
  if (sections != null && typeof sections === "object" && !Array.isArray(sections)) {
    const sec = sections as Record<string, unknown>;
    const nextSec: Record<string, unknown> = { ...sec };
    for (const side of ["left", "core", "right"] as const) {
      const arr = nextSec[side];
      if (Array.isArray(arr)) {
        nextSec[side] = arr.map((item) => coerceSystemRefFromImport(item));
      }
    }
    out.sections = nextSec;
  }
  return out;
}

/**
 * Parse and validate ship JSON. Unknown top-level keys (e.g. old tooling
 * fields) are stripped by Zod. Coerces out-of-range slot `selectedIndex` to
 * `null`. Accepts flattened exports ({@link exportShipDocument}) where each ref
 * is a bare {@link System}.
 */
export function parseShipDocument(raw: unknown): Ship {
  const base =
    raw == null || typeof raw !== "object" || Array.isArray(raw)
      ? {}
      : (raw as Record<string, unknown>);
  const coerced = coerceImportedShipShape(base);
  return normalizeShipRefs(ShipSchema.parse(coerced));
}

// ---------------------------------------------------------------------------
// Library (editor: clone premade systems into a slot)
// ---------------------------------------------------------------------------

/** Runtime-validated library shape: `{ [id]: System }`. */
export const SystemLibrarySchema = z.record(z.string(), SystemSchema);
export type SystemLibrary = z.infer<typeof SystemLibrarySchema>;

/**
 * Merges multiple library objects (e.g. several JSON files). Throws if the same
 * id appears in more than one part.
 */
export function mergeSystemLibraries(...parts: SystemLibrary[]): SystemLibrary {
  const out: Record<string, System> = {};
  for (const p of parts) {
    for (const id of Object.keys(p)) {
      if (id in out) {
        throw new Error(
          `Duplicate system id "${id}" when merging system libraries.`
        );
      }
      out[id] = p[id]!;
    }
  }
  return out as SystemLibrary;
}

/**
 * Resolve a SystemRef into a concrete System. Slots use `options[selectedIndex]`.
 * Returns null when nothing is selected (caller draws a placeholder).
 */
export function resolveRef(ref: SystemRef): System | null {
  if (ref.kind === "system") return ref.system;
  const idx = ref.selectedIndex;
  if (idx == null || idx < 0 || idx >= ref.options.length) return null;
  return ref.options[idx] ?? null;
}

const EMPTY_SLOT_PLACEHOLDER = SystemSchema.parse({
  kind: "generic",
  name: "(empty slot)",
  rules: "",
  areas: [],
  weapon: false,
  main: false,
  hull: false,
  electronics: false,
  life_support: false,
});

/** Inline refs to {@link System}; empty slots become a placeholder row. */
export function flattenSystemRefForExport(ref: SystemRef): System {
  if (ref.kind === "system") {
    return cloneSystem(ref.system);
  }
  const resolved = resolveRef(ref);
  if (resolved) return cloneSystem(resolved);
  return cloneSystem(EMPTY_SLOT_PLACEHOLDER);
}

/** Flattened ship JSON (no slot objects). */
export function exportShipDocument(ship: Ship): Record<string, unknown> {
  return {
    name: ship.name,
    description: ship.description,
    label: ship.label,
    overdrive: ship.overdrive,
    control: ship.control,
    shields: flattenSystemRefForExport(ship.shields),
    reactor: flattenSystemRefForExport(ship.reactor),
    mess: flattenSystemRefForExport(ship.mess),
    sections: {
      left: ship.sections.left.map((r) => flattenSystemRefForExport(r)),
      core: ship.sections.core.map((r) => flattenSystemRefForExport(r)),
      right: ship.sections.right.map((r) => flattenSystemRefForExport(r)),
    },
  };
}

/** Fleet JSON uses this `format` value so imports can distinguish multi-ship files. */
export const FLEET_DOCUMENT_FORMAT = "overdrive-sheets-fleet" as const;

/**
 * Export one or more ships for download.
 * Single ship stays the legacy flat document for compatibility with older tooling.
 * Multiple ships wrap flattened ships in `{ format, version, ships }`.
 */
export function exportShipsDocument(ships: Ship[]): Record<string, unknown> {
  if (ships.length === 1) {
    return exportShipDocument(ships[0]!);
  }
  return {
    format: FLEET_DOCUMENT_FORMAT,
    version: 1,
    ships: ships.map((s) => exportShipDocument(s)),
  };
}

/**
 * Fleet editor export: always `{ format, version, ships: [...] }`, even for one ship.
 */
export function exportFleetDocument(ships: Ship[]): Record<string, unknown> {
  if (ships.length === 0) {
    throw new Error("Cannot export an empty fleet.");
  }
  return {
    format: FLEET_DOCUMENT_FORMAT,
    version: 1,
    ships: ships.map((s) => exportShipDocument(s)),
  };
}

/**
 * Parse uploaded JSON into one or more ships.
 * Accepts legacy flat ship JSON or `{ ships: [ … ] }` fleet documents.
 */
export function parseShipsFromImport(raw: unknown): Ship[] {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.ships)) {
      const arr = o.ships as unknown[];
      if (arr.length === 0) {
        throw new Error('Fleet document has an empty "ships" array.');
      }
      return arr.map((s) => parseShipDocument(s));
    }
  }
  return [parseShipDocument(raw)];
}
