/**
 * Ported from `python/src/system.py::create_system`.
 *
 * Renders a single system tile as SVG. The tile's width is fixed to
 * {@link TILE_WIDTH}; the height is computed from content and exposed by
 * {@link layoutSystem} so the ship-level layout can pack tiles vertically
 * without a second pass.
 *
 * Key structural pieces (top to bottom):
 *   1. Title (ALL CAPS, Eurostile Extended Bold, centered)
 *   2. Rules (Titillium SemiBold, centered, optional)
 *   3. Special content for `mess` / `reactor` / `engine` kinds
 *   4. Areas: cost column (energy/crew icons) + content column
 *      (weapon/engine symbol + optional firing arc + description)
 *   5. Bottom-right chevron with hull/electronics/life-support icons
 *   6. Top-left chevron with weapon/main icons
 *   7. Black border rectangle around the whole tile
 */

import { For, type JSX } from "solid-js";
import type { Area, System } from "../schema";
import {
  cssFont,
  FONT_EUROSTILE,
  FONT_TITILLIUM,
  ICON_SIZE,
  ICON_SIZE_LARGE,
  ENGINE_SLOT_SIZE,
  TILE_AREA_TITLE_SIZE,
  TILE_COMBAT_NUMBER_SIZE,
  TILE_DESCRIPTION_SIZE,
  TILE_HEIGHT,
  TILE_SUBTITLE_SIZE,
  TILE_TITLE_SIZE,
  TILE_WIDTH,
} from "./constants";
import { measureText } from "./measure";
import { wrapText } from "./wrap";
import {
  WeaponSymbolSVG,
  weaponSymbolHeight,
  weaponSymbolWidth,
} from "./WeaponSymbolSVG";
import {
  EngineSymbolSVG,
  engineSymbolHeight,
  engineSymbolWidth,
} from "./EngineSymbolSVG";
import { FiringArcSVG } from "./FiringArcSVG";

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

const VERTICAL_MARGIN = Math.floor(TILE_HEIGHT * 0.02);
const HORIZONTAL_MARGIN = Math.floor(TILE_WIDTH * 0.02);
const VERTICAL_SPACING = Math.floor(TILE_HEIGHT * 0.01);
const BORDER_WIDTH = 8;

const DEG = (v: string | undefined) => (v ?? "").replace(/\u00c2\u00b0/g, "\u00b0");

function fixDegrees(s: string): string {
  return s.replace(/\u00c2\u00b0/g, "\u00b0");
}

function renderTitle(system: System, effectiveWidth: number, y: number) {
  const font = cssFont(TILE_TITLE_SIZE, FONT_EUROSTILE);
  const text = system.name.toUpperCase();
  const { height } = measureText(text, font);
  const el = (
    <text
      x={effectiveWidth / 2}
      y={y}
      text-anchor="middle"
      dominant-baseline="hanging"
      style={{ font, fill: "black" }}
    >
      {text}
    </text>
  );
  // Pillow's textbbox height doesn't include descent nicely; the Python
  // treats the measured height as the advance. Use ascent+descent.
  return { el, height };
}

function renderRules(system: System, effectiveWidth: number, y: number) {
  const hasTopLeftIcons = system.weapon || system.main;
  const hasRules = system.rules && system.rules.trim().length > 0;
  if (!hasRules) {
    if (hasTopLeftIcons) return { el: null, height: 8 * VERTICAL_SPACING };
    return { el: null, height: 0 };
  }

  const font = cssFont(TILE_SUBTITLE_SIZE, FONT_TITILLIUM);
  const text = fixDegrees(system.rules!);
  const lines = wrapText(text, font, effectiveWidth - 20);
  const lineHeight = TILE_SUBTITLE_SIZE + 4;

  const el = (
    <g>
      <For each={lines}>
        {(line, i) =>
          line ? (
            <text
              x={effectiveWidth / 2}
              y={y + i() * lineHeight}
              text-anchor="middle"
              dominant-baseline="hanging"
              style={{ font, fill: "black" }}
            >
              {line}
            </text>
          ) : null
        }
      </For>
    </g>
  );

  const total = lines.length * lineHeight - 4;
  return { el, height: Math.max(total + VERTICAL_SPACING, 5 * VERTICAL_SPACING) };
}

// ---------------------------------------------------------------------------
// Special-kind content blocks
// ---------------------------------------------------------------------------

