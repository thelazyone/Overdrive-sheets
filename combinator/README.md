# Combinator

For the new graph-based Charter workbench, see [the workbench guide](../web/src/charter/README.md). This folder is the older trait-only prototype.

Tiny developer/designer tool to visualise which ships and systems are
available for every two-trait player build.

## Run

Requirements: Python 3.10+ (uses stdlib only — `tkinter` ships with Python).

```
python combinator/combinator.py
```

## How it works

- Five traits: **Trade**, **Military**, **Exploration**, **Science**, **Diplomacy**.
- Each player picks 2 of the 5 → 10 distinct combinations.
- Each ship / system has zero or more required traits. An item is available
  if it has no requirements *or* at least one of its required traits is in
  the player's chosen two (OR logic).

## UI

- **Left** — tree of ships → systems with `New Ship`, `New System`,
  `Delete` buttons.
- **Middle** — editor for the selected node: name + 5 trait checkboxes.
  Auto-saves on every change.
- **Right** — 2×5 grid of the 10 trait combinations. Each cell shows the
  ships available to that build as colored rectangles, with the available
  systems for each ship as smaller blocks underneath. Counts in the header
  give a quick "quantity of stuff" read.

Data lives in `combinator/data.json`.

This is sample data maintained independently of the card presets. The current tool checks traits only, not Charter upgrades, reputation, or complete fleet legality. See [the shared project reference](../OVERDRIVE.md) for authoritative sources and the planned Charter balance analysis.
