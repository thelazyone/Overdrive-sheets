# Overdrive shared project reference

## Purpose

Full Spectrum Overdrive spans two sibling repositories. Use this document as their shared entry point, without adding a third repository for now. Each category has one authoring authority; this does not mean the tools already share a synchronized database.

The design goal is meaningful Charter variety: players should have reasons to choose different branches, ships, and loadouts. Expansion and balance tooling should expose upgrades that become effectively compulsory across otherwise different builds. Equal numbers of unlocks are not proof of balance.

The Charter tool is visualization-first: on desktop, keep trait selection, a compact upgrade graph, and ship/system availability visible together. Offer the legacy Python-style ten-pair comparison alongside a selected-pair view. Keep explanatory copy brief and authoring controls behind an explicit editing mode; do not turn the main view back into a long editor page. Show ship sizes inline and access reasons in hover/focus labels beside entries, not a separate access-details sidebar.

Group modular options by slot family and show an option count. Shared fore/aft weapon mounts and left/right slots of the same name share availability and appear once, with a physical slot count (for example Weapon ×2). The generated `docs/SHIP-SYSTEMS.md` is the recall/reference list; rebuild it from the authoring sources with `npm run report:charter` in `web/`. Keep proposed additions in `docs/SYSTEM-IDEAS.md` until promoted. Providence currently uses Commercial Permit only as a provisional designer choice.

Availability has Capital Ships, Light Ships & Platforms, and Weapons tabs. Category definitions live in `web/src/charter/categories.json`; named shared weapon entries live in `weapons.json` in the same folder, without duplicating combat profiles. Weapon names link current modular uses to a shared requirement entry; hull requirements still apply. Weapon categories follow designer assignments in weapons.json; unspecified categories and access gates remain unknown. Front Welders stays a salvager-specific system, outside the shared weapon roster. Tugboats, corvettes, and platforms have their known families; fighters, bombers, and proposed lances are empty categories. Utility weapons includes Mining Laser, Heavy Mining Laser, Plasma Cutter, and Disassembler Field. Local category/requirement edits are drafts carried by workbench exports; accepted assignments go into the source JSON.

## Ownership and current state

| Information | Authoring authority | Consumers and limitations |
| --- | --- | --- |
| Baseline game rules | `../overdrive-sandbox/alpha_0.8_WIP.pdf` | Sandbox engine and quick reference interpret a partial ruleset. The PDF remains WIP; explicitly record later rulings rather than silently changing its meaning. |
| Current capital classes and slot options | `web/src/presets/*.json` | Card builder; sandbox imports under `../overdrive-sandbox/shared/profiles/`. Imports are snapshots, not live links. |
| Reusable system designs | `web/src/core/library/*.json` | Builder clones these into ship-local slot options. Copies do not automatically inherit later library edits; check affected presets. |
| Playable mechanics and test scenarios | `../overdrive-sandbox/shared/` | Experimental fixtures and implementation limitations are not new canonical game rules. See the sandbox README. |
| Historical card generation | `python/` | Legacy formats and designs; reconcile deliberately with web presets, do not silently merge rosters. |
| Trait-combination prototype | `combinator/combinator.py`, `combinator/data.json` | Independently edited sample data, currently five ships and two placeholder systems. Not the authoritative catalog. |
| Charter upgrade names, costs, descriptions, and graph connections | `web/src/charter/upgrades.json` | Transcribed from the user's Section C graph. The new workbench consumes it; the legacy combinator and sandbox do not. |
| Initial hull sizes, access requirements, escort roster, and exact fleet effects | `web/src/charter/content.json` | Designer-authored baseline consumed by the workbench; local/exported draft overrides are separate. Cards and sandbox do not yet consume this metadata. Unspecified requirements remain unknown. |
| Cross-tool ownership and balance-tool brief | This document | Both repository-root `AGENTS.md` files point here. |

As inspected on 2026-10-25, web presets contain Opulence Freighter, Providence Salvager, Salvation Utility Vessel, and Contemplation Escort Vessel. The combinator instead includes Vigilance and Presumption and calls Contemplation a Support vessel. These discrepancies need design reconciliation; absence from a preset does not mean a concept has been rejected.

The current schema stores complete system options inside each class. A library ID is not presently a live reference for those options. Requirements metadata is not yet present in the inspected web schemas. Do not claim automatic synchronization or full Charter validation until it is implemented.

