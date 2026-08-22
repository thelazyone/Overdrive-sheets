/**
 * Ported from `python/src/ship_profile.py::create_ship_sheet`.
 *
 * Top-level ship sheet layout:
 *   - Header row: name + description, centered.
 *   - Three columns of systems with LEFT / CENTER / RIGHT labels. The core
 *     column has Mess + Reactor pinned at the bottom with a CORE label.
 *   - Right-bottom box with Front/Rear shields.
 *
 * Slot refs resolve to `options[selectedIndex]` on each slot (ship-local).
 */

import { createMemo, For, type JSX } from "solid-js";
import {
  cssFont,
  FONT_EUROSTILE,
  FONT_TITILLIUM,
  SHEET_HEIGHT,
  SHEET_LABEL_SIZE,
  SHEET_SUBTITLE_SIZE,
  SHEET_TITLE_SIZE,
  SHEET_WIDTH,
} from "./constants";
import { measureText } from "./measure";
import {
  placeholderTextForUnresolvedRef,
  resolveRef,
  type Ship,
  type System,
  type SystemRef,
} from "../schema";
import { layoutSystem } from "./SystemSVG";
import { ShieldsSVG } from "./ShieldsSVG";
import {
  BOTTOM_BOX_HEIGHT,
  BOTTOM_BOX_WIDTH,
  BOX_MARGIN,
  COLUMN_MARGIN,
  COLUMN_WIDTH,
  COLUMNS_START_X,
  CORE_BOTTOM_GAP,
  MODULAR_CORE_TILE_HEIGHT,
  MODULAR_ENGINE_TILE_HEIGHT,
  MODULAR_SECTION_TILE_HEIGHT,
  SCALE,
} from "./sheetLayout";
import { isEngineSlot } from "./modularMetrics";

/**
 * `"custom"` — today's sheet: every installed system is printed in place.
 * `"modular"` — "print class": slots become uniform blank spaces sized to match
 * the cut-out tiles from {@link ModularTilesSVG}; fixed (inline) systems are
 * still printed normally.
 */
export type SheetMode = "custom" | "modular";

function renderHeader(ship: Ship): { el: JSX.Element; bottomY: number } {
  const titleFont = cssFont(SHEET_TITLE_SIZE, FONT_EUROSTILE);
  const subtitleFont = cssFont(SHEET_SUBTITLE_SIZE, FONT_TITILLIUM);

  const titleText = ship.name.toUpperCase();
  const titleMetrics = measureText(titleText, titleFont);
  const subtitleMetrics = measureText(ship.description, subtitleFont);

  const titleY = 50;
  const subtitleY = titleY + titleMetrics.height + 20;

  const el = (
    <g>
      <text
        x={SHEET_WIDTH / 2}
        y={titleY}
        text-anchor="middle"
        dominant-baseline="hanging"
        style={{ font: titleFont, fill: "black" }}
      >
        {titleText}
      </text>
      <text
        x={SHEET_WIDTH / 2}
        y={subtitleY}
        text-anchor="middle"
        dominant-baseline="hanging"
        style={{ font: subtitleFont, fill: "black" }}
      >
        {ship.description}
      </text>
    </g>
  );

  const bottomY = subtitleY + subtitleMetrics.height;
  return { el, bottomY };
}

function resolveShields(ship: Ship): {
  front: number[];
  rear: number[];
  hull: boolean;
  electronics: boolean;
  life_support: boolean;
} {
  const sys = resolveRef(ship.shields);
  if (sys && sys.kind === "shields") {
    return {
      front: sys.front,
      rear: sys.rear,
      hull: sys.hull,
      electronics: sys.electronics,
      life_support: sys.life_support,
    };
  }
  return {
    front: [],
    rear: [],
    hull: false,
    electronics: false,
    life_support: false,
  };
}

/**
 * Dashed outline with a centred label — used both for "nothing installed" in
 * custom mode and for the uniform placement targets in modular mode.
 */
