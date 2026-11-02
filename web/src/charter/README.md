# Charter workbench

A standalone visual entry point inside the existing sheets web project. Run `./start-charter.ps1` from the repository root and visit `http://127.0.0.1:5174/charter.html`. Alternatively use the existing Vite server and open `/charter.html`. Production builds include both `index.html` and `charter.html` and respect the configured hosting base.

## Layout

The desktop view keeps trait selection, the compact Charter graph, and fleet availability together. The availability panel switches between named system tiles for the selected pair and a Python-style overview of all ten trait pairs under the same purchased Charter. Click a pair heading to select it; hover over tiles for names and access reasons. Unavailable and undefined entries remain visible. Panels scroll independently when content exceeds the viewport; narrow mobile layouts stack.

Inspection is read-only by default. **Edit data** reveals requirement editing, fleet-effect authoring, and concept creation. Existing local drafts and imports remain compatible.

## Using it

The right pane has **Capital Ships**, **Light Ships & Platforms**, and **Weapons** tabs. Capital Ships retains selected-pair/all-ten-pairs views. Small vessels are categorized as tugboats, corvettes, fighters, bombers, proposed lances, and platforms. Weapon categories are Kinetic Weapons, Energy weapons, Light guns, Heavy guns, Utility weapons, and Unassigned. Empty categories stay visible for future content.

`weapons.json` records existing weapon identities without copying their profiles; `categories.json` defines the families. Designer-assigned categories are recorded there; Double Minigun and Missile Rack have been retired from the shared weapon roster; historical library and preset profiles remain pending fitting reconciliation. Mining Laser, Heavy Mining Laser, Plasma Cutter, Disassembler Field, and Ion Beam are named entries awaiting profiles and fitting assignments. Front Welders remains a salvager-specific modular system, outside this shared weapon roster. The Weapons tab shows current modular hull uses; library weapons without modular mounts remain listed as designs, not as fixed-system unlocks. In **Edit data**, assign a category and trait/upgrade requirements or add a weapon concept. Shared weapon requirements apply to every matching named modular system across hulls; each hull's access gate still applies. Category drafts are local/exported, while accepted assignments belong in source JSON. Older saves without category overrides remain compatible.

1. Choose two traits and a budget (60 Credits by default, from the Scuffles rule).
2. Select a graph node to inspect its parents, price, minimum remaining path cost, and mapped content. Purchase/refund from the inspector. A refund removes only descendants that no longer have a purchased path from Basic Charter Benefits.
3. Inspect every current hull and its actual preset slot options beside the graph. Hover a hull or system for access details; enable **Edit data** to author draft trait and Charter requirements. Conditions on an item and its hull both apply. Listed traits are alternatives; listed item upgrade requirements are all required. The graph's parent requirements, separately, are any-of.
4. No listed requirements means unrestricted, including entries whose requirements have not yet been authored. Reputation notes force a manual-check status rather than claiming availability.
5. In **Edit data** mode, add light ships, platforms, hulls, or system concepts as draft names and access requirements. This does not create printable profiles or validate physical fitting.
6. Enter exact fleet effects under an upgrade, one per line. Purchased effects appear in the fleet summary. These notes do not simulate capacity or deployment changes.
7. Export/import a JSON workbench to share or back up the selection, requirements, effects, and concepts. Import replaces the current workbench only after validation. Browser storage also autosaves locally. Export before importing if you want to keep both designs.

## Sources and limits

- `content.json` owns the initial designer-confirmed sizes, hull gates, nine light ships/platforms, and the +3 fleet cargo benefit. Size-3 hulls inherit Extended Tonnage unless explicitly exempted; Salvation's possible exemption is pending and is displayed as a note. The other unspecified vessel and modular-system requirements default to unrestricted. Draft overrides can be explored without changing the baseline file.
- Hover or keyboard-focus a hull/system to see a compact access label beside the entry. Normal browsing opens no access-details drawer. Missing direct Charter requirements are red and satisfied requirements green, including inherited hull gates. Size labels appear on the hull cards and comparison rows. Highlights are not automatic purchases.

