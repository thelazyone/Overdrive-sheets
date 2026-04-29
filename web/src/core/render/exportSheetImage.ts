/**
 * Rasterize the on-screen ship sheet SVG to JPEG.
 *
 * {@link SHEET_WIDTH} / {@link SHEET_HEIGHT} are defined at 300 DPI (see constants.ts),
 * so painting at that pixel size matches print-quality output.
 *
 * Blob-URL rasterization strips document styles, so we inject the same Google Fonts
 * `@import` as `fonts.css` and rewrite `/resources/...` image hrefs to absolute URLs.
 */

import { SHEET_HEIGHT, SHEET_WIDTH } from "./constants";
import { waitForFonts } from "./measure";

const GOOGLE_FONTS_CSS = `https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Titillium+Web:wght@400;600;700&display=block`;

const SVG_NS = "http://www.w3.org/2000/svg";

function rewriteSvgImageHrefsToAbsolute(svg: SVGSVGElement): void {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  for (const el of svg.querySelectorAll("image")) {
    const href =
      el.getAttribute("href") ??
      el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href || href.startsWith("data:")) continue;
    let absolute: string;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      absolute = href;
    } else if (href.startsWith("/")) {
      absolute = origin + href;
    } else {
      absolute = new URL(href, origin + "/").href;
    }
    el.setAttribute("href", absolute);
    el.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  }
}

function injectGoogleFontsImport(svg: SVGSVGElement): void {
  let defs = svg.querySelector(":scope > defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const style = document.createElementNS(SVG_NS, "style");
  style.setAttribute("type", "text/css");
  style.textContent = `@import url('${GOOGLE_FONTS_CSS}');`;
  defs.insertBefore(style, defs.firstChild);
}

/**
 * Clone the live preview SVG, fix URLs/fonts for standalone rasterization, and
 * encode as JPEG at sheet pixel dimensions (300 DPI coordinate space).
 */
export async function rasterizeShipSheetToJpegBlob(
  svg: SVGSVGElement,
  jpegQuality = 0.94,
): Promise<Blob> {
  await waitForFonts();

  const clone = svg.cloneNode(true) as SVGSVGElement;
  rewriteSvgImageHrefsToAbsolute(clone);
  injectGoogleFontsImport(clone);

  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", SVG_NS);
  }
  clone.setAttribute("width", String(SHEET_WIDTH));
  clone.setAttribute("height", String(SHEET_HEIGHT));

  const vb = clone.getAttribute("viewBox");
  if (!vb) {
    clone.setAttribute("viewBox", `0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`);
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode SVG for export."));
      img.src = url;
    });

    try {
      await img.decode();
    } catch {
      /* decode optional */
    }
    await new Promise((r) => setTimeout(r, 150));

    const canvas = document.createElement("canvas");
    canvas.width = SHEET_WIDTH;
    canvas.height = SHEET_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
    ctx.drawImage(img, 0, 0, SHEET_WIDTH, SHEET_HEIGHT);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("JPEG encoding failed."));
        },
        "image/jpeg",
        jpegQuality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
