/**
 * Ported from `python/src/ship_profile.py::create_ship_sheet`.
 *
 * Top-level ship sheet layout:
 *   - Header row: OVERDRIVE label + squares on the left, name + description
 *     centered, CONTROL value on the right.
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
  SHEET_STATS_SIZE,
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
import { OverdriveSVG } from "./OverdriveSVG";
import { ShieldsSVG } from "./ShieldsSVG";

const SCALE = 0.75; // SYSTEM_SCALE from python/src/ship_profile.py line 12
const BOX_MARGIN = 20;
const COLUMN_MARGIN = 8;
const SIDE_MARGIN = 16;

function renderHeader(ship: Ship): { el: JSX.Element; bottomY: number } {
  const titleFont = cssFont(SHEET_TITLE_SIZE, FONT_EUROSTILE);
  const subtitleFont = cssFont(SHEET_SUBTITLE_SIZE, FONT_TITILLIUM);
  const statsFont = cssFont(SHEET_STATS_SIZE, FONT_EUROSTILE);

  const titleText = ship.name.toUpperCase();
  const titleMetrics = measureText(titleText, titleFont);
  const subtitleMetrics = measureText(ship.description, subtitleFont);

  const titleY = 50;
  const subtitleY = titleY + titleMetrics.height + 20;

  const controlText = `CONTROL ${ship.control}`;
  const controlMetrics = measureText(controlText, statsFont);

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
      <text
        x={SHEET_WIDTH - controlMetrics.width - BOX_MARGIN}
        y={titleY}
        dominant-baseline="hanging"
        style={{ font: statsFont, fill: "black" }}
      >
        {controlText}
      </text>
      <OverdriveSVG tokens={ship.overdrive} x={BOX_MARGIN} y={titleY} />
    </g>
  );

  const bottomY = subtitleY + subtitleMetrics.height;
  return { el, bottomY };
}

function resolveShields(ship: Ship): { front: number[]; rear: number[] } {
  const sys = resolveRef(ship.shields);
  if (sys && sys.kind === "shields") {
    return { front: sys.front, rear: sys.rear };
  }
  return { front: [], rear: [] };
}

/**
 * Render a SystemRef. For empty slots, returns a dashed placeholder at the
 * column width.
 */
function SystemRefSVG(props: {
  ref: SystemRef;
  x: number;
  y: number;
  columnWidth: number;
}): { el: JSX.Element; height: number } {
  const resolved = resolveRef(props.ref);
  if (!resolved) {
    // Empty slot / unresolved ref placeholder
    const placeholderHeight = 200 * SCALE;
    const labelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
    const label = placeholderTextForUnresolvedRef(props.ref);
    const el = (
      <g transform={`translate(${props.x} ${props.y})`}>
        <rect
          x={0}
          y={0}
          width={props.columnWidth}
          height={placeholderHeight}
          fill="none"
          stroke="rgb(150,150,150)"
          stroke-dasharray="10 8"
          stroke-width={4}
        />
        <text
          x={props.columnWidth / 2}
          y={placeholderHeight / 2}
          text-anchor="middle"
          dominant-baseline="central"
          style={{ font: labelFont, fill: "rgb(150,150,150)" }}
        >
          {label}
        </text>
      </g>
    );
    return { el, height: placeholderHeight };
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
}

function ShipSVGInner(ship: Ship, responsive: boolean): JSX.Element {
  const header = renderHeader(ship);

  // Columns layout
  const columnLabelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
  const availableWidth = SHEET_WIDTH - 2 * SIDE_MARGIN - 2 * COLUMN_MARGIN;
  const columnWidth = Math.floor(availableWidth / 3);
  const totalColumnsWidth = 3 * columnWidth + 2 * COLUMN_MARGIN;
  const columnsStartX = Math.floor((SHEET_WIDTH - totalColumnsWidth) / 2);

  const labelY = header.bottomY + 50;
  const labelHeight = SHEET_LABEL_SIZE;
  const columnsTopY = labelY + labelHeight + 20;

  // Bottom boxes
  const bottomBoxHeight = 300;
  const bottomBoxY = SHEET_HEIGHT - bottomBoxHeight - BOX_MARGIN;
  const bottomBoxWidth = SHEET_WIDTH / 3 - BOX_MARGIN;

  // Reactor and Mess each occupy a fixed-width bottom slot, independent of
  // each other: if one is unresolved (empty slot) we still draw the other and
  // show a dashed placeholder in the missing one. This mirrors the behaviour
  // of the column sections above, so the sheet layout is stable.
  const CORE_BOTTOM_PLACEHOLDER_HEIGHT = 240;
  const CORE_BOTTOM_GAP = 20;

  function bottomCoreBlock(
    ref: SystemRef,
  ): { height: number; render: (y: number) => JSX.Element } {
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
    const placeholderFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
    const label = placeholderTextForUnresolvedRef(ref);
    return {
      height: CORE_BOTTOM_PLACEHOLDER_HEIGHT,
      render: (y: number) => (
        <g transform={`translate(${BOX_MARGIN} ${y})`}>
          <rect
            x={0}
            y={0}
            width={bottomBoxWidth}
            height={CORE_BOTTOM_PLACEHOLDER_HEIGHT}
            fill="none"
            stroke="rgb(150,150,150)"
            stroke-dasharray="10 8"
            stroke-width={4}
          />
          <text
            x={bottomBoxWidth / 2}
            y={CORE_BOTTOM_PLACEHOLDER_HEIGHT / 2}
            text-anchor="middle"
            dominant-baseline="central"
            style={{ font: placeholderFont, fill: "rgb(150,150,150)" }}
          >
            {label}
          </text>
        </g>
      ),
    };
  }

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
  const coreSectionElements: JSX.Element[] = [];
  {
    let currentY = columnsTopY;
    ship.sections.core.forEach((ref) => {
      const base = SystemRefSVG({
        ref,
        x: 0,
        y: 0,
        columnWidth: scaledSystemWidth,
      });
      coreSectionElements.push(
        <g transform={`translate(0 ${currentY})`}>{base.el}</g>
      );
      currentY += base.height + COLUMN_MARGIN;
    });
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
      <ShieldsSVG
        x={SHEET_WIDTH - bottomBoxWidth - BOX_MARGIN}
        y={bottomBoxY}
        width={bottomBoxWidth}
        height={bottomBoxHeight}
        front={resolveShields(ship).front}
        rear={resolveShields(ship).rear}
      />

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
    ShipSVGInner(props.ship, !!props.responsive),
  );
  return <>{rendered()}</>;
}
