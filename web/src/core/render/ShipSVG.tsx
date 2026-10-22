/** A5 console with a class-independent physical mask footprint. */
import { createMemo, type JSX } from "solid-js";
import { cssFont, FONT_EUROSTILE, FONT_TITILLIUM, SHEET_HEIGHT, SHEET_LABEL_SIZE, SHEET_WIDTH } from "./constants";
import { placeholderTextForUnresolvedRef, resolveRef, type Ship, type System, type SystemRef } from "../schema";
import { layoutSystem } from "./SystemSVG";
import { FixedFeaturesSVG } from "./FixedFeaturesSVG";
import { FEATURE_LAYOUT, LEFT_FEATURE_BAND_RIGHT, CHARACTERS_X, COLUMN_MARGIN, COLUMN_WIDTH, COLUMNS_START_X, COLUMN_TOP, COLUMN_BOTTOM, MODULAR_ENGINE_TILE_HEIGHT,
  MODULAR_SECTION_TILE_HEIGHT, SCALE, COLUMN_TILE_SCALE, cornerForColumn, TILE_CORNER_CUT,
  tileOutlinePath, type ModularColumn, type TileCorner } from "./sheetLayout";
import { isEngineSlot } from "./modularMetrics";
import { mm } from "./featureGeometry";
export type SheetMode = "custom" | "modular";

function blankBox(
  label: string,
  width: number,
  height: number,
  x: number,
  y: number,
  corner: TileCorner = "none",
): JSX.Element {
  const labelFont = cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE);
  // Same outline as the cut-out that lands here, chamfer included, so the slot
  // visibly matches the tile shaped for it.
  const cut = TILE_CORNER_CUT * COLUMN_TILE_SCALE;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={tileOutlinePath(width, height, corner, cut)}
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
 *
 * `corner` is applied either way: fixed systems carry the same column marking
 * as swappable ones, so a column reads consistently.
 */
function SystemRefSVG(props: {
  ref: SystemRef;
  x: number;
  y: number;
  columnWidth: number;
  mode: SheetMode;
  uniformHeight: number;
  matchModularHeight: boolean;
  corner: TileCorner;
}): { el: JSX.Element; height: number } {
  if (props.mode === "modular" && props.ref.kind === "slot") {
    const label = placeholderTextForUnresolvedRef(props.ref);
    // Engines have their own standard size — see MODULAR_ENGINE_TILE_HEIGHT.
    const h = isEngineSlot(props.ref)
      ? MODULAR_ENGINE_TILE_HEIGHT
      : props.uniformHeight;
    return {
      el: blankBox(
        label,
        props.columnWidth,
        h,
        props.x,
        props.y,
        props.corner,
      ),
      height: h,
    };
  }

  const resolved = resolveRef(props.ref);
  if (!resolved) {
    // Empty slot / unresolved ref placeholder
    const placeholderHeight = props.matchModularHeight ? (isEngineSlot(props.ref) ? MODULAR_ENGINE_TILE_HEIGHT : props.uniformHeight) : 200 * SCALE;
    const label = placeholderTextForUnresolvedRef(props.ref);
    return {
      el: blankBox(
        label,
        props.columnWidth,
        placeholderHeight,
        props.x,
        props.y,
        props.corner,
      ),
      height: placeholderHeight,
    };
  }

  return renderSystemAt(
    resolved,
    props.x,
    props.y,
    props.columnWidth,
    props.corner,
    props.matchModularHeight ? (resolved.kind === "engine" ? MODULAR_ENGINE_TILE_HEIGHT : props.uniformHeight) / COLUMN_TILE_SCALE : undefined,
  );
}

function renderSystemAt(
  system: System,
  x: number,
  y: number,
  columnWidth: number,
  corner: TileCorner = "none",
  targetHeight?: number,
) {
  const layout = layoutSystem(system, targetHeight, corner);
  const scale = columnWidth / layout.width;
  const height = layout.height * scale;
  const el = (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>{layout.el}</g>
  );
  return { el, height };
}