function renderMess(system: Extract<System, { kind: "mess" }>, y: number) {
  const messHeight = 200;
  let el: JSX.Element = null;

  if (system.med_bay > 0) {
    const medBayRatio = 0.275;
    const medBayWidth = Math.floor(TILE_WIDTH * medBayRatio);
    const mainSectionWidth = TILE_WIDTH - medBayWidth;
    const dividerPadding = 10;
    const dividerX = mainSectionWidth;

    const symbolWidth = ICON_SIZE_LARGE;
    const gap = 10;
    const count = system.med_bay;
    const startX = dividerX + (medBayWidth - symbolWidth) / 2 - 30;
    const totalSymbolsHeight = count * symbolWidth + gap * Math.max(0, count - 1);
    const startYIcons = (y + messHeight) / 2 - totalSymbolsHeight / 2;

    const labelText = "MED BAY";
    const medBayFont = cssFont(Math.floor(TILE_AREA_TITLE_SIZE * 0.75), FONT_EUROSTILE);
    /** Further left / lower than edge anchors; inset from tile right edge (px). */
    const insetFromTileRight = 28;
    const labelAnchorX = TILE_WIDTH - insetFromTileRight;
    const labelAnchorY =
      y + dividerPadding + Math.round(messHeight * 0.2);

    el = (
      <g>
        <line
          x1={dividerX}
          y1={dividerPadding}
          x2={dividerX}
          y2={y + messHeight - dividerPadding}
          stroke="black"
          stroke-width={2}
        />
        {Array.from({ length: count }).map((_, i) => (
          <image
            href="/resources/med_bay_symbol.png"
            x={startX}
            y={startYIcons + i * (symbolWidth + gap)}
            width={symbolWidth}
            height={symbolWidth}
          />
        ))}
        <g transform={`translate(${labelAnchorX} ${labelAnchorY}) rotate(-90)`}>
          <text
            x={0}
            y={0}
            text-anchor="start"
            dominant-baseline="hanging"
            style={{ font: medBayFont, fill: "black" }}
          >
            {labelText}
          </text>
        </g>
      </g>
    );
  }

  return { el, height: messHeight };
}

function renderReactor(system: Extract<System, { kind: "reactor" }>, y: number) {
  const emptySpaceHeight = 150;
  const count = system.circles;
  if (count <= 0) return { el: null as JSX.Element, height: emptySpaceHeight };

  let symbolWidth = ICON_SIZE_LARGE;
  let gap = 20;
  let totalWidth = count * symbolWidth + (count - 1) * gap;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (totalWidth <= TILE_WIDTH - 20) break;
    symbolWidth -= 10;
    gap -= 3;
    totalWidth = count * symbolWidth + (count - 1) * gap;
  }

  const startX = (TILE_WIDTH - totalWidth) / 2;
  const symbolY = y + (emptySpaceHeight - symbolWidth) / 2;

  const el = (
    <g>
      {Array.from({ length: count }).map((_, i) => (
        <image
          href="/resources/energy_symbol_large.png"
          x={startX + i * (symbolWidth + gap)}
          y={symbolY}
          width={symbolWidth}
          height={symbolWidth}
        />
      ))}
    </g>
  );

  return { el, height: emptySpaceHeight };
}

function renderEngine(system: Extract<System, { kind: "engine" }>, y: number) {
  const slots =
    system.speed_slots.length > 0
      ? system.speed_slots
      : [
          { speed: "0-1", rotation: "90\u00b0" },
          { speed: "1-2", rotation: "45\u00b0" },
          { speed: "2-3", rotation: "0\u00b0" },
        ];

  const slotSize = ENGINE_SLOT_SIZE;
  const slotSpacing = 40;
  const totalWidth = slots.length * slotSize + (slots.length - 1) * slotSpacing;
  const startX = (TILE_WIDTH - totalWidth) / 2;
  const slotY = y + 15;

  const el = (
    <g>
      {slots.map((slot, i) => {
        const sx = startX + i * (slotSize + slotSpacing);
        const engineW = engineSymbolWidth();
        const engineH = engineSymbolHeight(DEG(slot.rotation));
        const symbolX = sx + (slotSize - engineW) / 2;
        const symbolY = slotY + (slotSize - engineH) / 2;
        return (
          <g>
            <image
              href="/resources/engine_slot.png"
              x={sx}
              y={slotY}
              width={slotSize}
              height={slotSize}
            />
            <EngineSymbolSVG
              speed={slot.speed}
              steer={DEG(slot.rotation)}
              x={symbolX}
              y={symbolY}
            />
          </g>
        );
      })}
    </g>
  );

  return { el, height: slotSize };
}

