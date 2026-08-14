/**
 * Rasterize the **on-screen** ship preview to JPEG.
 *
 * Uses `html-to-image` (`toBlob`). The library discovers webfonts by walking
 * HTMLElement trees only — SVG `<text>` never contributes “used” families, so
 * Titillium used purely inside the sheet SVG can be omitted from embedded
 * `@font-face` rules and raster text falls back to Times while the browser
 * preview still looks correct.
 *
 * For export we inject fully inlined CSS for the same Google Fonts bundle as
 * `index.html` (Orbitron + Titillium at weights we load), so JPEG matches web.
 *
 * {@link SHEET_WIDTH} defines export width at 300 DPI; pixel ratio scales from the
 * live preview width.
 */

import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { render } from "solid-js/web";

import type { Ship } from "../schema";
import {
  SHEET_LABEL_SIZE,
  SHEET_SHIELDS_SIZE,
  SHEET_STATS_SIZE,
  SHEET_SUBTITLE_SIZE,
  SHEET_TITLE_SIZE,
  SHEET_WIDTH,
  TILE_AREA_TITLE_SIZE,
  TILE_COMBAT_NUMBER_SIZE,
  TILE_DESCRIPTION_SIZE,
  TILE_SUBTITLE_SIZE,
  TILE_TITLE_SIZE,
  cssFont,
  FONT_EUROSTILE,
} from "./constants";
import { waitForFonts } from "./measure";
import { ShipSVG } from "./ShipSVG";

const PREVIEW_SELECTOR = ".ship-preview-wrapper";

/** Same families/weights as `web/index.html` (ampersand-encoded there). */
const GOOGLE_FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Titillium+Web:wght@400;600;700&display=swap";

