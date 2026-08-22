# Overdrive-sheets

A fast and dirty procedural builder to generate ship sheets for Full Spectrum Overdrive.

Two implementations share the same `fonts/` and `resources/` assets at the repo root:

- **`web/`** — SolidJS + Vite, client-only, live SVG preview, PNG/JSON export, slot-based ship templates.
- **`python/`** — original Pillow rasterizer, retained for reference and batch generation.

## Web Version

Requirements: Node 18+.

**GitHub Pages** (after you enable it — see repo workflow): the builder is deployed under  
`https://<user>.github.io/<repo>/overdrive/` (e.g. `/Overdrive-sheets/overdrive/` for this repository). Pushes to `main` that touch `web/`, `resources/`, or the Web workflow run CI and publish automatically.

```
cd web
npm install
npm run dev                         # http://localhost:5173/
npm run build                       # static site in web/dist/
npx tsc --noEmit                    # typecheck
npx tsx scripts/verify-ships.ts     # validate presets + legacy ships + library
```

Web-specific presets live in `web/src/presets/*.json` and are selected via the toolbar dropdown. Reusable systems live in `web/src/core/library/systems.json` and are referenced by slot allow-lists.

### Print modes

“Print fleet” offers two ways to get a sheet onto paper:

- **Custom loadout** — the original output: each ship prints as one finished A5
  console with its currently installed systems. Changing a loadout means
  reprinting the sheet.
- **Modular class** — print once, re-loadout forever. The console prints with
  every *slot* left as a uniform blank space, and each slot option prints as a
  cut-out tile sized to drop onto any of those spaces. Fixed (inline) systems
  stay printed on the console, since they can't be swapped anyway. Cut the tiles
  out once; after that you rearrange the ship by moving cardboard instead of
  reprinting.

  On A4 two A5 sheets stack per page, so a class whose tiles fit one tile page
  comes out as a single sheet of paper: console on top, modules below.

All cut-outs of a class are one fixed size — section tiles, engine tiles and
reactor/mess tiles each have their own standard box, and a tile always prints at
its full box size so it matches the blank space it covers. The `Modular` toolbar
toggle previews the same thing live and warns if a system outgrows its box.
Sizes are the `MODULAR_*` constants in `web/src/core/render/sheetLayout.ts`.

### Fonts

The web app uses Google Fonts (`Titillium Web` + `Orbitron` as an Eurostile Extended stand-in). The shared `fonts/` folder is only consumed by the Python tool — see `TODO.md` for why and how to swap in a real Eurostile later.

## Python Version

Requirements: Python 3.x with `pillow` and `svglib` (no venv needed).

```
python python/ship_creator.py                               # generate every ship in python/ships/
python python/ship_creator.py -s python/ships/starliner.json
```

Ship JSONs live in `python/ships/`. Output `.jpg` sheets are written next to them.

## Combinator (designer tool)

Tiny tkinter UI for visualising which ships/systems are available for every
2-trait player build. Pure stdlib, no extra deps.

```
python combinator/main.py
```

See `combinator/README.md` for details.