function blankBox(
  label: string,
  width: number,
  height: number,
  x: number,
  y: number,
): JSX.Element {
  const labelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="none"
        stroke="rgb(150,150,150)"
        stroke-dasharray="10 8"
        stroke-width={4}
      />
      <text
        x={width / 2}
        y={height / 2}
        text-anchor="middle"
        dominant-baseline="central"
        style={{ font: labelFont, fill: "rgb(150,150,150)" }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Render a SystemRef. For empty slots, returns a dashed placeholder at the
 * column width.
 *
 * In modular mode a **slot** always becomes a uniform blank space regardless of
 * what is selected — that space is where a cut-out tile gets placed — while an
 * inline (fixed) system still prints normally.
 */
function SystemRefSVG(props: {
  ref: SystemRef;
  x: number;
  y: number;
  columnWidth: number;
  mode: SheetMode;
  uniformHeight: number;
}): { el: JSX.Element; height: number } {
  if (props.mode === "modular" && props.ref.kind === "slot") {
    const label = placeholderTextForUnresolvedRef(props.ref);
    // Engines have their own standard size — see MODULAR_ENGINE_TILE_HEIGHT.
    const h = isEngineSlot(props.ref)
      ? MODULAR_ENGINE_TILE_HEIGHT
      : props.uniformHeight;
    return {
      el: blankBox(label, props.columnWidth, h, props.x, props.y),
      height: h,
    };
  }

  const resolved = resolveRef(props.ref);
  if (!resolved) {
    // Empty slot / unresolved ref placeholder
    const placeholderHeight = 200 * SCALE;
    const label = placeholderTextForUnresolvedRef(props.ref);
    return {
      el: blankBox(label, props.columnWidth, placeholderHeight, props.x, props.y),
      height: placeholderHeight,
    };
  }

  return renderSystemAt(resolved, props.x, props.y, props.columnWidth);
}

function renderSystemAt(system: System, x: number, y: number, columnWidth: number) {
  const layout = layoutSystem(system);
  const scale = columnWidth / layout.width;
  const height = layout.height * scale;
  const el = (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>{layout.el}</g>
  );
  return { el, height };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export interface ShipSVGProps {
  ship: Ship;
  /** If true, renders without explicit width/height attributes so the parent
   *  can control scaling via CSS. Defaults to false (fixed A5 dimensions). */
  responsive?: boolean;
  /** Defaults to `"custom"` (today's behaviour). */
  mode?: SheetMode;
}

function ShipSVGInner(
  ship: Ship,
  responsive: boolean,
  mode: SheetMode,
): JSX.Element {
  const header = renderHeader(ship);

  // Columns layout
  const columnWidth = COLUMN_WIDTH;
  const columnsStartX = COLUMNS_START_X;

  const labelY = header.bottomY + 50;
  const labelHeight = SHEET_LABEL_SIZE;
  const columnsTopY = labelY + labelHeight + 20;

  // Bottom boxes
  const bottomBoxHeight = BOTTOM_BOX_HEIGHT;
  const bottomBoxY = SHEET_HEIGHT - bottomBoxHeight - BOX_MARGIN;
  const bottomBoxWidth = BOTTOM_BOX_WIDTH;

  // Reactor and Mess each occupy a fixed-width bottom slot, independent of
  // each other: if one is unresolved (empty slot) we still draw the other and
  // show a dashed placeholder in the missing one. This mirrors the behaviour
  // of the column sections above, so the sheet layout is stable.
  const CORE_BOTTOM_PLACEHOLDER_HEIGHT = 240;

  function bottomCoreBlock(
    ref: SystemRef,
  ): { height: number; render: (y: number) => JSX.Element } {
    // Modular: a reactor/mess slot is always a blank placement target sized to
    // match its cut-out tile, whatever happens to be selected in the editor.
    if (mode === "modular" && ref.kind === "slot") {
      const label = placeholderTextForUnresolvedRef(ref);
      return {
        height: MODULAR_CORE_TILE_HEIGHT,
        render: (y: number) =>
          blankBox(
            label,
            bottomBoxWidth,
            MODULAR_CORE_TILE_HEIGHT,
            BOX_MARGIN,
            y,
          ),
      };
    }

    const sys = resolveRef(ref);
    if (sys) {
      const layout = layoutSystem(sys);
      const scale = bottomBoxWidth / layout.width;
      const height = layout.height * scale;
      return {
        height,
        render: (y: number) => (
          <g transform={`translate(${BOX_MARGIN} ${y}) scale(${scale})`}>
            {layout.el}
          </g>
        ),
      };
    }
    const label = placeholderTextForUnresolvedRef(ref);
    return {
      height: CORE_BOTTOM_PLACEHOLDER_HEIGHT,
      render: (y: number) =>
        blankBox(
          label,
          bottomBoxWidth,
          CORE_BOTTOM_PLACEHOLDER_HEIGHT,
          BOX_MARGIN,
          y,
        ),
    };
  }

  const columnLabelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);

  const reactorBlock = bottomCoreBlock(ship.reactor);
  const messBlock = bottomCoreBlock(ship.mess);

  const reactorY = SHEET_HEIGHT - reactorBlock.height - BOX_MARGIN;
  const messY = reactorY - messBlock.height - CORE_BOTTOM_GAP;

  const reactorEl: JSX.Element = reactorBlock.render(reactorY);
  const messEl: JSX.Element = messBlock.render(messY);
  const coreLabelEl: JSX.Element = (
    <text
      x={BOX_MARGIN + bottomBoxWidth / 2}
      y={messY - 20}
      text-anchor="middle"
      dominant-baseline="alphabetic"
      style={{ font: columnLabelFont, fill: "black" }}
    >
      CORE
    </text>
  );

  // Side (left/right) columns contain only their section systems at SCALE width.
  const scaledSystemWidth = columnWidth;

  const columnSystems = (section: SystemRef[]) => {
    const nodes: JSX.Element[] = [];
    let currentY = columnsTopY;
    section.forEach((ref) => {
      const layoutBase = SystemRefSVG({
        ref,
        x: 0,
        y: 0,
        columnWidth: scaledSystemWidth,
        mode,
        uniformHeight: MODULAR_SECTION_TILE_HEIGHT,
      });
      const h = layoutBase.height;
      nodes.push(
        <g transform={`translate(0 ${currentY})`}>{layoutBase.el}</g>
      );
      currentY += h + COLUMN_MARGIN;
    });
    return nodes;
  };

  // Core column: only section.core systems (mess/reactor handled separately at bottom).
  const coreSectionElements: JSX.Element[] = columnSystems(ship.sections.core);

  // Shields: a modular shields slot becomes a blank target the same size as the
  // existing shields box, so a shields cut-out drops straight onto it.
  const shieldsX = SHEET_WIDTH - bottomBoxWidth - BOX_MARGIN;
  let shieldsEl: JSX.Element;
  if (mode === "modular" && ship.shields.kind === "slot") {
    shieldsEl = blankBox(
      placeholderTextForUnresolvedRef(ship.shields),
      bottomBoxWidth,
      bottomBoxHeight,
      shieldsX,
      bottomBoxY,
    );
  } else {
    const sh = resolveShields(ship);
    shieldsEl = (
      <ShieldsSVG
        x={shieldsX}
        y={bottomBoxY}
        width={bottomBoxWidth}
        height={bottomBoxHeight}
        front={sh.front}
        rear={sh.rear}
        hull={sh.hull}
        electronics={sh.electronics}
        life_support={sh.life_support}
      />
    );
  }

  const svgProps: Record<string, any> = {
    viewBox: `0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`,
    preserveAspectRatio: "xMidYMid meet",
    xmlns: "http://www.w3.org/2000/svg",
  };
  if (!responsive) {
    svgProps.width = SHEET_WIDTH;
    svgProps.height = SHEET_HEIGHT;
  } else {
    svgProps.width = "100%";
    svgProps.height = "100%";
  }

  return (
    <svg {...svgProps}>
      <rect x={0} y={0} width={SHEET_WIDTH} height={SHEET_HEIGHT} fill="white" />
      {header.el}

      {/* Column labels */}
      <For each={["LEFT", "CENTER", "RIGHT"]}>
        {(label, i) => (
          <text
            x={columnsStartX + i() * (columnWidth + COLUMN_MARGIN) + columnWidth / 2}
            y={labelY}
            text-anchor="middle"
            dominant-baseline="hanging"
            style={{ font: columnLabelFont, fill: "black" }}
          >
            {label}
          </text>
        )}
      </For>

      {/* Left column */}
      <g transform={`translate(${columnsStartX} 0)`}>
        {columnSystems(ship.sections.left)}
      </g>
      {/* Core column (section systems only) */}
      <g transform={`translate(${columnsStartX + columnWidth + COLUMN_MARGIN} 0)`}>
        {coreSectionElements}
      </g>
      {/* Right column */}
      <g
        transform={`translate(${
          columnsStartX + 2 * (columnWidth + COLUMN_MARGIN)
        } 0)`}
      >
        {columnSystems(ship.sections.right)}
      </g>

      {/* Core bottom: Mess + Reactor + label */}
      {coreLabelEl}
      {messEl}
      {reactorEl}

      {/* Shields box */}
      {shieldsEl}

    </svg>
  );
}

/**
 * Public wrapper. Wrapping the imperative layout in a {@link createMemo} is
 * what makes the SVG reactive: the inner function re-runs whenever
 * `props.ship` changes by reference, which produces a fresh JSX tree that
 * Solid then splices into the DOM.
 */
export function ShipSVG(props: ShipSVGProps): JSX.Element {
  const rendered = createMemo(() =>
    ShipSVGInner(props.ship, !!props.responsive, props.mode ?? "custom"),
  );
  return <>{rendered()}</>;
}
