# Layout Studio

Independent SolidJS/Vite entry at `web/studio/index.html`, built to
`dist/studio/index.html`. Uses the repository's existing Pages base; no service,
database, external font request, or separate hosting registration is needed.

## Authoring and export

- Controls edit a single design with separate text/artwork per layout. Changing
  layouts sets their suggested orientation; format and styling remain shared.
- Five trait PNGs are imported directly from the repo root. Their alpha channels
  mask the chosen text color, including black symbols in print mode.
- Orbitron variable (400–900) is bundled under `fonts/` with its OFL license, downloaded from
  Google Fonts. Titillium Web Regular/Bold reuse the repository-root font files.
- Color and printer-friendly palettes retain independent edits. Print mode does
  not recolor uploaded images. Open omits every text label and the barcode.
- Local storage autosaves the draft. Large images can exceed browser storage;
  the save-status text reports failures. Save design exports all layouts and
  embedded artwork as JSON. Open design validates version, fields and image types.
- SVG export includes fonts and trait/artwork images as data URLs. Decoration is
  vector; supplied trait PNGs and uploaded artwork remain raster. Text remains
  editable text, not outlined paths; SVG editors vary in embedded-font support.
- PNG uses pixel dimensions equivalent to 300 dpi at the chosen physical size
  (e.g. 88 × 63 mm gives 1039 × 744 px). Browser canvas PNG metadata may report
  96 dpi; assign the displayed physical size when placing it in print software.
- Print / PDF opens the browser print dialog with a card-sized page and zero
  margins. Print at 100% / actual size, with background graphics enabled and
  headers/footers disabled. Printer drivers may override custom paper sizes.
  Bleed area adds 5 mm on all sides to SVG, PNG and print exports. The preview
  shows a cyan cut boundary; Safe area marks 3 mm inside the cut edge. Guides
  are preview-only. There are no printed crop marks or multi-card imposition.
- Body text wraps at measured font widths and reports overflow. Overflow lines
  are omitted from exports, so resolve the warning before printing. Very wide
  custom formats are intended for Open; narrow text layouts show a warning.

## Code

`model.ts` owns format presets, draft validation and defaults; `render.ts` builds
SVG from a design and injected text-measure function; `assets.ts` embeds local
assets; `App.tsx` owns controls, local drafts and file actions. Coordinates are
normalized to a 1000-unit long edge. Card corners are fixed at 3 mm, sheets are square. Frame inset shifts all
four rails; Title inset adds extra top clearance. Cross spacing is the clear
gap between cross tips and rail endpoints. Only physical dimensions use
millimetres; other controls are relative design units. Sample copy is placeholder
content, not an authored game roster.

Run `npm run build` and `npm run test:studio` from `web/`.

Content is collapsible. Typography contains Frame, Title and Body subsections. Title groups the symbol
controls with title size and horizontal offset; Body groups body size, line
spacing and weight. Artwork share, upload and alignment live in the separate Image frame section. Character and Overdrive
image/effect dividers use the same crosses and gaps as the outer frame and
extend to the bleed edges.
Title inset defaults to 70 (range 0–150); the title sits above the top crosses,
with a horizontal offset beside a vector L. Its top follows the fitted title's
capital O ink height; three cuts at 30 degrees from vertical follow the capital I
ink width, with white intervals 1.25 times that width. The category band fits its
text and ends at the same angle. Cross spacing controls frame clearance.
An optional uploaded logo fits inside the upright. Legacy symbol geometry
settings remain readable in saved designs; automatic geometry replaces them.

Title spacing and weight are editable. Title fitting includes tracking; the L
and cuts use the fitted title metrics at the selected font weight. Cutouts
overshoot both band edges to avoid antialiased seams.

Cross clearance follows the two arms, with no square knockout. Cross size
does not affect title or trait positions. Title gap from L applies equally
beside the upright and above the lower band; letter spacing is separate.

Image margin insets artwork from frame rails and masks the L silhouette with
the same clearance. Images retain rectangular fitting beneath the mask. L arm
thickness controls both the upright width and band height. The built-in greater
than mark is enlarged, with its microtext left-aligned beneath it.

Style contains Image frame, Frame, Title and Body subsections. Title includes
independent diagonal bar thickness and subtitle size controls. The L is always
aligned to the left frame rail; legacy symbol offsets are ignored.

Style > Decoration controls shared mini-text size (default 4) and
Left decoration strip width. The strip reserves artwork space, wraps adaptive
vertical placeholder lines to the right of the rotated card ID, interrupts the left rail behind
the ID, and places two 2-unit outlined boxes near the image divider.

The ID starts just below the L. Both it and the vertical microtext lines
share the same top edge. Mini text uses tight, single-size line spacing.

Decoration controls are flat within their section. Mini text size ranges from
2 to 6 and remains fixed as the strip changes width. The number of vertical
lines adapts down to one. Their right ink edge meets the image-margin boundary,
so Image margin alone determines the gap to the artwork.

Left decoration text is editable per layout under Style > Decoration and saved
with the design. Older drafts receive the default RPA identity notice. Decoration text clips to the available columns without an overflow warning. The two rounded boxes have equal clearances from
the left and bottom rails and render with background fills above the crosses.

Character and Overdrive lower text panels reserve a right decoration column,
with editable three-line text, a vector RPA mark reconstructed from the supplied
592×614 reference, a title-derived 64-bit FNV-1a code and a decorative barcode
encoding that code (not a standard scanner format). Equal titles share a code;
hash collisions remain possible. Width is editable under Decoration, along with
trait size and spacing. The L upright can be thickened independently of its band.
Left badges are rounded vertical rectangles labeled 03 and 42.

The left card ID and decoration text begin six units below the L, independent
of Image margin. Character omits the bottom rail and bottom crosses; vertical
rails continue to the edge. Its barcode starts at the former bottom-rail
position (height minus Frame inset) and extends through bleed. The edition
text aligns its ink top to that same position.

Traits has its own Style subsection for selection, size, spacing and its top
barcode toggle. Decoration contains editable top and bottom text plus independent
barcode toggles. Top text defaults to FULL SPECTRUM OVERDRIVE at mini-text size;
bottom edition text retains size 12. Short edge barcodes encode 42 and 08 as
decorative binary patterns without printed number labels. Top barcodes reach
the upper bleed boundary, and the bottom barcode reaches the lower boundary.

Edge barcodes touch the inside of their frame rails and use the RPA dark color.
Mini-text weight is adjustable, with bundled Titillium regular, semibold and
bold faces. Mini-text lines use 1.15× spacing.