## Rules that the next combinator must account for

Baseline references: alpha 0.8, Salvage Charters (pages 8–9), Building the Fleet (pages 10–11), and Scuffles (page 51). These were located using the sandbox's existing extracted `tmp/rules.txt`; verify exact wording against the PDF when implementing or resolving ambiguity.

- Players choose two of five traits: Trade, Military, Exploration, Science, Diplomacy. A listed trait requirement is satisfied by at least one matching trait.
- Basic Charter Benefits starts unlocked. Further Charter upgrades require payment and connection to at least one previously unlocked upgrade. Preserve the actual graph, not an invented linear tier system.
- Vessel and system access can also depend on Charter unlocks and stakeholder reputation. Trait access alone is insufficient.
- Access to a system does not imply that every hull can fit it: enforce its class/slot options as well.
- Only modular slot options participate in system unlocks and requirement editing. Fixed hull systems are always included and cannot have their own requirements (user clarification, 2026-10-25). A modular slot with only one option still counts as modular. Availability views show each named system once per hull, combining compatible slots; counts represent distinct systems, not slot occurrences.
- Designer baseline (2026-10-25): Opulence and Salvation are size 3, Providence size 2, Contemplation size 1. Size-3 hulls require Extended Tonnage by default; Opulence additionally requires Commercial Permit. Salvation requires Extraction Concession; a possible exception to its Extended Tonnage requirement remains pending, so the default currently applies. Escorting Rights unlocks Contemplation and Heavy Tugboat. Commercial Permit adds 3 to fleet cargo capacity. See `content.json` for the complete supplied light-ship/platform roster; do not infer requirements for its remaining entries.
- Fleet Capacity and Escort Capacity constrain what can be fielded. Unlock counts alone do not describe a legal fleet.
- The Scuffles text supplies 60 Credits for Battle Charter upgrades. Treat this as a versioned scenario setting, not a universal campaign budget; the stakeholder-maximization option is explicitly TBD.

## Data bridge to implement before expanding the balance analyzer

The visual prototype now exists at `web/charter.html`; see `web/src/charter/README.md`. It reads current card presets directly, offers draft requirements and fleet effects, and validates graph purchases/refunds. Its JSON exports and browser drafts are design experiments, not a second accepted source of ship rules. Catalog fingerprints prevent positional mapping drift. Full fleet fitting and sandbox synchronization remain deferred.

Keep the authored catalog in Overdrive-sheets. Add stable IDs and explicit requirements to classes, systems, light ships, platforms, and Charter upgrades, then make cards and the combinator consume those records. Keep IDs independent of display names. Record source/ruling, revision, and status (`draft`, `playtest`, or `accepted`) for new content.

Represent trait alternatives, upgrade prerequisites, reputation thresholds, upgrade prices, and graph connections separately. Preserve unknown values explicitly. Do not infer access from prose or invent prices. A ship-local variant should have an explicit identity/override rather than silently diverging from a same-named shared system.

Sandbox imports should carry their catalog revision and have a repeatable export/import path. Add a drift check for consumed fields and missing IDs. Preserve game saves under the sandbox's content-version policy; never overwrite saved fleets to refresh content. Until that pipeline exists, changes require manual reconciliation and an explicit list of unsynchronized consumers.

## Balance views to build

1. **Legal Charter explorer.** Compare all ten trait pairs at a chosen budget and reputation setting. Enumerate distinct reachable upgrade sets, not purchase-order permutations. Show path costs, remaining budget, unlocks, fitting restrictions, and reasons an item is locked. Report incomplete data rather than presenting partial enumeration as exhaustive.
2. **Branch comparison.** Compare equal-budget alternatives and what each adds to actual fleet roles: recovery, cargo, mobility, information, protection, combat, and support. Separate direct unlocks from access through later upgrades. Avoid reducing unlike abilities to a single invented power score.
3. **Dependency view.** Highlight gateways through which many later options pass. Show what disappears when an upgrade is excluded and what legal alternatives remain. Separate structural prerequisites from upgrades that are attractive for their own effects; the compulsory starting node is not a balance defect.
4. **Marginal value and opportunity cost.** Show the added options from a purchase relative to the current Charter, including its full prerequisite cost and what the same budget could buy elsewhere. Check combinations and cross-ship synergies, not only isolated systems. Flag dominance only when the stated comparable dimensions justify it; present candidates for review, not automatic balance verdicts.
5. **Playtest evidence.** Record catalog version, trait pair, budget, reputation, mission, fleet/loadout, upgrades, player/experience where available, outcome, and selection rationale. Compare upgrade use among players who could legally afford/select it, separating voluntary picks from prerequisite purchases. Show sample sizes and mission/skill confounds. High pick rate can indicate popularity or a gateway, not necessarily excess power.
6. **With/without comparisons.** For suspected compulsory upgrades, compare builds with and without them across different missions and trait pairs. Track whether alternatives remain useful and competitive. Surface concentration of successful builds without requiring all branches to perform identically in every scenario.

