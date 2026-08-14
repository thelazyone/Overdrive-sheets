import { jsPDF } from "jspdf";

import { SHEET_HEIGHT, SHEET_WIDTH } from "./constants";

export type FleetPdfPageFormat = "a4" | "letter";

/** Page size in mm (portrait). */
const FORMAT_MM: Record<FleetPdfPageFormat, [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
};

function shipsPerPageForFormat(format: FleetPdfPageFormat): number {
  return format === "a4" ? 2 : 1;
}

/** Print resolution for embedded sheet images. */
export const PDF_IMAGE_DPI = 300;

const MM_PER_INCH = 25.4;

/**
 * Pixel width a sheet raster needs to hit {@link PDF_IMAGE_DPI} once placed in
 * this format's print box. Rasterizing larger just inflates the file: the extra
 * pixels are thrown away by the printer.
 *
 * Must mirror the geometry in {@link buildFleetPdfFromJpegs}.
 */
export function sheetRasterWidthPxForFormat(
  format: FleetPdfPageFormat,
  marginMm = 12,
  gapBetweenShipsMm = 6,
  dpi = PDF_IMAGE_DPI,
): number {
  const [pageW, pageH] = FORMAT_MM[format];
  const maxW = pageW - 2 * marginMm;
  const maxH = pageH - 2 * marginMm;
  const boxH =
    shipsPerPageForFormat(format) === 2
      ? (maxH - gapBetweenShipsMm) / 2
      : maxH;
  const { drawW } = fitSizeInBox(maxW, boxH);
  return Math.round((drawW / MM_PER_INCH) * dpi);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("Failed to read image blob."));
    r.readAsDataURL(blob);
  });
}

const SHEET_ASPECT = SHEET_WIDTH / SHEET_HEIGHT;

function fitSizeInBox(boxW: number, boxH: number): { drawW: number; drawH: number } {
  let drawW = boxW;
  let drawH = boxW / SHEET_ASPECT;
  if (drawH > boxH) {
    drawH = boxH;
    drawW = boxH * SHEET_ASPECT;
  }
  return { drawW, drawH };
}

function addImageCentered(
  doc: jsPDF,
  dataUrl: string,
  originX: number,
  originY: number,
  regionW: number,
  regionH: number,
): void {
  const { drawW, drawH } = fitSizeInBox(regionW, regionH);
  const x = originX + (regionW - drawW) / 2;
  const y = originY + (regionH - drawH) / 2;
  doc.addImage(dataUrl, "JPEG", x, y, drawW, drawH);
}

/**
 * Letter: one JPEG sheet per page (full printable area). A4: up to two stacked
 * per page; last page may have one.
 */
export async function buildFleetPdfFromJpegs(
  jpegBlobs: Blob[],
  format: FleetPdfPageFormat,
  marginMm = 12,
  gapBetweenShipsMm = 6,
): Promise<Blob> {
  if (jpegBlobs.length === 0) {
    throw new Error("No ship images to put in the PDF.");
  }

  const shipsPerPage = shipsPerPageForFormat(format);

  const [pageW, pageH] = FORMAT_MM[format];
  const doc = new jsPDF({
    unit: "mm",
    format: [pageW, pageH],
    orientation: "portrait",
    compress: true,
  });

  const maxW = pageW - 2 * marginMm;
  const maxH = pageH - 2 * marginMm;

  for (let i = 0; i < jpegBlobs.length; i += shipsPerPage) {
    if (i > 0) {
      doc.addPage();
    }

    const slice = jpegBlobs.slice(i, i + shipsPerPage);

    if (slice.length === 2) {
      const slotH = (maxH - gapBetweenShipsMm) / 2;
      const topY = marginMm;
      const bottomY = marginMm + slotH + gapBetweenShipsMm;

      const topUrl = await blobToDataUrl(slice[0]!);
      addImageCentered(doc, topUrl, marginMm, topY, maxW, slotH);

      const bottomUrl = await blobToDataUrl(slice[1]!);
      addImageCentered(doc, bottomUrl, marginMm, bottomY, maxW, slotH);
    } else {
      const dataUrl = await blobToDataUrl(slice[0]!);
      addImageCentered(doc, dataUrl, marginMm, marginMm, maxW, maxH);
    }
  }

  return doc.output("blob");
}
