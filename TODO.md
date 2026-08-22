# TODOs

## Fonts

The original `fonts/Eurostile Extended Bold.ttf` has a malformed `cmap` subtable that Chrome's OTS (OpenType Sanitizer) refuses to parse, even after round-tripping through `fontTools` to WOFF2. Pillow (Python tool) is lenient and accepts it.

**Current workaround**: the web app uses Google Fonts over CDN:

- `Titillium Web` — direct match for the Python tool's body font.
- `Orbitron` — stand-in for `Eurostile Extended` (wide, geometric, sci-fi feel). Not a perfect match.

**What to do later**

- Source a clean `Eurostile Extended` TTF/OTF with a valid cmap and re-convert to WOFF2 via `web/scripts/build-fonts.py`.
- Or license/pick a closer free substitute (e.g. "Saira", "Michroma", "Good Times") and update `constants.ts` + `fonts.css` accordingly.
- Once swapped in, re-check the Python tool still loads the source TTF via Pillow (`python/src/system.py` references paths in `fonts/`).

## Modular ("print class") printing

- Tile sizes are plain constants in `web/src/core/render/sheetLayout.ts`:
  `MODULAR_SECTION_TILE_HEIGHT` (240), `MODULAR_ENGINE_TILE_HEIGHT` (380),
  `MODULAR_CORE_TILE_HEIGHT` (260, reactor/mess) and the shields box height.
  One fixed size per class for every ship, so cut-outs are interchangeable
  across classes. Raise a constant if a system's text needs more room — all
  four presets currently have 199+ units of column slack, so there is plenty.
- Column geometry (easy to get wrong): the Reactor/Mess boxes sit under the
  **left** column and the Shields box under the **right** one. The **centre**
  column is unobstructed and runs to the bottom of the sheet.
- `modularOversizedSystems` / `overflowingColumns` in `modularMetrics.ts` back
  the preview warning; they are diagnostics only and never resize anything.
- `MODULAR_MAX_SLOTS_PER_COLUMN` is 4 — a design guideline, reported in the
  preview but not enforced.

## UI

- Slot inspector is read-only for now; system-level editing (rename, tweak rules, add/remove areas, edit shoot stats) is not wired.
- No slot → inline "unlock" to turn a chosen slot back into a freeform system.
- Developer-mode library editor (CRUD over `systems.json`) is still missing.