const FONT_EMBED_OPTS = {
  preferredFontFormat: "woff2" as const,
  cacheBust: false,
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Avoid stack limits on huge binary fonts when base64-encoding. */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchGoogleFontsCssLayer(): Promise<string> {
  const res = await fetch(GOOGLE_FONTS_CSS_URL);
  if (!res.ok) {
    throw new Error(`Google Fonts CSS HTTP ${res.status}`);
  }
  let css = await res.text();
  const trimmed = css.trim();
  const importWrap = trimmed.match(/^@import\s+url\(([^)]+)\)/);
  if (importWrap && !trimmed.includes("@font-face")) {
    const inner = importWrap[1].replace(/["']/g, "").trim();
    const innerRes = await fetch(inner);
    if (!innerRes.ok) {
      throw new Error(`Imported Fonts CSS HTTP ${innerRes.status}`);
    }
    css = await innerRes.text();
  }
  return css;
}

/**
 * Expand every `fonts.gstatic.com` URL in the stylesheet to `data:` so the
 * cloned SVG-in-foreignObject snapshot cannot miss loading Titillium for `<text>`.
 */
async function embedGStaticFontsInCss(css: string): Promise<string> {
  const re =
    /url\((['"]?)(https:\/\/fonts\.gstatic\.com[^)'"]+)\1\)/g;
  const urls = [...css.matchAll(re)].map((m) => m[2]);
  const unique = [...new Set(urls)];
  const replacement = new Map<string, string>();

  for (const url of unique) {
    const fontRes = await fetch(url);
    if (!fontRes.ok) {
      throw new Error(`Font fetch HTTP ${fontRes.status}: ${url}`);
    }
    const buf = new Uint8Array(await fontRes.arrayBuffer());
    const b64 = uint8ToBase64(buf);
    replacement.set(url, `url(data:font/woff2;base64,${b64})`);
  }

  let out = css;
  for (const [url, dataUrl] of replacement) {
    out = out.replace(
      new RegExp(`url\\((['"]?)${escapeRegex(url)}\\1\\)`, "g"),
      dataUrl,
    );
  }
  return out;
}

/** Orbitron faces only — used by {@link fontEmbedCSSViaHtmlProbeFallback}. */
function buildOrbitronProbe(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText =
    "position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";

  const span = (styleFont: string) => {
    const s = document.createElement("span");
    s.textContent = "Aa";
    s.style.font = styleFont;
    root.appendChild(s);
  };

  span(cssFont(SHEET_TITLE_SIZE, FONT_EUROSTILE));
  span(cssFont(SHEET_STATS_SIZE, FONT_EUROSTILE));
  span(cssFont(SHEET_LABEL_SIZE, FONT_EUROSTILE));
  span(cssFont(SHEET_SHIELDS_SIZE, FONT_EUROSTILE));
  span(cssFont(TILE_TITLE_SIZE, FONT_EUROSTILE));
  span(cssFont(TILE_COMBAT_NUMBER_SIZE, FONT_EUROSTILE));
  span(cssFont(Math.floor(TILE_AREA_TITLE_SIZE * 0.75), FONT_EUROSTILE));

  return root;
}

function buildTitilliumProbe(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText =
    "position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";

  const spanPx = (sizePx: number) => {
    const s = document.createElement("span");
    s.textContent = "Gg";
    s.style.fontFamily = '"Titillium Web", sans-serif';
    s.style.fontWeight = "600";
    s.style.fontStyle = "normal";
    s.style.fontSize = `${sizePx}px`;
    s.style.lineHeight = "normal";
    root.appendChild(s);
  };

  spanPx(SHEET_SUBTITLE_SIZE);
  spanPx(TILE_SUBTITLE_SIZE);
  spanPx(TILE_DESCRIPTION_SIZE);

  return root;
}

async function fontEmbedCSSViaHtmlProbeFallback(): Promise<string> {
  const orbitProbe = buildOrbitronProbe();
  const titProbe = buildTitilliumProbe();
  document.body.appendChild(orbitProbe);
  document.body.appendChild(titProbe);
  try {
    const [orbitCss, titCss] = await Promise.all([
      getFontEmbedCSS(orbitProbe, FONT_EMBED_OPTS),
      getFontEmbedCSS(titProbe, FONT_EMBED_OPTS),
    ]);
    return `${orbitCss}\n${titCss}`;
  } finally {
    orbitProbe.remove();
    titProbe.remove();
  }
}

let cachedFontEmbedCSS: string | undefined;

async function fontEmbedCSSForShipRaster(): Promise<string> {
  if (cachedFontEmbedCSS !== undefined) {
    return cachedFontEmbedCSS;
  }

  try {
    const raw = await fetchGoogleFontsCssLayer();
    cachedFontEmbedCSS = await embedGStaticFontsInCss(raw);
    return cachedFontEmbedCSS;
  } catch (e) {
    console.warn(
      "Full Google Fonts embed failed; falling back to html-to-image probes.",
      e,
    );
    cachedFontEmbedCSS = await fontEmbedCSSViaHtmlProbeFallback();
    return cachedFontEmbedCSS;
  }
}

/**
 * `html-to-image`'s `toBlob` drops the caller's `type`/`quality` on the floor —
 * it calls `canvasToBlob(canvas)` with no options, so it always hands back a
 * **PNG at quality 1** no matter what we ask for. Feeding that to
 * `jsPDF.addImage(..., "JPEG", ...)` made jsPDF fall back to storing a raw
 * bitmap, which is where the ~50 MB two-page PDFs came from.
 *
 * So we rasterize with `toCanvas` and encode the JPEG ourselves.
 */
function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("JPEG encoding produced an empty image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function rasterizePreviewElementToJpegBlob(
  el: HTMLElement,
  pixelRatio: number,
  jpegQuality = 0.9,
): Promise<Blob> {
  if (!el.querySelector("svg")) {
    throw new Error("Ship preview SVG is not ready yet.");
  }

  const fontEmbedCSS = await fontEmbedCSSForShipRaster();

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const canvas = await toCanvas(el, {
    pixelRatio,
    backgroundColor: "#ffffff",
    cacheBust: true,
    fontEmbedCSS,
    preferredFontFormat: "woff2",
  });

  return canvasToJpegBlob(canvas, jpegQuality);
}

export async function rasterizeShipSheetToJpegBlob(
  jpegQuality = 0.94,
): Promise<Blob> {
  await waitForFonts();

  const el = document.querySelector(PREVIEW_SELECTOR) as HTMLElement | null;
  if (!el) {
    throw new Error("Ship preview element not found.");
  }

  const w = el.offsetWidth;
  if (w <= 0) {
    throw new Error("Ship preview has no layout width.");
  }

  return rasterizePreviewElementToJpegBlob(el, SHEET_WIDTH / w, jpegQuality);
}

/**
 * Rasterize a ship sheet without touching the live preview (e.g. fleet PDF).
 */
export async function rasterizeShipSheetToJpegBlobOffscreen(
  ship: Ship,
  options: {
    containerWidthPx?: number;
    jpegQuality?: number;
    /** Raster width in pixels. Defaults to {@link SHEET_WIDTH} (full A5 at 300
     *  DPI). The fleet PDF passes the width its print box actually needs, so
     *  the embedded image lands at 300 DPI instead of well above it. */
    targetWidthPx?: number;
  } = {},
): Promise<Blob> {
  await waitForFonts();

  const widthPx = options.containerWidthPx ?? 1200;
  const outer = document.createElement("div");
  outer.setAttribute("aria-hidden", "true");
  outer.style.cssText = `position:fixed;left:-9999px;top:0;width:${widthPx}px;opacity:0;pointer-events:none;z-index:-1`;

  const wrap = document.createElement("div");
  wrap.className = "ship-preview-wrapper";
  wrap.style.cssText =
    "width:100%;max-width:none;aspect-ratio:21 / 14.8;background:#ffffff;box-shadow:none";

  outer.appendChild(wrap);
  document.body.appendChild(outer);

  const dispose = render(() => <ShipSVG ship={ship} responsive />, wrap);

  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (wrap.offsetWidth <= 0) {
      throw new Error("Off-screen ship preview has no layout width.");
    }
    const targetWidthPx = options.targetWidthPx ?? SHEET_WIDTH;
    const pixelRatio = targetWidthPx / wrap.offsetWidth;
    return await rasterizePreviewElementToJpegBlob(
      wrap,
      pixelRatio,
      options.jpegQuality ?? 0.9,
    );
  } finally {
    dispose();
    outer.remove();
  }
}