- `upgrades.json` is the authored graph, transcribed from the supplied Section C image: 16 nodes, 21 links. The label **Ordinance Service** preserves the image's spelling. It has no outgoing C.4 link in that image. Military Contracting connects to Fusor Technologies, Perimeter Protection, and Fire Control Permit.
- `catalog.ts` reads `../presets/*.json` directly using the card builder's existing parser. It lists all slot alternatives, not only selected defaults. Fixed features (reactor, shields, quarters) remain outside the system list, consistent with the current builder schema.
- Only `kind: "slot"` system options appear in availability, counts, and requirement editing, including single-option slots. Fixed systems are inherent equipment and cannot have prerequisites. Older workbenches with the exact previous catalog fingerprint migrate automatically: purchases and modular mappings survive, and obsolete fixed-system mappings are removed. Other catalog mismatches remain blocked.
- No existing ship's traits or Charter gates have been guessed from its name or the old combinator sample. Confirmed initial gates now come from `content.json`; all other requirements default to unrestricted. The legacy combinator's roster is not imported.
- System identifiers currently use preset/side/slot/option position. An exact catalog fingerprint travels with saved drafts and imports, blocking reuse against changed content instead of silently misassigning requirements. Reconcile old drafts explicitly after preset edits. This is transitional until persistent system IDs exist in the shared authoring schema.
- Requirements and effects are workbench drafts, stored locally/exported. They do not write to preset source files, change ship cards, or affect the sandbox. Promote agreed mappings into a canonical file/schema in a later integration step; do not maintain a separate accepted catalog in this UI.
- Availability concerns access, not a complete legal fleet. There is no fleet capacity, loadout selection, deployment simulation, reputation arithmetic, or balance score. The graph's cheapest-path calculation includes prerequisite costs and shared paths, but does not claim affordable access when its cost exceeds the remaining budget.
- Changing traits preserves purchases because Charter nodes themselves have no trait restrictions in the supplied graph. Purchasing pauses while fewer than two traits are selected.
- Imported graph revisions, content fingerprints, IDs, budget, and purchase connectivity are validated. A local draft that cannot be loaded is preserved, and autosave is disabled for that session; export new work rather than overwriting the old draft.

## Checks

From `web/`: `npm run test:charter`, `npx tsx scripts/verify-ships.ts`, and `npm run build`. Browser verification covers selection, purchasing, hull/system requirement editing, live unlock updates, and reload persistence.

Repeated system names on the same hull are shown once, with compatible slots combined in the tooltip/details. Availability is satisfied by any eligible occurrence. Editing a grouped requirement applies it to all matching slots; underlying preset IDs and saved-workbench fingerprints remain unchanged.

Options are grouped by slot family. Fore/aft weapon mounts and same-named left/right slots appear once with a ×2 badge and a distinct option count. Requirements remain shared per system and hull. The generated reference is `docs/SHIP-SYSTEMS.md` (run `npm run report:charter`); proposed additions are in `docs/SYSTEM-IDEAS.md`. Providence uses a provisional Commercial Permit requirement.

## Weapon matrix

The Weapons tab now shows family rows against Base, Advanced, Experimental, and Unassigned columns. All interchangeable weapons share one physical mount; advancement is descriptive metadata and does not automatically set stats, costs, Charter gates, or permitted ship fits. Levels are initially unassigned. Edit data lets you set a weapon's family and advancement; exported drafts retain both.

Mining Beam and Heavy Mining Beam replace the Mining Laser names. Their IDs and old-name aliases preserve requirements. Point-Defense and Flak Battery are outside the weapon matrix; current ship profiles remain intact. Explicit per-slot fitting options are still authoritative. Older size/category labels elsewhere in this README describe the previous interface and are superseded here.
