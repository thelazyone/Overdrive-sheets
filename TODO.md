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

## UI

- Slot inspector is read-only for now; system-level editing (rename, tweak rules, add/remove areas, edit shoot stats) is not wired.
- No slot → inline "unlock" to turn a chosen slot back into a freeform system.
- Developer-mode library editor (CRUD over `systems.json`) is still missing.
