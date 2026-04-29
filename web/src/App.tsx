/**
 * Two-pane editor shell.
 *
 * Left pane:
 *   - Ship `name` (always editable — templates are meant to be renamed).
 *   - Customize toggle.
 *   - In customize mode: `description`, `label`, `overdrive`, `control` also
 *     editable.
 *   - Section list (CORE + LEFT / CENTER / RIGHT columns). Each slot
 *     row carries an inline `<select>` to pick which duplicated option is
 *     installed.
 *   - Inspector panel below the list — visible only in customize mode:
 *       - Slot row   → list of system options (add / remove / duplicate / edit).
 *       - Inline row → full system fields editor (name, rules, areas, etc.).
 *
 * Right pane: live <ShipSVG /> preview.
 *
 * Each tab remembers the last Template choice (`presetId`). Session state is
 * written to localStorage (debounced) so names, descriptions, labels, slot
 * picks, inspector selection, and customize mode survive a full page reload.
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
  exportFleetDocument,
  exportShipDocument,
  parseShipDocument,
  parseShipsFromImport,
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
import { rasterizeShipSheetToJpegBlob } from "./core/render/exportSheetImage";
import { waitForFonts } from "./core/render/measure";
import { DEFAULT_PRESET_ID, PRESETS } from "./presets";

interface ShipTabState {
  id: string;
  presetId: string;
  ship: Ship;
  selected: string | null;
  customize: boolean;
}

type ShipUpdater = (fn: (s: Ship) => Ship) => void;

/** Top-level `{ ships: [...] }` fleet file — use fleet load, not single-ship load. */
function looksLikeFleetDocument(raw: unknown): boolean {
  return (
    raw != null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Array.isArray((raw as Record<string, unknown>).ships)
  );
}

function newTabFromPreset(presetId: string): ShipTabState {
  const entry = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  return {
    id: crypto.randomUUID(),
    presetId: entry.id,
    ship: parseShipDocument(entry.data),
    selected: null,
    customize: false,
  };
}

/** Keep display identity when swapping templates (sheet title / class / template label). */
function mergeShipIdentityOntoPreset(prev: Ship | undefined, presetShip: Ship): Ship {
  if (!prev) return presetShip;
  return {
    ...presetShip,
    name: prev.name,
    description: prev.description,
    label: prev.label,
  };
}

const EDITOR_STORAGE_KEY = "overdrive-sheets-editor-v1";
const EDITOR_STORAGE_VERSION = 1;

interface PersistedEditorPayload {
  version: number;
  tabs: ShipTabState[];
  activeTabId: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function loadPersistedEditorState(): PersistedEditorPayload | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedEditorPayload>;
    if (data.version !== EDITOR_STORAGE_VERSION || !Array.isArray(data.tabs)) return null;

    const tabs: ShipTabState[] = [];
    for (const tab of data.tabs) {
      if (!tab || typeof tab !== "object") continue;
      const t = tab as Partial<ShipTabState>;
      if (t.ship == null || typeof t.presetId !== "string") continue;
      tabs.push({
        id:
          typeof t.id === "string" && t.id.length > 0 ? t.id : crypto.randomUUID(),
        presetId: t.presetId.trim() !== "" ? t.presetId : DEFAULT_PRESET_ID,
        ship: parseShipDocument(t.ship),
        selected:
          typeof t.selected === "string"
            ? t.selected
            : t.selected === null
              ? null
              : null,
        customize: !!t.customize,
      });
    }
    if (tabs.length === 0) return null;

    const activeTabId =
      typeof data.activeTabId === "string" &&
      tabs.some((x) => x.id === data.activeTabId)
        ? data.activeTabId
        : tabs[0]!.id;

    return { version: EDITOR_STORAGE_VERSION, tabs, activeTabId };
  } catch {
    return null;
  }
}

