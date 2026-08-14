/**
 * Ported from `python/src/shields.py`.
 *
 * Renders the right-side shields box: a bordered rectangle containing
 * FRONT SHIELDS and REAR SHIELDS. Each row is:
 *   - one "no shields" block (white with black X)
 *   - then, for each shield value `n`: `n` blue blocks then one yellow block.
 *
 * Shields are a damageable system like any other, so the box also carries the
 * bottom-right damage-type chevron drawn by `SystemSVG::renderBottomRightIcons`.
 */

import { For, type JSX } from "solid-js";
import {
  cssFont,
  FONT_EUROSTILE,
  ICON_SIZE,
  SHEET_SHIELDS_SIZE,
  SHIELD_ICON_SIZE,
} from "./constants";
import { publicAsset } from "../../publicPath";

type BlockType = "none" | "slot" | "energy";

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  front: number[];
  rear: number[];
  hull?: boolean;
  electronics?: boolean;
  life_support?: boolean;
}

/**
 * Bottom-right damage-type chevron. Mirrors the geometry in
 * `SystemSVG::renderBottomRightIcons` so shields match the system tiles.
 */
function DamageTypeChevron(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  hull?: boolean;
  electronics?: boolean;
  life_support?: boolean;
}): JSX.Element {
  const icons = () =>
    [
      props.hull ? publicAsset("resources/hull_icon.png") : null,
      props.electronics ? publicAsset("resources/electric_icon.png") : null,
      props.life_support
        ? publicAsset("resources/life_support_icon.png")
        : null,
    ].filter((h): h is string => h !== null);

  const spacing = 10;
  const bgPadding = 10;
  const bgHeight = ICON_SIZE + 2 * bgPadding;
  const totalWidth = () =>
    icons().length * ICON_SIZE + (icons().length - 1) * spacing;
  const bgWidth = () => totalWidth() + 2 * bgPadding;
  const bgX = () => props.x + props.width - bgWidth();
  const bgY = () => props.y + props.height - bgHeight;
  const slopeWidth = Math.floor(bgHeight * 0.577);

  return (
    <>
      {icons().length > 0 && (
        <g>
          <polygon
            points={`${bgX()},${bgY()} ${bgX() + bgWidth()},${bgY()} ${
              bgX() + bgWidth()
            },${bgY() + bgHeight} ${bgX() - slopeWidth},${bgY() + bgHeight}`}
            fill="black"
          />
          <For each={icons()}>
            {(href, i) => (
              <image
                href={href}
                x={bgX() + bgPadding + i() * (ICON_SIZE + spacing)}
                y={bgY() + bgPadding}
                width={ICON_SIZE}
                height={ICON_SIZE}
              />
            )}
          </For>
        </g>
      )}
    </>
  );
}

function ShieldBlock(props: { type: BlockType; x: number; y: number; size: number }) {
  const radius = () => Math.round(props.size * 0.25);
  const border = () => Math.max(4, Math.round(props.size * 0.05));
  const fill = () =>
    props.type === "none"
      ? "white"
      : props.type === "slot"
      ? "rgb(135,206,235)"
      : "rgb(255,193,37)";

  return (
    <g>
      <rect
        x={props.x + border() / 2}
        y={props.y + border() / 2}
        width={props.size - border()}
        height={props.size - border()}
        rx={radius()}
        ry={radius()}
        fill={fill()}
        stroke="black"
        stroke-width={border()}
      />
      {props.type === "none" && (
        <>
          <line
            x1={props.x + props.size / 4}
            y1={props.y + props.size / 4}
            x2={props.x + (props.size * 3) / 4}
            y2={props.y + (props.size * 3) / 4}
            stroke="black"
            stroke-width={border()}
          />
          <line
            x1={props.x + (props.size * 3) / 4}
            y1={props.y + props.size / 4}
            x2={props.x + props.size / 4}
            y2={props.y + (props.size * 3) / 4}
            stroke="black"
            stroke-width={border()}
          />
        </>
      )}
    </g>
  );
}

/** Build the list of blocks from the "no-shield + pairs of (n slots + 1 energy)" pattern. */
function blocksFor(values: number[]): BlockType[] {
  const blocks: BlockType[] = ["none"];
  for (const n of values) {
    for (let i = 0; i < n; i++) blocks.push("slot");
    blocks.push("energy");
  }
  return blocks;
}

function Row(props: {
  label: string;
  values: number[];
  y: number;
  x: number;
  width: number;
}) {
  const gap = 4;
  const blocks = () => blocksFor(props.values);
  const totalWidth = () =>
    blocks().length * (SHIELD_ICON_SIZE + gap) - gap;
  const startX = () => props.x + (props.width - totalWidth()) / 2;
  const iconY = () => props.y + 40;

  return (
    <g>
      <text
        x={props.x + props.width / 2}
        y={props.y}
        text-anchor="middle"
        dominant-baseline="hanging"
        style={{ font: cssFont(SHEET_SHIELDS_SIZE, FONT_EUROSTILE), fill: "black" }}
      >
        {props.label}
      </text>
      <For each={blocks()}>
        {(b, i) => (
          <ShieldBlock
            type={b}
            x={startX() + i() * (SHIELD_ICON_SIZE + gap)}
            y={iconY()}
            size={SHIELD_ICON_SIZE}
          />
        )}
      </For>
    </g>
  );
}

export function ShieldsSVG(props: Props): JSX.Element {
  const labelHeight = 40;
  const groupHeight = labelHeight + SHIELD_ICON_SIZE;
  const totalHeight = groupHeight * 2;
  const startY = () => props.y + (props.height - totalHeight) / 2;

  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        fill="none"
        stroke="black"
        stroke-width={8}
      />
      <Row
        label="FRONT SHIELDS"
        values={props.front}
        y={startY() - 10}
        x={props.x}
        width={props.width}
      />
      <Row
        label="REAR SHIELDS"
        values={props.rear}
        y={startY() + groupHeight + 10}
        x={props.x}
        width={props.width}
      />
      <DamageTypeChevron
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        hull={props.hull}
        electronics={props.electronics}
        life_support={props.life_support}
      />
    </g>
  );
}
