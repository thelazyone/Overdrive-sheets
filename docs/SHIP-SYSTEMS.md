# Ship systems and requirements

Generated from the current presets and `web/src/charter/content.json`. Regenerate with `npm run report:charter` from `web/`; edit the authoring sources rather than this report. Browser-only draft overrides are not included.

Only modular slots are listed. Shared fore/aft and left/right slot families appear once, with their physical slot count. System gates are not yet assigned unless explicitly shown.

## Capital roster

| Vessel | Size | Class name | Requirements |
| --- | ---: | --- | --- |
| Freighter | 3 | Opulence | Trade or Exploration or Diplomacy + Commercial Permit + Extended Tonnage |
| Utility Vessel | 3 | Salvation | Trade or Science + Extraction Concession + Extended Tonnage |
| Salvager | 2 | TBD | Exploration or Science + Commercial Permit |
| Supply Tender | 2 | Contemplation | Trade or Exploration or Science + Escorting Rights |
| Gunship | 1 | Hierarchy | Military or Diplomacy + Escorting Rights |
| Schooner | 1 | TBD | Science or Diplomacy |

## Contemplation Class Escort Vessel — Size 2

Hull requirements: **Trade or Exploration or Science + Escorting Rights**.

| Slot family | Slots | Options | Systems | Additional system requirements |
| --- | ---: | ---: | --- | --- |
| Weapon | 2 | 7 | Ballistic Cannon; Missile Array; Scatter Gun; Mining Beam; Heavy Mining Beam; Plasma Cutter; Ion Beam | Ballistic Cannon: Always available; Missile Array: Always available; Scatter Gun: Exploration; Mining Beam: Extraction Concession; Heavy Mining Beam: Trade + Mass Storage; Plasma Cutter: Hull Enhancement; Ion Beam: Always available |
| Antenna | 1 | 3 | EMP Emitter; Long Range Effector; Sensor Array | EMP Emitter: Always available; Long Range Effector: Always available; Sensor Array: Always available |
| Engine | 1 | 1 | Engine | Engine: Always available |

One-option families: Engine.

## Opulence Class Freighter — Size 3

Hull requirements: **Trade or Exploration or Diplomacy + Commercial Permit + Extended Tonnage**.

| Slot family | Slots | Options | Systems | Additional system requirements |
| --- | ---: | ---: | --- | --- |
| Bridge | 1 | 3 | Command Bridge; Navigation Bridge; Tactical Command | Command Bridge: Always available; Navigation Bridge: Exploration; Tactical Command: Military + Perimeter Protection |
| Side | 2 | 8 | Point-Defense; Observation Deck; Missile Rack; Aux Reactor; Additional Shield; Hull Plating; Reinforced Plating; Tracking Laser | Point-Defense: Always available; Observation Deck: Science; Missile Rack: Ordinance Service; Aux Reactor: Fusor Technologies; Additional Shield: Field Manipulators; Hull Plating: Always available; Reinforced Plating: Hull Enhancement; Tracking Laser: Military Contracting |
| Sensors | 1 | 4 | Resource Scanner; Fire Control Array; Light Effectors; Support Shield Enhancer | Resource Scanner: Science; Fire Control Array: Military; Light Effectors: Always available; Support Shield Enhancer: Extended Squadrons |
| Weapon | 2 | 8 | Asteroid Buster; Twin Cannon; Railgun; Double Railgun; High Energy Railgun; Triple Cannon; Mining Beam; Heavy Mining Beam | Asteroid Buster: Always available; Twin Cannon: Always available; Railgun: Military Contracting; Double Railgun: Ordinance Service; High Energy Railgun: Fire Control Permit; Triple Cannon: Ordinance Service; Mining Beam: Extraction Concession; Heavy Mining Beam: Trade + Mass Storage |
| Hab | 1 | 5 | Barracks; Additional Quarters; Passenger Berths; Security Quarters; Crew Lounge | Barracks: Military; Additional Quarters: Habitat Upgrades; Passenger Berths: Diplomacy; Security Quarters: Habitat Upgrades; Crew Lounge: Always available |

One-option families: none.

## Providence Class Salvager — Size 2

Hull requirements: **Exploration or Science + Commercial Permit**.

Commercial Permit remains the provisional upgrade gate; Exploration or Science is required.

| Slot family | Slots | Options | Systems | Additional system requirements |
| --- | ---: | ---: | --- | --- |
| Front | 1 | 3 | Front Welders; Prehensile Cranes; Forcefield Generator | Front Welders: Exploration; Prehensile Cranes: Always available; Forcefield Generator: Hull Enhancement |
| Docking Bay | 1 | 2 | Processing Bay; Cargo Bay | Processing Bay: Always available; Cargo Bay: Mass Storage |

One-option families: none.

## Salvation Class Utility Vessel — Size 3

Hull requirements: **Trade or Science + Extraction Concession + Extended Tonnage**.

Extended Tonnage applies by the size-3 default. A possible exemption for Salvation is pending a designer ruling.