function persistEditorState(tabs: ShipTabState[], activeTabId: string): void {
  if (!canUseLocalStorage()) return;
  try {
    const payload: PersistedEditorPayload = {
      version: EDITOR_STORAGE_VERSION,
      tabs,
      activeTabId,
    };
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function App(): JSX.Element {
  const [fontsReady] = createResource(async () => {
    await waitForFonts();
    return true;
  });

  const persisted = loadPersistedEditorState();
  const initialTabs =
    persisted?.tabs ?? [newTabFromPreset(DEFAULT_PRESET_ID)];
  const initialActive =
    persisted?.activeTabId &&
    initialTabs.some((x) => x.id === persisted.activeTabId)
      ? persisted.activeTabId
      : initialTabs[0]!.id;

  const [tabs, setTabs] = createSignal<ShipTabState[]>(initialTabs);
  const [activeTabId, setActiveTabId] = createSignal(initialActive);
  const [error, setError] = createSignal<string | null>(null);

  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const t = tabs();
    const id = activeTabId();
    if (persistTimer !== undefined) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      persistEditorState(t, id);
    }, 300);
  });

  const activeTab = createMemo(() => tabs().find((t) => t.id === activeTabId()));

  const patchActiveTab = (patch: Partial<ShipTabState>) => {
    const id = activeTabId();
    setTabs((ts) =>
      ts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const setShip = (fn: (s: Ship) => Ship) => {
    const id = activeTabId();
    setTabs((ts) =>
      ts.map((t) => (t.id === id ? { ...t, ship: fn(t.ship) } : t)),
    );
  };

  const applyPresetToActive = (presetKey: string) => {
    try {
      const entry = PRESETS.find((p) => p.id === presetKey) ?? PRESETS[0];
      const prevShip = activeTab()?.ship;
      const presetShip = parseShipDocument(entry.data);
      patchActiveTab({
        presetId: presetKey,
        ship: mergeShipIdentityOntoPreset(prevShip, presetShip),
        selected: null,
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onReloadPreset = () => {
    const t = activeTab();
    if (!t) return;
    applyPresetToActive(t.presetId);
  };

  const addShipTab = () => {
    const t = newTabFromPreset(DEFAULT_PRESET_ID);
    setTabs((ts) => [...ts, t]);
    setActiveTabId(t.id);
    setError(null);
  };

  const closeShipTab = (tabId: string) => {
    const ts = tabs();
    if (ts.length <= 1) return;
    const idx = ts.findIndex((t) => t.id === tabId);
    const nextTabs = ts.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId() === tabId) {
      const adj = ts[idx - 1] ?? ts[idx + 1];
      if (adj) setActiveTabId(adj.id);
    }
    setError(null);
  };

  const onUploadShipJSON = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        if (looksLikeFleetDocument(raw)) {
          throw new Error(
            'This file is a fleet (it has a top-level "ships" array). Use “Load fleet” next to +.',
          );
        }
        const ship = parseShipDocument(raw);
        patchActiveTab({
          ship,
          selected: null,
        });
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    };
    reader.readAsText(file);
    input.value = "";
  };

  const onDownloadShipJSON = () => {
    const t = activeTab();
    if (!t) return;
    const flat = exportShipDocument(t.ship);
    const blob = new Blob([JSON.stringify(flat, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, slugify(t.ship.name) + ".json");
  };

  const onFleetUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const ships = parseShipsFromImport(raw);
        const next: ShipTabState[] = ships.map((ship) => ({
          id: crypto.randomUUID(),
          presetId: DEFAULT_PRESET_ID,
          ship,
          selected: null,
          customize: false,
        }));
        setTabs(next);
        setActiveTabId(next[0]!.id);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    };
    reader.readAsText(file);
    input.value = "";
  };

  const fleetDownloadFilename = (): string => {
    const ships = tabs().map((t) => t.ship);
    const first = slugify(ships[0]?.name || "fleet");
    return `fleet_${first}_${ships.length}_ships.json`;
  };

  const onFleetDownload = () => {
    const ships = tabs().map((t) => t.ship);
    const doc = exportFleetDocument(ships);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, fleetDownloadFilename());
  };

  const onDownloadImage = async () => {
    const t = activeTab();
    if (!t) return;
    const wrap = document.querySelector(".ship-preview-wrapper") as HTMLElement | null;
    if (!wrap?.querySelector("svg")) return;
    try {
      const blob = await rasterizeShipSheetToJpegBlob();
      triggerDownload(blob, slugify(t.ship.name) + ".jpg");
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const selection = (): { path: string; sysRef: SystemRef } | null => {
    const t = activeTab();
    const path = t?.selected ?? null;
    if (!t || !path) return null;
    const sysRef = getRefByPath(t.ship, path);
    return sysRef ? { path, sysRef } : null;
  };

  // Clicking a row only selects it for the inspector in customize mode. In
  // default mode, slots are picked directly via the inline dropdown in the
  // row and inline systems are not interactive.
  const onRowClick = (path: string, _sysRef: SystemRef) => {
    const t = activeTab();
    if (!t || !t.customize) return;
    const id = activeTabId();
    setTabs((ts) =>
      ts.map((tab) => {
        if (tab.id !== id) return tab;
        const next = tab.selected === path ? null : path;
        return { ...tab, selected: next };
      }),
    );
  };

  return (
    <ShipLibraryProvider value={() => baseLibrary}>
    <div class="app">
      <div class="ship-tabs-bar">
        <div class="ship-tabs-scroll" role="tablist" aria-label="Ships">
          <For each={tabs()}>
            {(t) => (
              <div
                class="ship-tab"
                classList={{
                  active: t.id === activeTabId(),
                }}
                role="presentation"
              >
                <button
                  type="button"
                  class="ship-tab-main"
                  role="tab"
                  aria-selected={t.id === activeTabId()}
                  onClick={() => setActiveTabId(t.id)}
                  title={t.ship.name}
                >
                  <span class="ship-tab-label">{t.ship.name.trim() || "Untitled ship"}</span>
                </button>
                <Show when={tabs().length > 1}>
                  <button
                    type="button"
                    class="ship-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeShipTab(t.id);
                    }}
                    title="Close this ship"
                  >
                    ×
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
        <button
          type="button"
          class="ship-tab-add"
          onClick={addShipTab}
          title="New ship tab"
        >
          +
        </button>
        <div class="ship-tab-fleet-tools">
          <label class="btn ship-tab-fleet-btn">
            Load fleet
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={onFleetUpload}
            />
          </label>
          <button
            type="button"
            class="ship-tab-fleet-btn"
            onClick={onFleetDownload}
            title="Save all ships as one fleet JSON file"
          >
            Save fleet
          </button>
        </div>
      </div>

      <div class="app-main">
      <div class="pane left-pane">
        <div class="toolbar">
          <div class="toolbar-row toolbar-title-row">
            <h1>Overdrive Sheets</h1>
            <button
              type="button"
              classList={{ "mode-toggle": true, active: activeTab()?.customize }}
              onClick={() => {
                const id = activeTabId();
                setTabs((ts) =>
                  ts.map((tab) =>
                    tab.id === id
                      ? { ...tab, customize: !tab.customize }
                      : tab,
                  ),
                );
              }}
              title="Toggle customize mode"
            >
              {activeTab()?.customize ? "Customize: ON" : "Customize: off"}
            </button>
          </div>
          <div class="toolbar-row toolbar-template-row">
            <label for="preset-select" class="toolbar-label">Template</label>
            <select
              id="preset-select"
              value={activeTab()?.presetId ?? DEFAULT_PRESET_ID}
              onChange={(e) => applyPresetToActive(e.currentTarget.value)}
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
          <div class="toolbar-row toolbar-ship-actions-row">
            <label class="btn">
              Load ship
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={onUploadShipJSON}
              />
            </label>
            <button type="button" onClick={onDownloadShipJSON}>
              Save ship
            </button>
            <button type="button" onClick={onDownloadImage}>
              Download Image
            </button>
          </div>
        </div>

        <Show when={error()}>
          <div class="error-banner">{error()}</div>
        </Show>

        <ShipHeaderEditor
          ship={activeTab()!.ship}
          customize={!!activeTab()?.customize}
          onChange={(patch) => setShip((s) => ({ ...s, ...patch }))}
        />

        <div
          class="section-list"
          classList={{ "section-list-expanded": !activeTab()?.customize }}
        >
          <SectionList
            ship={activeTab()!.ship}
            customize={!!activeTab()?.customize}
            selected={activeTab()?.selected ?? null}
            onSelect={onRowClick}
            onShip={(fn) => setShip(fn)}
          />
        </div>

        <Show when={activeTab()?.customize}>
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
                  customize={!!activeTab()?.customize}
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
            <ShipSVG ship={activeTab()!.ship} responsive />
          </Show>
        </div>
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
      <div class="section-group section-group-divider">
        <h2 class="section-heading">CORE</h2>
        <p class="section-heading-hint">Reactor, mess, shields</p>
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
      <SectionGroup
        title="LEFT"
        refs={props.ship.sections.left}
        section="left"
        {...rowCommon()}
      />
      <SectionGroup
        title="CENTER"
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
    <div class="section-group section-group-divider">
      <h2 class="section-heading">{props.title}</h2>
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

/** Left-pane title for a slot row: `{label} slot (optionCount)`. */
function formatSlotRowLabel(
  slot: Extract<SystemRef, { kind: "slot" }>,
  canonicalFallback?: string,
): string {
  const base =
    slot.label.trim() ||
    (canonicalFallback?.trim() ?? "") ||
    "Unlabeled";
  return `${base} slot (${slot.options.length})`;
}

function canonicalRowTitleForPath(path: string): string | undefined {
  switch (path) {
    case "ship.reactor":
      return "Reactor";
    case "ship.mess":
      return "Mess";
    case "ship.shields":
      return "Shields";
    default:
      return undefined;
  }
}

function SystemRow(props: {
  id: string;
  sysRef: SystemRef;
  customize: boolean;
  selected: string | null;
  onSelect: OnSelect;
  onShip: ShipUpdater;
  /** Fallback for slot {@link formatSlotRowLabel} when the slot has no `label`
   *  (e.g. "Reactor" for the reactor row). */
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

  // Badge: resolved system kind, or for empty slots a kind hint / slot label (not the word "slot").
  const badge = (): string => {
    const r = resolved();
    if (r) return r.kind;
    if (props.sysRef.kind === "slot") {
      const inferred = inferSlotKind(props.sysRef) ?? props.canonicalKind;
      if (inferred) return inferred;
      const lab = props.sysRef.label.trim();
      if (lab) return lab.length > 16 ? `${lab.slice(0, 14)}…` : lab;
      return "—";
    }
    return inferSlotKind(props.sysRef) ?? props.canonicalKind ?? "—";
  };

  // Slots: preset/editor `label` + " slot " + option count. Inline systems: name.
  const label = (): string => {
    if (props.sysRef.kind === "slot") {
      return formatSlotRowLabel(props.sysRef, props.canonicalLabel);
    }
    const r = resolved();
    if (r) return r.name;
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
            rowFallbackLabel={canonicalRowTitleForPath(props.path)}
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
  /** When `sysRef.label` is empty, used in the header (e.g. core-system row). */
  rowFallbackLabel?: string;
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

  const patchSlotLabel = (label: string) => {
    props.onShip((ship) =>
      withRefUpdate(ship, props.path, (r) =>
        r.kind === "slot" ? { ...r, label } : r,
      ),
    );
  };

  const headerTitle = () =>
    formatSlotRowLabel(props.sysRef, props.rowFallbackLabel);

  return (
    <div class="inspector-body">
      <div class="inspector-header">
        <span class="tag">{props.sysRef.label.trim() || "Slot"}</span>
        <span class="title">{headerTitle()}</span>
      </div>
      <div class="inspector-note">
        Pick an option below to view or edit. The row picker sets which one is
        installed on the sheet preview.
      </div>

      <label class="field">
        <span class="field-label">Slot label</span>
        <input
          type="text"
          placeholder="e.g. Weapon"
          value={props.sysRef.label}
          onInput={(e) => patchSlotLabel(e.currentTarget.value)}
        />
      </label>

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
