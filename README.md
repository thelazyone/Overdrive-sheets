# Overdrive-sheets

A fast and dirty procedural builder to generate ship sheets for Full Spectrum Overdrive.

Two implementations share the same `fonts/` and `resources/` assets at the repo root:

- **`web/`** — SolidJS + Vite, client-only, live SVG preview, PNG/JSON export, slot-based ship templates.
- **`python/`** — original Pillow rasterizer, retained for reference and batch generation.

## Web Version

Requirements: Node 18+.

```
cd web
npm install
npm run dev                         # http://localhost:5173/
npm run build                       # static site in web/dist/
npx tsc --noEmit                    # typecheck
npx tsx scripts/verify-ships.ts     # validate presets + legacy ships + library
```

Web-specific presets live in `web/src/presets/*.json` and are selected via the toolbar dropdown. Reusable systems live in `web/src/core/library/systems.json` and are referenced by slot allow-lists.

### Fonts

The web app uses Google Fonts (`Titillium Web` + `Orbitron` as an Eurostile Extended stand-in). The shared `fonts/` folder is only consumed by the Python tool — see `TODO.md` for why and how to swap in a real Eurostile later.

## Python Version

Requirements: Python 3.x with `pillow` and `svglib` (no venv needed).

```
python python/ship_creator.py                               # generate every ship in python/ships/
python python/ship_creator.py -s python/ships/starliner.json
```

Ship JSONs live in `python/ships/`. Output `.jpg` sheets are written next to them.