No universal pick-rate threshold or automatic nerf rule is established. Set review criteria after observing the first useful dataset. Static access analysis finds structural problems; the partial sandbox cannot yet establish whole-game balance.

## Expansion workflow

First reconcile the roster and author the actual Charter graph and requirements. Run a coverage matrix of trait pair × Charter branch × fleet role. Use gaps and excessive dependence to guide new content rather than adding upgrades only to already-rich branches.

For each proposed ship or system, record its intended role, fitting/access requirements, costs and resource pressure, benefit, tradeoff, alternatives, expected synergies, physical model/slot implications, and a playtest question. Keep speculative concepts separate from accepted stats and playable presets until deliberately promoted.

Initial concept directions to investigate, not approved content or established coverage gaps:

- Alternate recovery and cargo-handling systems for existing hulls, with competing crew, energy, space, or exposure costs.
- Different ways to obtain useful information or protection, avoiding a single upgrade that every effective fleet needs.
- Light-ship concepts for scouting, recovery assistance, and escort support, each with a distinct reason to take it over an existing tugboat or Flak Corvette.
- Advanced specialized options that change tactics rather than universally replacing baseline equipment.

## Change checklist for agents

1. Read this map, both relevant READMEs, and the applicable rules/data before changing shared concepts. Preserve unrelated work in either checkout.
2. Identify the canonical record and distinguish a rule change, content addition, implementation fix, or speculative design. Record unresolved conflicts instead of silently choosing a winner.
3. Edit the authoring source first. Reconcile affected preset copies, combinator inputs, sandbox snapshots/adapters, and references as applicable; report any deferred synchronization.
4. Validate at the right level: the sheets verifier/build for schema or renderer changes; combinator legality cases for access logic; sandbox tests/build for playable behavior. Pure documentation changes need link/path and consistency checks.
5. For balance changes, state the intended diversity improvement, comparison builds/scenarios, and remaining evidence needed. Do not describe an untested change as balanced.

Salvager revision (2026-10-25): Providence requires Exploration or Science plus its provisional Commercial Permit gate. Front offers Prehensile Cranes (no additional gate), Front Welders (Exploration), and Forcefield Generator (Science). Docking Bay offers the renamed Processing Bay (no additional gate) and Cargo Bay (Mass Storage; no trait gate). Effectors are fixed hull equipment. New options have placeholder profiles pending designer stats. The preset and Charter tool are updated; sandbox profile snapshots and legacy Python/combinator data remain unchanged until a deliberate playable-profile import.

Roster update (2026-10-26): Charter lists display vessel roles only, with class names retained in content.json and the generated reference roster. Freighter: Opulence, size 3; Utility Vessel: Salvation, size 3; Supply Tender: Contemplation, size 2 (formerly Escort Vessel); Gunship: Hierarchy, size 1; Salvager: class TBD, size 2 (legacy preset ID retained); Schooner: class TBD, size 1, intended for practical manipulation and analysis. Proposed Discernment/Reclamation names were not accepted. Gunship and Schooner are catalog placeholders awaiting profiles, slots, and access gates. Existing card profiles and sandbox snapshots retain historical names pending reconciliation; the Charter display uses this new roster metadata.

Slot authoring (2026-10-26): Supply Tender's previously fixed EMP Emitter is now one of three Antenna options, alongside Long Range Effector and Sensor Array. EMP and Effector reuse existing profiles; Sensor Array stats are pending. Gunship has one Weapon and one Sensors slot. Schooner has one Effectors and two side Systems slots, grouped as Systems ×2 with shared availability. These empty layouts are recorded in content.json until profiles/options are authored; no fitting options or gates were inferred. Sandbox snapshots remain unchanged.

