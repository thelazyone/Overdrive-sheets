/**
 * Two-pane editor shell.
 *
 * Left pane:
 *   - Ship `name` (always editable — templates are meant to be renamed).
 *   - Customize toggle.
 *   - In customize mode: `description`, `label`, `overdrive`, `control` also
 *     editable.
 *   - Section list (LEFT / CORE / RIGHT + reactor/mess/shields). Each slot
 *     row carries an inline `<select>` to pick which duplicated option is
 *     installed.
 *   - Inspector panel below the list — visible only in customize mode:
 *       - Slot row   → list of system options (add / remove / duplicate / edit).
 *       - Inline row → full system fields editor (name, rules, areas, etc.).
 *
 * Right pane: live <ShipSVG /> preview.
 *
 * All state is driven by a single `ship` signal; both panes read it via the
 * same {@link resolveRef}, so the preview and list can never get out of sync.
 *
 * Important Solid gotcha: do NOT name any prop `ref` on a component - Solid
 * treats `ref={}` as its DOM-ref-forwarding special attribute. Every
 * system-reference prop below is named `sysRef`.
 */

import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type JSX,
} from "solid-js";
import {
  cloneSystem,
  exportShipDocument,
  parseShipDocument,
  resolveRef,
  SystemSchema,
  type Area,
  type Ship,
  type System,
  type SystemRef,
} from "./core/schema";
import { baseLibrary } from "./core/library/loadBaseLibrary";
import { ShipLibraryProvider, useShipLibrary } from "./core/shipLibraryContext";
import { ShipSVG } from "./core/render/ShipSVG";
import { waitForFonts } from "./core/render/measure";
import { SHEET_HEIGHT, SHEET_WIDTH } from "./core/render/constants";
import { DEFAULT_PRESET_ID, PRESETS } from "./presets";