| Slot family | Slots | Options | Systems | Additional system requirements |
| --- | ---: | ---: | --- | --- |
| Loading Bay | 1 | 1 | Docking Bay | Docking Bay: Always available |
| Hangar | 1 | 1 | Skiffs Hangar | Skiffs Hangar: Always available |
| Main cannon | 1 | 2 | Asteroid Buster; Twin Cannon | Asteroid Buster: Always available; Twin Cannon: Always available |
| Cargo Storage | 1 | 1 | Cargo Storage | Cargo Storage: Always available |

One-option families: Loading Bay, Hangar, Cargo Storage.

## Hulls awaiting profiles

| Vessel | Slot family | Slots | Options | Additional system requirements |
| --- | --- | ---: | --- | --- |
| Gunship | Weapon | 1 | Ballistic Cannon; Twin Cannon; Rotary Cannon; Scatter Gun; Mining Beam; Plasma Cutter | Ballistic Cannon: Always available; Twin Cannon: Always available; Rotary Cannon: Advanced Logistics; Scatter Gun: Exploration; Mining Beam: Extraction Concession; Plasma Cutter: Hull Enhancement |
| Gunship | Sensors | 1 | Forward Effector; Cargo Storage; Hull | Forward Effector: Always available; Cargo Storage: Always available; Hull: Always available |
| Gunship | Utilities | 1 | Hull; Cargo Storage; Shield Generator; Torpedo System | Hull: Always available; Cargo Storage: Always available; Shield Generator: Always available; Torpedo System: Always available |
| Gunship | Hull | 2 | Hull | Hull: Always available |
| Schooner | Effectors | 1 | Effector Array; Long Range Effectors; Heavy Duty Effectors; Industrial Effectors | Effector Array: Always available; Long Range Effectors: Advanced Logistics; Heavy Duty Effectors: Mass Storage; Industrial Effectors: Field Manipulators |
| Schooner | Systems | 2 | Resources Scanner; Shield Extension; Forcefield Generator; Sensor Array | Resources Scanner: Always available; Shield Extension: Science; Forcefield Generator: Hull Enhancement; Sensor Array: Always available |

## Light ships and platforms

| Vessel | Category | Required upgrades |
| --- | --- | --- |
| Service Tugboat | tugboats | Always available |
| Light Tugboat | tugboats | Always available |
| Heavy Tugboat | tugboats | Escorting Rights |
| Railgun Corvette | corvettes | Military Contracting |
| Flak Corvette | corvettes | Extended Squadrons |
| Gun Corvette | corvettes | Military + Extended Squadrons |
| Sensor Platform | platforms | Always available |
| Weapon Platform | platforms | Hull Enhancement + Military Contracting |
| Shields Platform | platforms | Hull Enhancement |

## Shared weapons

| Weapon | Family | Advancement | Requirements |
| --- | --- | --- | --- |
| Asteroid Buster | Projectile | Advanced | Always available |
| Twin Cannon | Projectile | Advanced | Always available |
| Railgun | Railguns | Advanced | Military Contracting |
| Heavy Railgun | Railguns | Experimental | Always available |
| Mining Beam | Mining | Base | Extraction Concession |
| Heavy Mining Beam | Mining | Advanced | Trade + Mass Storage |
| Ion Beam | Ions | Base | Always available |
| Phased Ion Beam | Ions | Experimental | Always available |
| Collimated Ion Beam | Ions | Experimental | Always available |
| Laser Cannon | Lasers | Base | Always available |
| Pulse Laser Cannon | Lasers | Advanced | Always available |
| Adaptive Laser Cannon | Lasers | Experimental | Always available |
| EMP Emitter | EMPs | Advanced | Always available |
| Focused EMP Emitter | EMPs | Experimental | Always available |
| Wideband EMP Emitter | EMPs | Experimental | Always available |
| Rotary Cannon | Projectile | Advanced | Advanced Logistics |
| Missile Array | Rockets & Missiles | Advanced | Always available |
| Rocket Pod | Rockets & Missiles | Base | Always available |
| Tracking Laser | Lasers | Base | Military Contracting |
| Double Railgun | Railguns | Advanced | Ordinance Service |
| Siege Cannon | Projectile | Experimental | Always available |
| Missile Battery | Rockets & Missiles | Experimental | Always available |
| Ballistic Cannon | Projectile | Base | Always available |
| Scatter Gun | Projectile | Advanced | Exploration |
| High Energy Railgun | Railguns | Experimental | Fire Control Permit |
| Triple Cannon | Projectile | Experimental | Ordinance Service |
| High Intensity Laser | Lasers | Experimental | Always available |
| Plasma Cutter | Industrial | Advanced | Hull Enhancement |
| Disassembler Field | Industrial | Experimental | Always available |
| Heavy Ion Beam | Ions | Advanced | Always available |

## Fleet effects

- Commercial Permit: Fleet cargo capacity +3.

## Next design work

See [SYSTEM-IDEAS.md](SYSTEM-IDEAS.md) for proposed additions. These are separate from accepted profiles and requirements.