Weapon categories (2026-10-26): Main guns now contains Asteroid Buster, Double Cannon, and Railgun. Heavy guns contains Heavy Railgun. Railgun and Heavy Railgun are named catalog entries awaiting profiles, fitting assignments, and access requirements; other weapon categories remain unchanged.

Flak identity (2026-10-26): Dual Flak Battery is a two-slot configuration of Flak Battery, with the same access requirements/effects and damage scaled for its mounts. It is no longer a separate Charter weapon entry. weapons.json retains the old display name as an alias to the shared Flak Battery identity. Existing card/library configurations and damage are preserved; fixed flak remains inherent hull equipment without requirements.

Energy roster (2026-10-26): weapons.json records three Ion, three Laser, and three EMP designs. Names/families are accepted catalog entries; proposed roles in docs/SYSTEM-IDEAS.md are not implemented rules. EMP Emitter links the existing Supply Tender Antenna option to the shared energy weapon entry. New variants have no assumed ship fits, stats, or requirements.

Weapon additions (2026-10-26): Main guns gains Rotary Cannon and Missile Array; Light guns gains Rocket Pod and Tracking Laser. These named entries await profiles, mounts, and requirements. Missile Array is distinct from the existing unassigned Missile Rack pending any explicit consolidation.

Weapon naming (2026-10-26): Double Cannon is now Twin Cannon in the shared catalog, library, and sheet presets; stable IDs and an alias retain compatibility. Double Railgun is a Main guns entry awaiting a profile, mounts, and requirements. Sandbox snapshots still use the historical Double Cannon name. Torpedoes require separate systems/attachments, not normal gun mounts; naming and details for a torpedo attachment remain to be settled.

Heavy ordnance naming (2026-10-26): Siege Cannon is accepted in Heavy guns. External Torpedo Mount is the accepted attachment name, recorded in docs/SYSTEM-IDEAS.md pending fitting and profile authoring; it is separate from normal guns. Single-cannon and larger-missile-system names remain undecided.

Missile naming (2026-10-26): Missile Battery is accepted for Heavy guns, awaiting stats, mounts, and access requirements. Main-gun Missile Array retains its current name; Missile Launcher and Ballistic Cannon remain suggestions.

Category layout (2026-10-26): Main guns is now displayed as Kinetic Weapons. Its stable main-guns ID is retained for saved drafts. The two-column weapon grid pairs Kinetic with Energy, then Light with Heavy, then Utility with Unassigned; entries remain two columns within each family.

Kinetic additions (2026-10-26): Ballistic Cannon and Scatter Gun are accepted catalog entries in Kinetic Weapons. Scatter Gun is intended to explore area hits; exact mechanics, profiles, fitting, and requirements remain unauthored.

Kinetic additions (2026-10-26): High Energy Railgun and Triple Cannon are catalog entries in Kinetic Weapons, awaiting profiles, mounts, and requirements. High Energy Railgun remains distinct from Heavy Railgun.

Laser additions (2026-10-26): Cutting Laser belongs to Energy Weapons; High Intensity Laser belongs to Heavy guns. Both are Laser-family entries awaiting profiles, mounts, and requirements.

Roster pruning (2026-10-26): Double Minigun and Missile Rack are removed from the shared weapon roster. Existing card/library profiles are retained; Opulence's Missile Rack options need fitting reconciliation. Field Gun remains an undefined name under review, with no authored function. Utility weapons should be repurposed industrial equipment rather than purpose-built weapons.

Utility revision (2026-10-26): Field Gun is removed. Plasma Cutter and tentative Disassembler Field replace it as repurposed industrial-equipment concepts. Profiles, mounts, and access requirements are not yet authored.

Gunship fitting (2026-10-26): Military or Exploration traits. Weapon options: Ballistic Cannon, Twin Cannon, Rotary Cannon, Scatter Gun. Sensors options: Fire Control Array, Effector Antenna, Shield Extension, EMP Emitter. Names/fits live in slotLayouts; profiles and system gates remain unauthored. Upgrade nodes display only the existing original-image descriptions.

