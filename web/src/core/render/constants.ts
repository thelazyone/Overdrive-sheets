/**
 * Layout constants ported from the Python tool.
 *
 * All units are SVG user-space units. We pick a unit = 1 pixel at 300 DPI so
 * the numbers match the Python 1:1 and the PNG/JPG export is automatically
 * print-quality.
 *
 * Sources:
 *   python/src/ship_profile.py  - A5 page layout
 *   python/src/system.py        - tile dimensions, margins, icon sizes, fonts
 *   python/src/shields.py       - shield icon size
 *   python/src/overdrive.py     - overdrive square size
 */

const DPI = 300;
const CM_TO_PX = DPI / 2.54;

/** A5 landscape sheet. */
export const SHEET_WIDTH = Math.round(21.0 * CM_TO_PX);
export const SHEET_HEIGHT = Math.round(14.8 * CM_TO_PX);

/** Individual system tile: 8 cm x 4 cm at 300 DPI. */
export const TILE_WIDTH = Math.round(8 * CM_TO_PX);
export const TILE_HEIGHT = Math.round(4 * CM_TO_PX);

/** Fonts (CSS font-family + weight). */
export interface FontSpec {
  family: string;
  weight: number;
}

// NOTE: the Python tool uses the original `fonts/Eurostile Extended Bold.ttf`,
// but that file has a malformed cmap subtable that Chrome's OTS rejects.
// Until we source a clean version (see TODO.md) the web app uses Google's
// `Orbitron` as a stand-in for the wide sci-fi title font.
export const FONT_TITLE: FontSpec = { family: "Orbitron", weight: 700 };
export const FONT_SUBTITLE: FontSpec = { family: "Titillium Web", weight: 600 };
export const FONT_EUROSTILE: FontSpec = { family: "Orbitron", weight: 700 };
export const FONT_TITILLIUM: FontSpec = { family: "Titillium Web", weight: 600 };

/** System tile font sizes (mirror python/src/system.py::load_fonts). */
export const TILE_TITLE_SIZE = 45;
export const TILE_SUBTITLE_SIZE = 40;
export const TILE_AREA_TITLE_SIZE = 32;
export const TILE_DESCRIPTION_SIZE = 40;
export const TILE_COMBAT_NUMBER_SIZE = 41;

/** Ship sheet font sizes (mirror python/src/ship_profile.py::load_fonts). */
export const SHEET_TITLE_SIZE = 48;
export const SHEET_SUBTITLE_SIZE = 36;
export const SHEET_STATS_SIZE = 36;
export const SHEET_SHIELDS_SIZE = 28;
export const SHEET_LABEL_SIZE = 24;

/** Resource icon sizes. */
export const ICON_SIZE = 60;
export const ICON_SIZE_LARGE = 120;

/** Shield block size (python/src/shields.py line 74). */
export const SHIELD_ICON_SIZE = 80;

/** Overdrive token square size (python/src/overdrive.py line 13). */
export const OVERDRIVE_SQUARE_SIZE = 100;
export const OVERDRIVE_SQUARE_MARGIN = 8;

/** Misc. */
export const ENGINE_SLOT_SIZE = 200;

/** CSS font shorthand helper for offscreen canvas measuring. */
export function cssFont(size: number, font: FontSpec = FONT_TITILLIUM): string {
  return `${font.weight} ${size}px "${font.family}"`;
}