// ---------------------------------------------------------------------------
// Areas (cost column + content column)
// ---------------------------------------------------------------------------

interface ActionLayout {
  el: JSX.Element;
  contentHeight: number;
}

function renderAction(area: Area, contentX: number, maxDescWidth: number): ActionLayout {
  const descFont = cssFont(TILE_DESCRIPTION_SIZE, FONT_TITILLIUM);
  const combatSize = TILE_COMBAT_NUMBER_SIZE;
  const elements: JSX.Element[] = [];
  let contentHeight = 0;

  // Weapon or engine symbol.
  let weaponWidth = 0;
  if (area.shoot) {
    weaponWidth = weaponSymbolWidth(area.shoot.range);
    elements.push(
      <WeaponSymbolSVG
        damage={area.shoot.damage}
        range={area.shoot.range}
        x={contentX}
        y={0}
      />
    );
    contentHeight = Math.max(contentHeight, weaponSymbolHeight());
  } else if (area.engine) {
    weaponWidth = engineSymbolWidth();
    const steer = area.engine.steer;
    elements.push(
      <EngineSymbolSVG
        speed={area.engine.speed}
        steer={steer ? DEG(steer) : undefined}
        x={contentX}
        y={0}
        fontSize={combatSize}
      />
    );
    contentHeight = Math.max(contentHeight, engineSymbolHeight(steer, combatSize));
  }

  // Firing arc.
  let arcWidth = 0;
  const arcSize = 80;
  if (
    area.shoot &&
    area.shoot["arc-start"] !== undefined &&
    area.shoot["arc-end"] !== undefined
  ) {
    arcWidth = arcSize;
    const arcX = contentX + (weaponWidth > 0 ? weaponWidth + 20 : 0);
    const arcY = (contentHeight - arcSize) / 2;
    elements.push(
      <FiringArcSVG
        arcStart={area.shoot["arc-start"]!}
        arcEnd={area.shoot["arc-end"]!}
        size={arcSize}
        x={arcX}
        y={arcY}
      />
    );
    contentHeight = Math.max(contentHeight, arcSize);
  }

  // Description.
  if (area.description && area.description.length > 0) {
    const descText = fixDegrees(area.description);
    const descX =
      contentX +
      (weaponWidth > 0 ? weaponWidth + 20 : 0) +
      (arcWidth > 0 ? arcWidth + 10 : 0);
    const availableWidth =
      maxDescWidth -
      (weaponWidth > 0 ? weaponWidth + 20 : 0) -
      (arcWidth > 0 ? arcWidth + 10 : 0);
    const lines = wrapText(descText, descFont, availableWidth - 30);
    const lineHeight = TILE_DESCRIPTION_SIZE + 4;
    const totalTextHeight = lines.length * lineHeight - 4;

    let descY: number;
    if (area.shoot || area.engine) {
      descY = 0;
    } else {
      const baselineOffset = Math.floor(TILE_DESCRIPTION_SIZE / 4);
      descY = (60 - totalTextHeight) / 2 - baselineOffset;
    }

    elements.push(
      <g>
        {lines.map((line, i) => (
          <text
            x={descX}
            y={descY + i * lineHeight}
            dominant-baseline="hanging"
            style={{ font: descFont, fill: "black" }}
          >
            {line}
          </text>
        ))}
      </g>
    );

    contentHeight = Math.max(
      contentHeight,
      area.shoot || area.engine ? totalTextHeight : 60
    );
  }

  return { el: <g>{elements}</g>, contentHeight };
}