export function App(): JSX.Element {
  const [fontsReady] = createResource(async () => {
    await waitForFonts();
    return true;
  });

  const [ship, setShip] = createSignal<Ship>(
    parseShipDocument(
      (PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ?? PRESETS[0]).data,
    ),
  );
  const [presetId, setPresetId] = createSignal<string>(DEFAULT_PRESET_ID);
  const [selected, setSelected] = createSignal<string | null>(null);
  const [customize, setCustomize] = createSignal<boolean>(false);
  const [error, setError] = createSignal<string | null>(null);

  const applyPreset = (id: string) => {
    try {
      const entry = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
      setShip(parseShipDocument(entry.data));
      setSelected(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  createEffect(() => {
    applyPreset(presetId());
  });

  const onReloadPreset = () => applyPreset(presetId());

  const onUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        setShip(parseShipDocument(raw));
        setSelected(null);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    };
    reader.readAsText(file);
    input.value = "";
  };

  const onDownloadJSON = () => {
    const s = ship();
    const flat = exportShipDocument(s);
    const blob = new Blob([JSON.stringify(flat, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, slugify(s.name) + ".json");
  };

  const onDownloadPNG = async () => {
    const s = ship();
    const svgEl = document.querySelector(".ship-preview-wrapper svg") as SVGSVGElement | null;
    if (!svgEl) return;
    await exportSvgAsPng(svgEl, SHEET_WIDTH, SHEET_HEIGHT, slugify(s.name) + ".png");
  };

  const selection = (): { path: string; sysRef: SystemRef } | null => {
    const path = selected();
    if (!path) return null;
    const sysRef = getRefByPath(ship(), path);
    return sysRef ? { path, sysRef } : null;
  };

  // Clicking a row only selects it for the inspector in customize mode. In
  // default mode, slots are picked directly via the inline dropdown in the
  // row and inline systems are not interactive.
  const onRowClick = (path: string, _sysRef: SystemRef) => {
    if (!customize()) return;
    setSelected((cur) => (cur === path ? null : path));
  };

  return (
    <ShipLibraryProvider value={() => baseLibrary}>
    <div class="app">
      <div class="pane left-pane">
        <div class="toolbar">
          <div class="toolbar-row toolbar-title-row">
            <h1>Overdrive Sheets</h1>
            <button
              type="button"
              classList={{ "mode-toggle": true, active: customize() }}
              onClick={() => setCustomize((c) => !c)}
              title="Toggle customize mode"
            >
              {customize() ? "Customize: ON" : "Customize: off"}
            </button>
          </div>
          <div class="toolbar-row toolbar-template-row">
            <label for="preset-select" class="toolbar-label">Template</label>
            <select
              id="preset-select"
              value={presetId()}
              onChange={(e) => setPresetId(e.currentTarget.value)}
              title="Load preset"
            >
              <For each={PRESETS}>{(p) => <option value={p.id}>{p.name}</option>}</For>
            </select>
            <button
              type="button"
              class="btn-icon"
              onClick={onReloadPreset}
              title="Reload template (discards customizations)"
            >
              Reload
            </button>
          </div>
          <div class="toolbar-row toolbar-io-row">
            <label class="btn">
              Upload JSON
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={onUpload}
              />
            </label>
            <button type="button" onClick={onDownloadJSON}>Download JSON</button>
            <button type="button" onClick={onDownloadPNG}>Download PNG</button>
          </div>
        </div>

        <Show when={error()}>
          <div class="error-banner">{error()}</div>
        </Show>

        <ShipHeaderEditor
          ship={ship()}
          customize={customize()}
          onChange={(patch) => setShip((s) => ({ ...s, ...patch }))}
        />

        <div
          class="section-list"
          classList={{ "section-list-expanded": !customize() }}
        >
          <SectionList
            ship={ship()}
            customize={customize()}
            selected={selected()}
            onSelect={onRowClick}
            onShip={(fn) => setShip(fn)}
          />
        </div>

        <Show when={customize()}>
          <div class="inspector">
            <Show
              when={selection()}
              fallback={
                <div class="inspector-empty">
                  Select any row to edit its details.
                </div>
              }
            >
              {(sel) => (
                <Inspector
                  path={sel().path}
                  sysRef={sel().sysRef}
                  customize={customize()}
                  onShip={(fn) => setShip(fn)}
                />
              )}
            </Show>
          </div>
        </Show>
      </div>

      <div class="pane right-pane">
        <div class="ship-preview-wrapper">
          <Show when={fontsReady()}>
            <ShipSVG ship={ship()} responsive />
          </Show>
        </div>
      </div>
    </div>
    </ShipLibraryProvider>
  );
}

// ---------------------------------------------------------------------------
// Ship-level editor (name always, rest only in customize mode)
// ---------------------------------------------------------------------------

function ShipHeaderEditor(props: {
  ship: Ship;
  customize: boolean;
  onChange: (patch: Partial<Ship>) => void;
}) {
  return (
    <div class="ship-header">
      <label class="field">
        <span class="field-label">Name</span>
        <input
          type="text"
          value={props.ship.name}
          onInput={(e) => props.onChange({ name: e.currentTarget.value })}
        />
      </label>

      <Show when={props.customize}>
        <label class="field">
          <span class="field-label">Description</span>
          <input
            type="text"
            value={props.ship.description}
            onInput={(e) =>
              props.onChange({ description: e.currentTarget.value })
            }
          />
        </label>

        <label class="field">
          <span class="field-label">Template label (dropdown)</span>
          <input
            type="text"
            value={props.ship.label}
            onInput={(e) => props.onChange({ label: e.currentTarget.value })}
          />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Control</span>
            <input
              type="number"
              min="0"
              value={props.ship.control}
              onInput={(e) =>
                props.onChange({ control: Number(e.currentTarget.value) || 0 })
              }
            />
          </label>

          <label class="field field-grow">
            <span class="field-label">Overdrive (comma-separated)</span>
            <input
              type="text"
              value={props.ship.overdrive.join(", ")}
              onChange={(e) =>
                props.onChange({
                  overdrive: parseNumberList(e.currentTarget.value),
                })
              }
            />
          </label>
        </div>
      </Show>
    </div>
  );
}

function parseNumberList(s: string): number[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
}

// ---------------------------------------------------------------------------
// Section list + rows
// ---------------------------------------------------------------------------

type OnSelect = (path: string, sysRef: SystemRef) => void;

interface SectionListProps {
  ship: Ship;
  customize: boolean;
  selected: string | null;
  onSelect: OnSelect;
  onShip: ShipUpdater;
}

function SectionList(props: SectionListProps) {
  const rowCommon = () => ({
    customize: props.customize,
    selected: props.selected,
    onSelect: props.onSelect,
    onShip: props.onShip,
  });

  return (
    <>
      <SectionGroup
        title="LEFT"
        refs={props.ship.sections.left}
        section="left"
        {...rowCommon()}
      />
      <SectionGroup
        title="CORE"
        refs={props.ship.sections.core}
        section="core"
        {...rowCommon()}
      />
      <SectionGroup
        title="RIGHT"
        refs={props.ship.sections.right}
        section="right"
        {...rowCommon()}
      />
      <div class="section-group">
        <h2>CORE SYSTEMS</h2>
        <SystemRow
          id="ship.reactor"
          sysRef={props.ship.reactor}
          canonicalLabel="Reactor"
          canonicalKind="reactor"
          {...rowCommon()}
        />
        <SystemRow
          id="ship.mess"
          sysRef={props.ship.mess}
          canonicalLabel="Mess"
          canonicalKind="mess"
          {...rowCommon()}
        />
        <SystemRow
          id="ship.shields"
          sysRef={props.ship.shields}
          canonicalLabel="Shields"
          canonicalKind="shields"
          {...rowCommon()}
        />
      </div>
    </>
  );
}

function SectionGroup(props: {
  title: string;
  section: "left" | "core" | "right";
  refs: SystemRef[];
  customize: boolean;
  selected: string | null;
  onSelect: OnSelect;
  onShip: ShipUpdater;
}) {
  return (
    <div class="section-group">
      <h2>{props.title}</h2>
      <For each={props.refs}>
        {(r, i) => (
          <SystemRow
            id={`sections.${props.section}[${i()}]`}
            sysRef={r}
            customize={props.customize}
            selected={props.selected}
            onSelect={props.onSelect}
            onShip={props.onShip}
          />
        )}
      </For>
      <Show when={props.refs.length === 0}>
        <div class="system-row"><span class="empty">(empty)</span></div>
      </Show>
    </div>
  );
}

/** Infer a "kind hint" for an empty slot from the first listed option. */
function inferSlotKind(sysRef: SystemRef): System["kind"] | null {
  if (sysRef.kind !== "slot") return null;
  const first = sysRef.options[0];
  return first ? first.kind : null;
}

function SystemRow(props: {
  id: string;
  sysRef: SystemRef;
  customize: boolean;
  selected: string | null;
  onSelect: OnSelect;
  onShip: ShipUpdater;
  /** Canonical label (e.g. "Reactor") forced for the three core-system rows;
   *  when set, the displayed label always starts with this, regardless of
   *  the resolved system's name. */
  canonicalLabel?: string;
  /** Canonical kind used for the badge when the slot is empty and we can't
   *  infer from listed options. */
  canonicalKind?: System["kind"];
}) {
  const resolved = () => resolveRef(props.sysRef);
  const isSlot = () => props.sysRef.kind === "slot";
  const isEmptySlot = () => isSlot() && !resolved();
  // Rows are clickable (for inspector selection) only in customize mode.
  // Inline systems are never clickable outside customize mode.
  const isClickable = () => props.customize;

  // Badge shows the system KIND (reactor/mess/shields/engine/generic).
  // Slotness is communicated by the yellow background on the row, not by
  // the word "slot" in the badge.
  const badge = (): string => {
    const r = resolved();
    if (r) return r.kind;
    return inferSlotKind(props.sysRef) ?? props.canonicalKind ?? "slot";
  };

  // Label: prefer a canonical name (for the three core-system rows),
  // otherwise the resolved system name or an empty-slot hint.
  const label = (): string => {
    const r = resolved();
    if (props.canonicalLabel) {
      if (isEmptySlot()) return `${props.canonicalLabel} (unselected)`;
      if (!isSlot()) return `${props.canonicalLabel} (default)`;
      return props.canonicalLabel;
    }
    if (r) return r.name;
    if (props.sysRef.kind === "slot") return "(unselected slot)";
    return "(unnamed)";
  };

  const classes = () =>
    [
      "system-row",
      isSlot() ? "is-slot" : "",
      isEmptySlot() ? "is-empty" : "",
      isClickable() ? "is-clickable" : "is-readonly",
      props.selected === props.id ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const onRowClick = () => {
    if (!isClickable()) return;
    props.onSelect(props.id, props.sysRef);
  };

  const onPick = (value: string) => {
    props.onShip((s) =>
      withSlotSelectedIndex(
        s,
        props.id,
        value === "" ? null : Number(value),
      ),
    );
  };

  return (
    <div class={classes()} onClick={onRowClick}>
      <span class="kind">{badge()}</span>
      <span class="name">{label()}</span>
      <Show when={props.sysRef.kind === "slot" ? props.sysRef : null}>
        {(slot) => (
          <select
            class="row-picker"
            value={
              slot().selectedIndex == null ? "" : String(slot().selectedIndex)
            }
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onPick(e.currentTarget.value);
            }}
            title="Pick installed option"
          >
            <option value="">— none —</option>
            <For each={slot().options}>
              {(sys, i) => (
                <option value={String(i())}>
                  {sys.name || `Option ${i() + 1}`}
                </option>
              )}
            </For>
          </select>
        )}
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector - routes to SlotInspector or InlineEditor based on sysRef.kind.
// Using function-child `<Show>` forms so only the matching branch's component
// is invoked (avoids the eager-fallback trap we hit earlier).
// ---------------------------------------------------------------------------

type ShipUpdater = (fn: (s: Ship) => Ship) => void;

function Inspector(props: {
  path: string;
  sysRef: SystemRef;
  customize: boolean;
  onShip: ShipUpdater;
}) {
  return (
    <>
      <Show when={props.sysRef.kind === "slot" ? props.sysRef : null}>
        {(slot) => (
          <SlotInspector
            path={props.path}
            sysRef={slot()}
            customize={props.customize}
            onShip={props.onShip}
          />
        )}
      </Show>
      <Show when={props.sysRef.kind === "system" ? props.sysRef : null}>
        {(inline) => (
          <InlineInspector
            path={props.path}
            sysRef={inline()}
            customize={props.customize}
            onShip={props.onShip}
          />
        )}
      </Show>
    </>
  );
}

// ---- Slot --------------------------------------------------------------

function SlotInspector(props: {
  path: string;
  sysRef: Extract<SystemRef, { kind: "slot" }>;
  customize: boolean;
  onShip: ShipUpdater;
}) {
  const getLib = useShipLibrary();
  const libraryIdList = createMemo(() => Object.keys(getLib()).sort());
  const [editIdx, setEditIdx] = createSignal<number | null>(null);

  createEffect(() => {
    const s = props.sysRef;
    const n = s.options.length;
    const cur = editIdx();
    if (n === 0) {
      if (cur !== null) setEditIdx(null);
      return;
    }
    if (cur == null || cur < 0 || cur >= n) {
      setEditIdx(0);
    }
  });

  const activeSystem = () => {
    const i = editIdx();
    if (i == null) return null;
    return props.sysRef.options[i] ?? null;
  };

  const patchActive = (next: System) => {
    const i = editIdx();
    if (i == null) return;
    props.onShip((ship) =>
      withRefUpdate(ship, props.path, (r) => {
        if (r.kind !== "slot") return r;
        const options = r.options.map((o, j) => (j === i ? next : o));
        return { ...r, options };
      }),
    );
  };

  const addOptionFromLibrary = (id: string) => {
    if (!id) return;
    const sys = getLib()[id];
    if (!sys) return;
    props.onShip((s) =>
      withRefUpdate(s, props.path, (r) =>
        r.kind === "slot"
          ? { ...r, options: [...r.options, cloneSystem(sys)] }
          : r,
      ),
    );
  };

  const addBlankGeneric = () => {
    const blank = SystemSchema.parse({
      kind: "generic",
      name: "New system",
      rules: "",
      areas: [],
      weapon: false,
      main: false,
      hull: false,
      electronics: false,
      life_support: false,
    });
    props.onShip((s) =>
      withRefUpdate(s, props.path, (r) =>
        r.kind === "slot" ? { ...r, options: [...r.options, blank] } : r,
      ),
    );
  };

  const removeCurrentOption = () => {
    const optIndex = editIdx();
    if (optIndex == null) return;
    props.onShip((s) =>
      withRefUpdate(s, props.path, (r) => {
        if (r.kind !== "slot") return r;
        const options = r.options.filter((_, i) => i !== optIndex);
        let selectedIndex = r.selectedIndex;
        if (selectedIndex === optIndex) selectedIndex = null;
        else if (selectedIndex != null && selectedIndex > optIndex) {
          selectedIndex = selectedIndex - 1;
        }
        return { ...r, options, selectedIndex };
      }),
    );
    setEditIdx((cur) => {
      if (cur == null) return null;
      if (cur === optIndex) return null;
      if (cur > optIndex) return cur - 1;
      return cur;
    });
  };

  const duplicateCurrentOption = () => {
    const optIndex = editIdx();
    if (optIndex == null) return;
    props.onShip((s) =>
      withRefUpdate(s, props.path, (r) => {
        if (r.kind !== "slot") return r;
        const orig = r.options[optIndex];
        if (!orig) return r;
        const copy = cloneSystem(orig);
        const options = [
          ...r.options.slice(0, optIndex + 1),
          copy,
          ...r.options.slice(optIndex + 1),
        ];
        return { ...r, options };
      }),
    );
    setEditIdx((cur) => {
      if (cur == null) return null;
      return cur + 1;
    });
  };

  const optionCount = () => props.sysRef.options.length;
  const selectValue = () => {
    if (optionCount() === 0 || editIdx() == null) return "";
    return String(editIdx());
  };

  return (
    <div class="inspector-body">
      <div class="inspector-header">
        <span class="tag">slot</span>
        <span class="title">Slot</span>
      </div>
      <div class="inspector-note">
        Pick an option below to view or edit. The row picker sets which one is
        installed on the sheet preview.
      </div>

      <label class="field">
        <span class="field-label">Option</span>
        <select
          value={selectValue()}
          disabled={optionCount() === 0}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setEditIdx(v === "" ? null : Number(v));
          }}
        >
          <Show when={optionCount() === 0}>
            <option value="">— No systems in this slot —</option>
          </Show>
          <For each={props.sysRef.options}>
            {(sys, i) => (
              <option value={String(i())}>
                {sys.name || `Option ${i() + 1}`}
              </option>
            )}
          </For>
        </select>
      </label>

      <Show when={props.customize}>
        <div class="inspector-slot-actions add-row">
          <button type="button" class="btn-small" onClick={addBlankGeneric}>
            Add
          </button>
          <button
            type="button"
            class="btn-small"
            disabled={optionCount() === 0}
            onClick={removeCurrentOption}
          >
            Remove
          </button>
          <button
            type="button"
            class="btn-small"
            disabled={optionCount() === 0}
            onClick={duplicateCurrentOption}
          >
            Duplicate
          </button>
          <select
            onChange={(e) => {
              addOptionFromLibrary(e.currentTarget.value);
              e.currentTarget.value = "";
            }}
          >
            <option value="">Add from library…</option>
            <For each={libraryIdList()}>
              {(id) => (
                <option value={id}>
                  {getLib()[id].name} — {id}
                </option>
              )}
            </For>
          </select>
        </div>
      </Show>

      <Show when={activeSystem()}>
        <Show
          when={props.customize}
          fallback={<SystemSummary system={activeSystem()!} />}
        >
          <SystemEditor
            system={activeSystem()!}
            onChange={patchActive}
          />
        </Show>
      </Show>

      <Show when={!activeSystem()}>
        <Show
          when={props.customize}
          fallback={
            <div class="inspector-empty">
              This slot has no system copies yet.
            </div>
          }
        >
          <p class="inspector-hint">
            Use Add or Add from library… to create a system, then edit it below.
          </p>
        </Show>
      </Show>
    </div>
  );
}

// ---- Inline system --------------------------------------------------------

function InlineInspector(props: {
  path: string;
  sysRef: Extract<SystemRef, { kind: "system" }>;
  customize: boolean;
  onShip: ShipUpdater;
}) {
  return (
    <div class="inspector-body">
      <div class="inspector-header">
        <span class="tag tag-inline">inline</span>
        <span class="title">{props.sysRef.system.name || "(unnamed)"}</span>
      </div>
      <Show
        when={props.customize}
        fallback={<SystemSummary system={props.sysRef.system} />}
      >
        <SystemEditor
          system={props.sysRef.system}
          onChange={(s) =>
            props.onShip((ship) =>
              withRefUpdate(ship, props.path, (r) =>
                r.kind === "system" ? { ...r, system: s } : r
              )
            )
          }
        />
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SystemSummary (read-only)
// ---------------------------------------------------------------------------

function SystemSummary(props: { system: System }) {
  return (
    <div class="system-summary">
      <div class="row"><span class="k">kind</span><span class="v">{props.system.kind}</span></div>
      <Show when={props.system.rules}>
        <div class="row"><span class="k">rules</span><span class="v">{props.system.rules}</span></div>
      </Show>
      <div class="row">
        <span class="k">traits</span>
        <span class="v">{traitsText(props.system)}</span>
      </div>
      <Show when={props.system.areas && props.system.areas.length > 0}>
        <div class="areas">
          <div class="k">areas</div>
          <For each={props.system.areas}>
            {(a) => (
              <div class="area">
                <div class="area-title">{a.name || "(unnamed)"}</div>
                <Show when={a.description}>
                  <div class="area-desc">{a.description}</div>
                </Show>
                <Show when={a.shoot}>
                  <div class="area-shoot">
                    dmg {a.shoot!.damage} · range {a.shoot!.range} · arc{" "}
                    {a.shoot!["arc-start"]}→{a.shoot!["arc-end"]}
                  </div>
                </Show>
                <Show when={a.cost}>
                  <div class="area-cost">
                    cost: {a.cost!.energy ?? 0} energy
                    {a.cost!.crew != null ? `, ${a.cost!.crew} crew` : ""}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function traitsText(s: System): string {
  return (
    [
      s.weapon ? "weapon" : null,
      s.electronics ? "electronics" : null,
      s.hull ? "hull" : null,
      s.life_support ? "life-support" : null,
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

// ---------------------------------------------------------------------------
// SystemEditor (customize mode)
// ---------------------------------------------------------------------------

function SystemEditor(props: {
  system: System;
  onChange: (s: System) => void;
}) {
  const patch = (p: Partial<System>) =>
    props.onChange({ ...props.system, ...p } as System);

  const updateArea = (idx: number, next: Area) => {
    const areas = props.system.areas.map((a, i) => (i === idx ? next : a));
    patch({ areas } as Partial<System>);
  };
  const addArea = () => {
    const areas = [
      ...props.system.areas,
      { name: "", description: "", cost: {} } as Area,
    ];
    patch({ areas } as Partial<System>);
  };
  const removeArea = (idx: number) => {
    const areas = props.system.areas.filter((_, i) => i !== idx);
    patch({ areas } as Partial<System>);
  };

  return (
    <div class="system-editor">
      <label class="field">
        <span class="field-label">Name</span>
        <input
          type="text"
          value={props.system.name}
          onInput={(e) => patch({ name: e.currentTarget.value })}
        />
      </label>
      <label class="field">
        <span class="field-label">Rules (short line under name)</span>
        <input
          type="text"
          value={props.system.rules ?? ""}
          onInput={(e) => patch({ rules: e.currentTarget.value })}
        />
      </label>

      <div class="flags">
        <Flag
          label="weapon"
          value={props.system.weapon}
          onToggle={(v) => patch({ weapon: v })}
        />
        <Flag
          label="hull"
          value={props.system.hull}
          onToggle={(v) => patch({ hull: v })}
        />
        <Flag
          label="electronics"
          value={props.system.electronics}
          onToggle={(v) => patch({ electronics: v })}
        />
        <Flag
          label="life support"
          value={props.system.life_support}
          onToggle={(v) => patch({ life_support: v })}
        />
      </div>

      <Show when={props.system.kind === "shields" ? props.system : null}>
        {(sh) => (
          <div class="shields-editor">
            <label class="field">
              <span class="field-label">Front shields (comma-separated)</span>
              <input
                type="text"
                value={sh().front.join(", ")}
                onInput={(e) =>
                  patch({
                    front: parseIntList(e.currentTarget.value),
                  } as Partial<System>)
                }
              />
            </label>
            <label class="field">
              <span class="field-label">Rear shields (comma-separated)</span>
              <input
                type="text"
                value={sh().rear.join(", ")}
                onInput={(e) =>
                  patch({
                    rear: parseIntList(e.currentTarget.value),
                  } as Partial<System>)
                }
              />
            </label>
          </div>
        )}
      </Show>

      <div class="areas-editor">
        <div class="areas-header">
          <span class="field-label">Areas</span>
          <button type="button" class="btn-small" onClick={addArea}>
            + add area
          </button>
        </div>
        <For each={props.system.areas}>
          {(area, i) => (
            <AreaEditor
              area={area}
              onChange={(a) => updateArea(i(), a)}
              onRemove={() => removeArea(i())}
            />
          )}
        </For>
      </div>
    </div>
  );
}

function parseIntList(s: string): number[] {
  return s
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function Flag(props: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label class="flag">
      <input
        type="checkbox"
        checked={props.value}
        onChange={(e) => props.onToggle(e.currentTarget.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

function AreaEditor(props: {
  area: Area;
  onChange: (a: Area) => void;
  onRemove: () => void;
}) {
  const setField = <K extends keyof Area>(key: K, value: Area[K]) =>
    props.onChange({ ...props.area, [key]: value });

  const setCost = (energy: number | undefined, crew: number | undefined) => {
    const cost: any = {};
    if (energy != null) cost.energy = energy;
    if (crew != null) cost.crew = crew;
    props.onChange({ ...props.area, cost });
  };

  return (
    <div class="area-editor">
      <div class="area-editor-top">
        <input
          type="text"
          placeholder="area name"
          value={props.area.name ?? ""}
          onInput={(e) => setField("name", e.currentTarget.value)}
        />
        <button type="button" class="btn-small" onClick={props.onRemove}>
          remove
        </button>
      </div>
      <textarea
        placeholder="description"
        rows="2"
        value={props.area.description ?? ""}
        onInput={(e) => setField("description", e.currentTarget.value)}
      />
      <div class="cost-row">
        <label class="field field-narrow">
          <span class="field-label">energy</span>
          <input
            type="number"
            min="0"
            value={props.area.cost?.energy ?? 0}
            onInput={(e) =>
              setCost(Number(e.currentTarget.value) || 0, props.area.cost?.crew)
            }
          />
        </label>
        <label class="field field-narrow">
          <span class="field-label">crew</span>
          <input
            type="number"
            min="0"
            value={props.area.cost?.crew ?? 0}
            onInput={(e) =>
              setCost(
                props.area.cost?.energy,
                Number(e.currentTarget.value) || 0
              )
            }
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Path helpers and immutable updates on Ship
// ---------------------------------------------------------------------------

const SECTION_PATH_RE = /^sections\.(left|core|right)\[(\d+)\]$/;

function getRefByPath(ship: Ship, path: string): SystemRef | null {
  if (path === "ship.reactor") return ship.reactor;
  if (path === "ship.mess") return ship.mess;
  if (path === "ship.shields") return ship.shields;
  const m = path.match(SECTION_PATH_RE);
  if (!m) return null;
  const section = m[1] as "left" | "core" | "right";
  const idx = Number(m[2]);
  return ship.sections[section][idx] ?? null;
}

/** Generic immutable ref updater for any path. */
function withRefUpdate(
  ship: Ship,
  path: string,
  update: (r: SystemRef) => SystemRef
): Ship {
  if (path === "ship.reactor") return { ...ship, reactor: update(ship.reactor) };
  if (path === "ship.mess") return { ...ship, mess: update(ship.mess) };
  if (path === "ship.shields") return { ...ship, shields: update(ship.shields) };

  const m = path.match(SECTION_PATH_RE);
  if (!m) return ship;
  const section = m[1] as "left" | "core" | "right";
  const idx = Number(m[2]);
  const list = ship.sections[section];
  if (idx < 0 || idx >= list.length) return ship;
  const nextList = list.map((r, i) => (i === idx ? update(r) : r));
  return { ...ship, sections: { ...ship.sections, [section]: nextList } };
}

/** Set `selectedIndex` on the slot at `path` (clamped / cleared when invalid). */
function withSlotSelectedIndex(
  ship: Ship,
  path: string,
  idx: number | null,
): Ship {
  return withRefUpdate(ship, path, (r) => {
    if (r.kind !== "slot") return r;
    const n = r.options.length;
    let next = idx;
    if (n === 0) next = null;
    else if (next != null && (next < 0 || next >= n || !Number.isInteger(next))) {
      next = null;
    }
    return { ...r, selectedIndex: next };
  });
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Serialize the inline SVG, draw it onto an HTML canvas, and download as PNG.
 * Referenced raster resources (icons in /resources/) are embedded via the
 * <image href="..."> elements and must be same-origin to avoid taint.
 */
async function exportSvgAsPng(
  svg: SVGSVGElement,
  width: number,
  height: number,
  filename: string
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    await new Promise<void>((resolve) => {
      canvas.toBlob((b) => {
        if (b) triggerDownload(b, filename);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