Hull traits (2026-10-26): Schooner requires Science or Diplomacy; Freighter Trade, Exploration, or Diplomacy; Utility Vessel Trade or Science; Supply Tender Trade, Exploration, or Science. These are alternatives; existing upgrade gates remain in force.

Gunship trait correction (2026-10-26): Military or Diplomacy replaces Military or Exploration.

Hover clarification (2026-10-26): System hover labels and graph highlights show direct system requirements only; hull gates remain enforced for availability and are shown on the hull. Salvager Cargo Bay requires Mass Storage, replacing Commercial Permit.

Access assignments (2026-10-26): Gunship requires Escorting Rights. Ballistic Cannon has no direct prerequisites; Scatter Gun requires Exploration; Rotary Cannon requires Advanced Logistics; Twin Cannon requires Science; only the standard Mining Laser requires Extraction Concession (Heavy Mining Laser remains undefined); Plasma Cutter requires Hull Enhancement. Weapon gates are shared across modular ship mounts; hull gates remain additional.

Gunship option clarification (2026-10-26): Weapon slot also fits Mining Laser and Plasma Cutter, alongside Ballistic Cannon, Twin Cannon, Rotary Cannon, and Scatter Gun. Mining Laser requires Extraction Concession; Plasma Cutter requires Hull Enhancement. Heavy Mining Laser is not added to this slot.

Gunship Sensors (2026-10-26): Shield Extension requires Science; Effector Antenna requires Advanced Logistics; Fire Control Array requires Extended Squadrons; Resources Scanner is added with no direct prerequisites. Shared EMP Emitter is unrestricted, including its Supply Tender use. Hull access still applies to all options.

Schooner starter fittings (2026-10-26): Effectors offers Effector Array, Long Range Effectors, Heavy Duty Effectors, Industrial Effectors. Systems ×2 offers Resources Scanner, Sensor Array, Shield Extension, Forcefield Generator, Prehensile Cranes, Processing Bay, Cargo Bay. Both side slots share the same seven choices. These are a practical, non-offensive starting selection for designer refinement; fixed point defence is excluded. Known gates reference their existing Gunship/Salvager entries through requirementLinks, rather than duplicating baseline requirements. Sensor Array and new Effector variants retain unspecified requirements. Sheet/sandbox combat profiles are not generated by these catalog fittings.

Schooner refinement (2026-10-26): Systems ×2 now offers only Resources Scanner, Shield Extension, Forcefield Generator, and Sensor Array. Prehensile Cranes, Processing Bay, and Cargo Bay are removed from the Schooner only. Long Range Effectors requires Advanced Logistics; Heavy Duty Effectors requires Mass Storage; Industrial Effectors requires Field Manipulators. Effector Array requirements remain unspecified.

Forcefield Generator correction (2026-10-26): Hull Enhancement replaces Science on both Salvager and Schooner. The Schooner references the Salvager's shared requirement source.

Freighter Hab (2026-10-26): A right-side Hab slot is added to the Opulence sheet preset and Charter catalog, with Barracks (existing profile reused) and Additional Quarters (profile pending). Existing Bridge options and Side slots are preserved; Barracks still appears in Side options until relocation is explicitly requested. Hab access gates are unspecified. Sandbox imported profiles remain unchanged.

Freighter refit (2026-10-26): Bridge is Command Bridge or Navigation Bridge (renamed Observation Deck, existing profile retained pending mechanical changes). Side ×2 shares Point-Defense, Observation Deck, Missile Rack, Aux Reactor, Additional Shield. Barracks moves exclusively to Hab, alongside Additional Quarters and Passenger Berths; no Infirmary added. Sensors is Resource Scanner, Fire Control Array, Light Effectors (renamed Effectors), Support Shield Enhancer. Weapon ×2 shares Asteroid Buster, Twin Cannon, Railgun, Double Railgun, High Energy Railgun, Triple Cannon, Mining Laser, Heavy Mining Laser; no Heavy-category guns. Asteroid Buster has no direct requirements. Existing profiles retained, newly fitted designs are placeholders without invented stats. Changes are in the sheet preset and consumed by Charter; sandbox snapshots remain unchanged. Frozen pre-refit catalog data under charter/migrations is solely for saved-draft migration, not an authoring source.