export interface ShipSVGProps { ship: Ship; responsive?: boolean; mode?: SheetMode; matchModularHeight?: boolean }
function ShipSVGInner(ship: Ship, responsive: boolean, mode: SheetMode, matchModularHeight: boolean): JSX.Element {
  const labelFont = cssFont(30, FONT_EUROSTILE);
  const quarters = FEATURE_LAYOUT.quarters;
  const stripRight = LEFT_FEATURE_BAND_RIGHT;
  const quartersTop = quarters.y - 60;
  const quartersRight = quarters.x + quarters.width + mm(4);
  const cargoLeft = 920;
  const boardingLeft = stripRight + cargoLeft - quartersRight;
  const headingRight = CHARACTERS_X - 40;
  const columnSystems = (column: ModularColumn) => {
    const layouts = ship.sections[column].map(ref => SystemRefSVG({ ref, x: 0, y: 0,
      columnWidth: COLUMN_WIDTH, mode, matchModularHeight,
      uniformHeight: MODULAR_SECTION_TILE_HEIGHT, corner: cornerForColumn(column) }));
    const total = layouts.reduce((sum, layout) => sum + layout.height, 0) + Math.max(0, layouts.length-1)*COLUMN_MARGIN;
    let y = matchModularHeight || mode === "modular"
      ? Math.max(250, Math.min(COLUMN_TOP[column], COLUMN_BOTTOM[column]-total)) : COLUMN_TOP[column];
    return layouts.map(layout => {
      const el = <g transform={`translate(0 ${y})`}>{layout.el}</g>;
      y += layout.height + COLUMN_MARGIN;
      return el;
    });
  };
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`}
    width={responsive ? "100%" : SHEET_WIDTH} height={responsive ? "100%" : SHEET_HEIGHT}>
    <rect width={SHEET_WIDTH} height={SHEET_HEIGHT} fill="white" />
    <path d={`M 0 0 H ${stripRight} V ${quartersTop-30}
      L ${stripRight+30} ${quartersTop} H ${quartersRight-30} L ${quartersRight} ${quartersTop+30}
      V ${SHEET_HEIGHT} H 0 Z`} fill="#b8b8b8" />
    <path d={`M ${boardingLeft} 0 H ${boardingLeft+310} V 55 L ${boardingLeft+280} 85 H ${boardingLeft+30} L ${boardingLeft} 55 Z`} fill="#b8b8b8" />
    <text x={boardingLeft+155} y="55" text-anchor="middle" style={{font:labelFont}}>BOARDING</text>
    <text x={headingRight} y="105" text-anchor="end" textLength={ship.name.length > 26 ? 1350 : undefined}
      lengthAdjust="spacingAndGlyphs" style={{font:cssFont(64,FONT_EUROSTILE)}}>{ship.name.toUpperCase()}</text>
    <text x={headingRight} y="173" text-anchor="end" textLength={ship.description.length > 45 ? 1350 : undefined}
      lengthAdjust="spacingAndGlyphs" style={{font:cssFont(42,FONT_TITILLIUM)}}>{ship.description}</text>
    <path d={`M ${CHARACTERS_X+65} 185 H ${SHEET_WIDTH} V 1635 H ${CHARACTERS_X+65} L ${CHARACTERS_X+35} 1605 V 215 Z`}
      fill="#b8b8b8" />
    <text transform={`translate(${(CHARACTERS_X+35+SHEET_WIDTH)/2} 910) rotate(-90)`}
      text-anchor="middle" dominant-baseline="central" style={{font:labelFont}}>CHARACTERS</text>
    <path d={`M ${cargoLeft+30} 1675 H 2290 L 2320 1705 V ${SHEET_HEIGHT} H ${cargoLeft} V 1705 Z`} fill="#b8b8b8" />
    <text x="1620" y="1723" text-anchor="middle" style={{font:labelFont}}>CARGO</text>
    <FixedFeaturesSVG ship={ship} />
    {(["left","core","right"] as const).map((column,i) =>
      <g transform={`translate(${COLUMNS_START_X+i*(COLUMN_WIDTH+COLUMN_MARGIN)} 0)`}>
        {columnSystems(column)}
      </g>)}
  </svg>;
}
export function ShipSVG(props: ShipSVGProps): JSX.Element {
  const rendered = createMemo(() => ShipSVGInner(props.ship, !!props.responsive, props.mode ?? "custom", props.matchModularHeight ?? true));
  return <>{rendered()}</>;
}
