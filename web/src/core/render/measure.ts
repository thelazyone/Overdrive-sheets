/**
 * Text measurement via an offscreen canvas. This is the web replacement for
 * Pillow's `draw.textbbox((0, 0), text, font=font)` used throughout
 * `python/src/system.py`.
 *
 * All fonts in `fonts.css` must have loaded before measurements are taken,
 * otherwise the canvas falls back to the default system font and returns
 * wrong widths. Use {@link waitForFonts} once at startup.
 */

import { cssFont, FONT_EUROSTILE, FONT_TITILLIUM, type FontSpec } from "./constants";

let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getCtx() {
  if (ctx) return ctx;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(1, 1);
    ctx = canvas.getContext("2d")!;
  } else {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d")!;
  }
  return ctx!;
}

export interface TextMetricsSimple {
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

/**
 * Measure a single line of text with the given CSS font shorthand.
 * Returns width + a reasonable height derived from the font ascent/descent.
 */
export function measureText(text: string, font: string): TextMetricsSimple {
  const c = getCtx();
  c.font = font;
  const m = c.measureText(text);
  const ascent = (m as any).actualBoundingBoxAscent ?? (m as any).fontBoundingBoxAscent ?? 0;
  const descent = (m as any).actualBoundingBoxDescent ?? (m as any).fontBoundingBoxDescent ?? 0;
  return {
    width: m.width,
    height: ascent + descent,
    ascent,
    descent,
  };
}

/** Convenience wrapper: measure with a font spec (size + family/weight). */
export function measureWith(
  text: string,
  size: number,
  font: FontSpec = FONT_TITILLIUM
): TextMetricsSimple {
  return measureText(text, cssFont(size, font));
}

/**
 * Await the fonts used by the renderer so measurements are correct.
 *
 * Individual `document.fonts.load(...)` calls can reject (Chrome raises a
 * NetworkError when a font fails OTS validation, see TODO.md). We catch per
 * face so one bad font never prevents the rest of the UI from rendering -
 * the browser will just fall back to the next family in the stack.
 */
export async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const specs = [
    cssFont(24, FONT_EUROSTILE),
    cssFont(28, FONT_EUROSTILE),
    cssFont(32, FONT_EUROSTILE),
    cssFont(36, FONT_EUROSTILE),
    cssFont(40, FONT_TITILLIUM),
    cssFont(41, FONT_EUROSTILE),
    cssFont(45, FONT_EUROSTILE),
    cssFont(48, FONT_EUROSTILE),
  ];
  await Promise.allSettled(specs.map((s) => document.fonts.load(s, "Mg")));
  try {
    await document.fonts.ready;
  } catch {
    // document.fonts.ready never rejects per spec, but be defensive.
  }
}