function renderCostSymbols(cost: { energy?: number; crew?: number }) {
  const energyCount = cost.energy ?? 0;
  const crewCount = cost.crew ?? 0;
  const total = energyCount + crewCount;
  if (total === 0) return { el: null as JSX.Element, height: 0, width: 0 };

  const symbolSize = ICON_SIZE;
  const gap = 10;

  // Same pairing layout as python/src/system.py::generate_cost_symbols:
  // pairs stacked vertically, last odd one centered.
  const symbols: Array<"energy" | "crew"> = [];
  for (let i = 0; i < energyCount; i++) symbols.push("energy");
  for (let i = 0; i < crewCount; i++) symbols.push("crew");

  const rows: Array<{ left?: "energy" | "crew"; right?: "energy" | "crew"; single?: boolean }> = [];
  let idx = 0;
  while (idx < symbols.length) {
    if (symbols.length - idx >= 2) {
      rows.push({ left: symbols[idx], right: symbols[idx + 1] });
      idx += 2;
    } else {
      rows.push({ left: symbols[idx], single: true });
      idx += 1;
    }
  }

  const height = rows.length * symbolSize + (rows.length - 1) * gap;
  const width = symbolSize * 2 + gap;

  const hrefFor = (s: "energy" | "crew") =>
    s === "energy" ? "/resources/energy_symbol.png" : "/resources/crew_symbol.png";

  const el = (
    <g>
      {rows.map((row, i) => {
        const y = i * (symbolSize + gap);
        if (row.single) {
          return (
            <image
              href={hrefFor(row.left!)}
              x={(width - symbolSize) / 2}
              y={y}
              width={symbolSize}
              height={symbolSize}
            />
          );
        }
        return (
          <g>
            <image
              href={hrefFor(row.left!)}
              x={0}
              y={y}
              width={symbolSize}
              height={symbolSize}
            />
            <image
              href={hrefFor(row.right!)}
              x={symbolSize + gap}
              y={y}
              width={symbolSize}
              height={symbolSize}
            />
          </g>
        );
      })}
    </g>
  );

  return { el, height, width };
}

function renderAreas(system: System, yStart: number) {
  const areaMargin = Math.floor(TILE_HEIGHT * 0.02);
  let currentY = yStart + areaMargin;
  const elements: JSX.Element[] = [];

  const costColumnWidth = 150;
  const contentColumnWidth = TILE_WIDTH - 2 * HORIZONTAL_MARGIN - costColumnWidth - 20;
  const contentX = HORIZONTAL_MARGIN + costColumnWidth + 20;

  system.areas.forEach((area, idx) => {
    if (idx > 0) {
      const dividerY = currentY + VERTICAL_SPACING;
      const dividerStart = (TILE_WIDTH - TILE_WIDTH * 0.9) / 2;
      const dividerEnd = dividerStart + TILE_WIDTH * 0.9;
      elements.push(
        <line
          x1={dividerStart}
          y1={dividerY}
          x2={dividerEnd}
          y2={dividerY}
          stroke="black"
          stroke-width={2}
        />
      );
      currentY = dividerY + VERTICAL_SPACING;
    }

    const cost = renderCostSymbols(area.cost ?? {});
    const content = renderAction(area, 0, contentColumnWidth);

    const minAreaHeight = 95;
    let totalHeight = Math.max(minAreaHeight, Math.max(cost.height, content.contentHeight));
    if (system.areas.length === 1) totalHeight = Math.max(totalHeight, 115);

    const verticalOffset = 10;
    const costY = currentY + (totalHeight - cost.height) / 2 + verticalOffset;
    const contentY = currentY + (totalHeight - content.contentHeight) / 2 + verticalOffset;

    if (cost.el) {
      elements.push(
        <g transform={`translate(${HORIZONTAL_MARGIN} ${costY})`}>{cost.el}</g>
      );
    }
    elements.push(
      <g transform={`translate(${contentX} ${contentY})`}>{content.el}</g>
    );

    currentY += totalHeight + VERTICAL_SPACING;
  });

  currentY += Math.floor(areaMargin * 0.7);

  return { el: <g>{elements}</g>, height: currentY - yStart };
}

// ---------------------------------------------------------------------------
// System icons (top-left weapon/main, bottom-right hull/electronics/life)
// ---------------------------------------------------------------------------

function iconList(system: System, flags: Array<{ key: keyof System; href: string }>) {
  return flags.filter((f) => (system as any)[f.key]);
}

function renderTopLeftIcons(system: System, yRef: number) {
  const icons = iconList(system, [
    { key: "weapon", href: "/resources/weapon_icon.png" },
    { key: "main", href: "/resources/star_icon.png" },
  ]);
  if (icons.length === 0) return null;

  const iconSize = ICON_SIZE;
  const spacing = 10;
  const totalWidth = icons.length * iconSize + (icons.length - 1) * spacing;
  const bgPadding = 10;
  const bgWidth = totalWidth + 2 * bgPadding;
  const bgHeight = iconSize + 2 * bgPadding;
  const bgX = 0;
  const bgY = yRef - 6;
  const slopeWidth = Math.floor(bgHeight * 0.577);

  return (
    <g>
      <polygon
        points={`${bgX},${bgY} ${bgX + bgWidth + slopeWidth},${bgY} ${
          bgX + bgWidth
        },${bgY + bgHeight} ${bgX},${bgY + bgHeight}`}
        fill="black"
      />
      {icons.map((icon, i) => (
        <image
          href={icon.href}
          x={bgX + bgPadding + i * (iconSize + spacing)}
          y={bgY + bgPadding}
          width={iconSize}
          height={iconSize}
        />
      ))}
    </g>
  );
}

