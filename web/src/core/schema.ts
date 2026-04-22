import { z } from "zod";

/**
 * Single source of truth for ship + system data. Shared by the renderer and
 * by both editor modes (user slot picker / developer full editor).
 *
 * Ported from the ad-hoc JSON shape used by the Python tool, with two
 * intentional differences:
 *
 *   1. Slots are a first-class concept via a discriminated `SystemRef`
 *      union (`{ kind: "system", system }` or `{ kind: "slot", allowed,
 *      selectedId }`). Existing JSON with inline systems is migrated by
 *      {@link migrateShip} automatically.
 *
 *   2. The special systems (Mess, Reactor, Engine) are identified by a
 *      `kind` discriminator instead of matching on `system.name.toLowerCase()`
 *      as `python/src/system.py` does. {@link migrateShip} translates the
 *      legacy name match into an explicit kind.
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
 * Shields are treated as a first-class system so they can be referenced by a
 * slot, picked from the library, and edited through the same inspector as
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
 * A slot is a placeholder that can hold any system from a library, restricted
 * to an `allowed` list of library IDs. `selectedId = null` means empty.
 */
export const SlotSchema = z.object({
  kind: z.literal("slot"),
  label: z.string().optional(),
  allowed: z.array(z.string()),
  selectedId: z.string().nullable().default(null),
});
export type Slot = z.infer<typeof SlotSchema>;

/** Either an inline system or a slot reference into the library. */
export const SystemRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("system"), system: SystemSchema }),
  SlotSchema,
]);
export type SystemRef = z.infer<typeof SystemRefSchema>;

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

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

const KNOWN_KINDS: readonly System["kind"][] = [
  "generic",
  "mess",
  "reactor",
  "engine",
  "shields",
];

/**
 * Resolve the `kind` discriminator for a legacy system object that uses
 * name-matching (python/src/system.py lines 445, 456, 460). Preserves an
 * explicit `kind` if the raw already has one we recognize.
 */
function inferSystemKind(raw: any): System["kind"] {
  if (raw?.kind && KNOWN_KINDS.includes(raw.kind)) return raw.kind;
  const name = String(raw?.name ?? "").toLowerCase();
  if (name === "mess") return "mess";
  if (name === "reactor") return "reactor";
  if (name === "engine") return "engine";
  if (name === "shields") return "shields";
  return "generic";
}

/**
 * Transform a legacy (pre-slot) system object into the schema shape.
 * Adds missing defaults and the `kind` field.
 */
function migrateSystem(raw: any): System {
  const kind = inferSystemKind(raw);
  const base: any = {
    kind,
    name: raw?.name ?? (kind === "shields" ? "Shields" : ""),
    rules: raw?.rules ?? "",
    areas: Array.isArray(raw?.areas) ? raw.areas : [],
    weapon: !!raw?.weapon,
    main: !!raw?.main,
    hull: !!raw?.hull,
    electronics: !!raw?.electronics,
    life_support: !!raw?.life_support,
  };
  if (kind === "mess") base.med_bay = raw?.med_bay ?? 0;
  if (kind === "reactor") base.circles = raw?.circles ?? 0;
  if (kind === "engine") base.speed_slots = raw?.speed_slots ?? [];
  if (kind === "shields") {
    base.front = Array.isArray(raw?.front) ? raw.front : [];
    base.rear = Array.isArray(raw?.rear) ? raw.rear : [];
  }
  return SystemSchema.parse(base);
}

/** Wrap a legacy inline system in a SystemRef if it isn't already one. */
function migrateSystemRef(raw: any): SystemRef {
  if (raw && typeof raw === "object" && raw.kind === "slot") {
    return SlotSchema.parse(raw);
  }
  if (raw && typeof raw === "object" && raw.kind === "system" && raw.system) {
    return { kind: "system", system: migrateSystem(raw.system) };
  }
  return { kind: "system", system: migrateSystem(raw) };
}

/**
 * Migrate the ship's `shields` field, which has seen three shapes:
 *   1. Legacy: `{ front: [...], rear: [...] }`                    (python ships)
 *   2. v1:     `{ kind: "shields", value: { front, rear } }`      (first pass)
 *   3. v2:     SystemRef around a shields-kind system             (current)
 * Returns the v2 SystemRef either way.
 */
function migrateShieldsRef(raw: any): SystemRef {
  if (raw && typeof raw === "object") {
    if (raw.kind === "slot") return SlotSchema.parse(raw);
    if (raw.kind === "system" && raw.system) {
      return { kind: "system", system: migrateSystem(raw.system) };
    }
    if (raw.kind === "shields" && raw.value) {
      return {
        kind: "system",
        system: migrateSystem({
          kind: "shields",
          name: "Shields",
          front: raw.value.front,
          rear: raw.value.rear,
        }),
      };
    }
  }
  return {
    kind: "system",
    system: migrateSystem({
      kind: "shields",
      name: "Shields",
      front: Array.isArray(raw?.front) ? raw.front : [],
      rear: Array.isArray(raw?.rear) ? raw.rear : [],
    }),
  };
}

/**
 * Parse a ship JSON that may be in the legacy (pre-slot, name-matched) shape
 * OR the new schema shape. Returns a validated {@link Ship} either way.
 */
export function migrateShip(raw: any): Ship {
  const sections = raw?.sections ?? {};
  const migrated: any = {
    name: raw?.name ?? raw?.title ?? "Unnamed Ship",
    description: raw?.description ?? raw?.subtitle ?? "",
    label: raw?.label ?? "",
    overdrive: Array.isArray(raw?.overdrive) ? raw.overdrive : [],
    control: Number(raw?.control ?? 0),
    shields: migrateShieldsRef(raw?.shields),
    reactor: migrateSystemRef(raw?.reactor),
    mess: migrateSystemRef(raw?.mess),
    sections: {
      left: (sections.left ?? []).map(migrateSystemRef),
      core: (sections.core ?? []).map(migrateSystemRef),
      right: (sections.right ?? []).map(migrateSystemRef),
    },
  };
  return ShipSchema.parse(migrated);
}

// ---------------------------------------------------------------------------
// Library (premade systems available to slots)
// ---------------------------------------------------------------------------

/** Runtime-validated library shape: `{ [id]: System }`. */
export const SystemLibrarySchema = z.record(z.string(), SystemSchema);
export type SystemLibrary = z.infer<typeof SystemLibrarySchema>;

/**
 * Resolve a SystemRef into a concrete System, using the library to look up
 * selected slot IDs. Returns null for an empty slot (caller draws a
 * placeholder).
 */
export function resolveRef(ref: SystemRef, library: SystemLibrary): System | null {
  if (ref.kind === "system") return ref.system;
  if (ref.selectedId == null) return null;
  return library[ref.selectedId] ?? null;
}