Freighter bridge/side gates (2026-10-26): Tactical Command added (Military + Perimeter Protection); Navigation Bridge requires Exploration. Sides gain Hull Plating (unrestricted), Reinforced Plating (Hull Enhancement), and Tracking Laser (Military Contracting). Point-Defense is unrestricted; Observation Deck Science; Missile Rack Ordinance Service; Additional Shield Field Manipulators; Aux Reactor Fusor Technologies. Both Side slots share gates. Point-Defense and Tracking Laser use shared weapon requirements. New profiles remain placeholders; sandbox snapshots are unchanged.

Freighter requirements (2026-10-26): Heavy Mining Laser requires Trade + Mass Storage. Freighter Sensors: Light Effectors unrestricted; Resource Scanner Science; Fire Control Array Military; Support Shield Enhancer Extended Squadrons. Asteroid Buster and Twin Cannon unrestricted (Twin Cannon's former Science gate removed across shared mounts). Railgun requires Military Contracting; Double Railgun and Triple Cannon require Ordinance Service. High Energy Railgun requires Fire Control Permit; Heavy Railgun is unchanged.

Freighter Hab requirements (2026-10-26): Security Quarters added, requiring Habitat Upgrades; Additional Quarters also requires Habitat Upgrades. Crew Lounge is the free empty-system option (no actions or rules). Barracks requires Military; Passenger Berths requires Diplomacy. Preset and Charter updated; sandbox snapshot unchanged.

Availability default correction (2026-10-26): No specified requirements means unrestricted, identical to explicitly free. This supersedes earlier unknown-access behavior. Legacy defined flags no longer prevent access; actual traits, upgrades, reputation, and hull gates still apply. Command Bridge is explicitly unrestricted. Missing combat profiles remain unfinished content, not access restrictions.

Supply Tender weapons (2026-10-27): Both Weapon slots now share Ballistic Cannon, Missile Array, Scatter Gun, Mining Laser, Heavy Mining Laser, Plasma Cutter, and Ion Beam; Asteroid Buster is removed from this hull. Shared weapon gates apply. New fitting profiles are placeholders; sandbox snapshots remain unchanged. Cutting Laser is retired from the weapon registry; Plasma Cutter remains.

Weapon matrix (2026-10-27): Supersedes size-based weapon categories. All interchangeable weapons use the same physical slot; advancement does not change model dimensions or impose automatic fitting/Charter gates. Families: Projectile, Railguns, Rockets & Missiles, Ions, EMPs, Lasers, Mining, Industrial. Mining Laser / Heavy Mining Laser renamed Mining Beam / Heavy Mining Beam, preserving stable IDs and aliases. Plasma Cutter and Disassembler Field are provisionally Industrial. Base / Advanced / Cutting-edge are the proposed advancement labels; all weapon levels remain Unassigned until chosen. Edit data supports family and advancement drafts, included in exports. Point-Defense and Flak Battery are removed from the interchangeable-weapon matrix; existing ship/system profiles are retained. Existing per-slot lists remain explicit, with no automatic family-based fitting grants. Fixed weapons never gain requirements. Old category overrides migrate to canonical families; old advancement-free exports remain compatible. Sandbox snapshots retain historical names pending profile import.

Advancement naming (2026-10-27): Experimental replaces Cutting-edge as the third tier label. The internal cutting-edge ID is retained for existing draft/export compatibility; displayed tiers are Base / Advanced / Experimental.

Advancement assignments (2026-10-27): All catalog weapons now have the designer-specified Base, Advanced, or Experimental level in weapons.json. Heavy Ion Beam added to Ions at Advanced. This metadata does not alter current traits, Charter gates, ship mounts, or physical sizes. Empty Unassigned matrix row/column are hidden; future unclassified draft items remain visible if added. The generated weapon reference lists display-level names.

Gunship refit (2026-11-01): Hierarchy remains size 1 with exactly three modular system slots: Weapon, left Sensors, and right Utilities; the remaining blue hull features are fixed. Weapon retains Ballistic Cannon, Twin Cannon, Rotary Cannon, Scatter Gun, Mining Beam, and Plasma Cutter. Sensors now offers Forward Effector, Cargo Storage, and Hull. Utilities offers Hull, Cargo Storage, Shield Generator, and Torpedo System (not a normal weapon-mount option). Hull is an empty option with no actions or effects on either side. A fourth Sensors option is undecided and must not be added without designer approval. This replaces the earlier Gunship Sensors fittings; new profiles and direct access gates have not been specified, so no gates or stats are inferred. Historical requirement entries remain for saved drafts and Schooner requirement links; they do not grant removed Gunship fittings. Updated Charter catalog and generated reference only: no Gunship sheet preset or sandbox combat profile exists; legacy Python/combinator and sandbox snapshots remain unchanged.

Console catalog bridge (2026-11-01): The sheet builder now includes all six Charter hulls with current role/size labels. Existing four hulls retain their preset profiles and options; charterTemplates.ts builds Gunship and Schooner slots directly from content.json slotLayouts, avoiding duplicated fitting lists or new Charter identities. Shared Twin Cannon profile is reused for the Gunship; other new fittings remain Stats pending, except empty Hull with no actions or effects. Gunship/Schooner fixed-feature stats are pending and render explicit notes, never placeholder zeros as game values. Existing pending-profile text becomes Stats pending in the builder and on chips, without changing Charter fingerprints. No access-gate enforcement was added to the builder. Local saved ships are preserved; load a fresh template for current options. Today’s intended ships are Gunship, Freighter, Utility Vessel and Salvager, with loadouts/stats awaiting dictation. Sandbox snapshots and legacy generators remain unchanged.

Gunship hull stats (2026-11-01): Size 1; reactor capacity 4, production 2; front and rear shields maximum 5 with recharge at 3 and 5 (encoded [2,1]); quarters Crew 3, Med bay 1. Fixed Pilot Seat bridge precedes the center Weapon slot, with its action pending. Fixed Engine follows it: 0–2 at 90°, 2–4 at 0°, Change Speed costs 1 energy only. Authored console data lives in web/src/presets/hullProfiles/hierarchy_gunship.json and is combined with Charter slot options. Sandbox snapshots remain unchanged.

Gunship extra hull slots (2026-11-01): Added one Hull-only slot to each side, in addition to Sensors and Utilities. Both default to the empty Hull option, with no actions/effects. Weapon defaults to Twin Cannon for today’s loadout. Dictated replacement weapon damage/range remain pending clarification; existing Twin Cannon stats are retained until confirmed.

Gunship Twin Cannon clarification (2026-11-01): Damage 5 (instead of 4), range 1–3 unchanged. Stored as an explicit Gunship-local weapon option in hullProfiles/hierarchy_gunship.json; shared Twin Cannon and other hulls retain their existing stats, firing arc and cost unchanged. Supersedes the pending weapon clarification above.

Gunship Forward Effector (2026-11-01): Displace (S) 2 DU, front quarter only (90° forward sector, arc 3–5). Selected for today’s Sensors slot. The console supports non-weapon action arcs with F/R/A/L direction labels, without invented attack stats. Cost remains unspecified and marked pending. Gunship-local profile only; sandbox snapshots unchanged.

Gunship damage markers and generator (2026-11-01): Hull options on both sides and Twin Cannon have Hull damage; Pilot Seat has Electronics and Life Support/O2 damage. Shield Generator has Electronics damage and supplies +2 shields; its chip renders three shield hexes (off/red X, recharge, recharge), physically matching the fixed left shield track hex size. Generator selected in Utilities for today’s console. No activation cost inferred. Sandbox imports unchanged.

Gunship action refinement (2026-11-01): Forward Effector costs 2 energy; its standard unlabeled front-quarter arc follows Displace (S) 2 DU, with no redundant front-quarter prose. Pilot Seat costs 1 crew + 1 energy and displaces the ship 1 DU maintaining facing. Gunship Twin Cannon is damage 3, range 1–3, Double Shot, costing 1 crew + 1 energy; supersedes damage 5. Damage markers are retained. Sandbox imports unchanged.

Opulence and Gunship adjustment (2026-11-02): Opulence quarters Crew 4; both Side Aux Reactor options grant +1 production. Gunship front shields maximum 7, recharge at 3/5/7 (segments 3–2–2, encoded [2,1,1]); rear maximum 4, recharge at 2/4 (segments 2–2, encoded [1,1]). Existing Charter draft fingerprints migrate across the Aux Reactor description update. Sandbox snapshots and legacy generators remain unchanged.