function renderBottomRightIcons(system: System, y: number) {
  const icons = iconList(system, [
    { key: "hull", href: "/resources/hull_icon.png" },
    { key: "electronics", href: "/resources/electric_icon.png" },
    { key: "life_support", href: "/resources/life_support_icon.png" },
  ]);
  if (icons.length === 0) return { el: null as JSX.Element };

  const iconSize = ICON_SIZE;
  const spacing = 10;
  const totalWidth = icons.length * iconSize + (icons.length - 1) * spacing;
  const bgPadding = 10;
  const bgWidth = totalWidth + 2 * bgPadding;
  const bgHeight = iconSize + 2 * bgPadding;
  const bgX = TILE_WIDTH - bgWidth;
  const bgY = y - bgHeight + 6;
  const slopeWidth = Math.floor(bgHeight * 0.577);

  return {
    el: (
      <g>
        <polygon
          points={`${bgX},${bgY} ${bgX + bgWidth},${bgY} ${bgX + bgWidth},${
            bgY + bgHeight
          } ${bgX - slopeWidth},${bgY + bgHeight}`}
          fill="black"
        />
        {icons.map((icon, i) => (
          <image
            href={icon.href}
            x={bgX + bgPadding + i * (iconSize + spacing)}
            y={bgY + bgPadding}
            width={iconSize}
            height={iconSize}
          />
        ))}
      </g>
    ),
  };
}

// ---------------------------------------------------------------------------
// Public: layout + render
// ---------------------------------------------------------------------------

export interface SystemLayout {
  el: JSX.Element;
  width: number;
  height: number;
}

export function layoutSystem(system: System): SystemLayout {
  const effectiveWidth =
    system.kind === "mess" && system.med_bay > 0
      ? Math.floor(TILE_WIDTH * 0.7)
      : TILE_WIDTH;

  let y = VERTICAL_MARGIN;
  const parts: JSX.Element[] = [];

  // Title
  const title = renderTitle(system, effectiveWidth, y);
  parts.push(title.el);
  y += title.height + VERTICAL_SPACING;

  // Rules
  const rules = renderRules(system, effectiveWidth, y);
  if (rules.el) parts.push(rules.el);
  y += rules.height;

  // Special content
  if (system.kind === "mess") {
    const m = renderMess(system, y);
    if (m.el) parts.push(m.el);
    y += m.height;
  } else if (system.kind === "reactor") {
    const r = renderReactor(system, y);
    if (r.el) parts.push(r.el);
    y += r.height + VERTICAL_SPACING;
  } else if (system.kind === "engine") {
    y += Math.floor(TILE_HEIGHT * 0.03);
    const e = renderEngine(system, y);
    if (e.el) parts.push(e.el);
    y += e.height + VERTICAL_SPACING;
  }

  // Areas
  if (system.areas.length > 0) {
    const a = renderAreas(system, y);
    parts.push(a.el);
    y += a.height;
  } else if (system.kind === "generic") {
    y += 100; // minimum system height padding (matches Python)
  }

  // Bottom-right icons (anchored at current y)
  const br = renderBottomRightIcons(system, y);
  if (br.el) parts.push(br.el);

  // Top-left icons (at the top, after title)
  const tl = renderTopLeftIcons(system, VERTICAL_MARGIN);
  if (tl) parts.push(tl);

  y += VERTICAL_MARGIN;

  const height = y;

  const el = (
    <g>
      <rect
        x={0}
        y={0}
        width={TILE_WIDTH}
        height={height}
        fill="white"
        stroke="black"
        stroke-width={BORDER_WIDTH}
      />
      {parts}
    </g>
  );

  return { el, width: TILE_WIDTH, height };
}

interface SystemSVGProps {
  system: System;
  x?: number;
  y?: number;
  /** Optional uniform scale factor applied around the top-left. */
  scale?: number;
}

export function SystemSVG(props: SystemSVGProps): JSX.Element {
  const layout = () => layoutSystem(props.system);
  const tx = () => props.x ?? 0;
  const ty = () => props.y ?? 0;
  const s = () => props.scale ?? 1;
  return (
    <g transform={`translate(${tx()} ${ty()}) scale(${s()})`}>
      {layout().el}
    </g>
  );
}
