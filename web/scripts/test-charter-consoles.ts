import assert from 'node:assert/strict';
import { PRESETS } from '../src/presets';
import content from '../src/charter/content.json';
import { parseShipDocument, exportShipDocument, parseShipsFromImport } from '../src/core/schema';


for (const entry of PRESETS) {
  const ship = parseShipDocument(entry.data);
  assert.ok(ship.description.includes('Size'));
  const imported = parseShipsFromImport(exportShipDocument(ship), PRESETS.map(p=>({id:p.id,raw:p.data})));
  assert.equal(imported.length,1);
}
for (const [id, layouts] of Object.entries(content.slotLayouts)) {
  const entry = PRESETS.find(p=>p.id===id.replace('hull:',''))!;
  const ship = parseShipDocument(entry.data);
  const refs = Object.values(ship.sections).flat().filter(r=>r.kind==='slot');
  assert.equal(refs.length, layouts.reduce((sum,s)=>sum+s.locations.length,0));
  for (const layout of layouts) {
    const slots = refs.filter(r=>r.kind==='slot'&&r.label===layout.name);
    assert.equal(slots.length,layout.locations.length);
    for (const ref of slots) if(ref.kind==='slot') assert.deepEqual(ref.options.map(o=>o.name),layout.options);
  }
  if(id!=='hull:hierarchy_gunship') assert.match(ship.reactor.rules,/Stats pending/);
}
const gunship = parseShipDocument(PRESETS.find(p=>p.id==='hierarchy_gunship')!.data);
assert.equal(gunship.sections.left[0].kind==='slot'&&gunship.sections.left[0].label,'Sensors');
assert.equal(gunship.sections.right[0].kind==='slot'&&gunship.sections.right[0].label,'Utilities');
for(const ref of Object.values(gunship.sections).flat()) if(ref.kind==='slot') {
  for(const option of ref.options) if(option.name==='Hull') {
    assert.equal(option.rules,''); assert.deepEqual(option.areas,[]);
  }
}
console.log('All six console templates parse; Charter fitting parity, sides, empty Hull options and export/import pass.');

assert.equal(gunship.reactor.circles,4);
assert.equal(gunship.reactor.rules,'Energy Production: 2');
assert.deepEqual(gunship.shields.front,[2,1,1]);
assert.deepEqual(gunship.shields.rear,[1,1]);
assert.equal(gunship.quarters.rules,'Crew: 3');
assert.equal(gunship.quarters.med_bay,1);
const engine = gunship.sections.core.at(-1)!;
assert.ok(engine.kind==='system'&&engine.system.kind==='engine');
if(engine.kind==='system'&&engine.system.kind==='engine') {
  assert.deepEqual(engine.system.speed_slots,[{speed:'0-2',rotation:'90°'},{speed:'2-4',rotation:'0°'}]);
  assert.deepEqual(engine.system.areas[0].cost,{energy:1});
}

for (const side of ['left','right'] as const) {
  const hull = gunship.sections[side][1];
  assert.ok(hull.kind==='slot');
  if(hull.kind==='slot') { assert.equal(hull.label,'Hull'); assert.equal(hull.selectedIndex,0); assert.equal(hull.options.length,1); }
}
const weaponSlot = gunship.sections.core.find(r=>r.kind==='slot'&&r.label==='Weapon');
assert.ok(weaponSlot?.kind==='slot');
if(weaponSlot?.kind==='slot') {
  const twin=weaponSlot.options[weaponSlot.selectedIndex!];
  assert.equal(twin.name,'Twin Cannon');
  assert.equal(twin.areas[0].shoot?.damage,3);
  assert.equal(twin.areas[0].shoot?.range,'1-3');
}
const sensors = gunship.sections.left[0];
assert.ok(sensors.kind==='slot');
if(sensors.kind==='slot') {
  const effector=sensors.options[sensors.selectedIndex!];
  assert.equal(effector.name,'Forward Effector');
  assert.equal(effector.areas[0].description,'Displace (S) 2 DU');
  assert.deepEqual(effector.areas[0].arc,{start:3,end:5});
  assert.equal(effector.areas[0].shoot,undefined);
  const roundtrip=parseShipDocument(exportShipDocument(gunship));
  const restored=roundtrip.sections.left[0];
  assert.ok(restored.kind==='system');
  if(restored.kind==='system') assert.deepEqual(restored.system.areas[0].arc,effector.areas[0].arc);
}
const bridge = gunship.sections.core[0];
assert.ok(bridge.kind==='system'&&bridge.system.electronics&&bridge.system.life_support);
for(const side of ['left','right'] as const) {
  const hull=gunship.sections[side][1];
  assert.ok(hull.kind==='slot'&&hull.options[0].hull);
}
const utilities=gunship.sections.right[0];
assert.ok(utilities.kind==='slot');
if(utilities.kind==='slot') {
  const generator=utilities.options[utilities.selectedIndex!];
  assert.equal(generator.name,'Shield Generator');
  assert.equal(generator.electronics,true);
  assert.deepEqual(generator.shieldTrack,['off','recharge','recharge']);
  const exported=parseShipDocument(exportShipDocument(gunship)).sections.right[0];
  assert.ok(exported.kind==='system');
  if(exported.kind==='system') assert.deepEqual(exported.system.shieldTrack,generator.shieldTrack);
}

if(weaponSlot?.kind==='slot') {
 const twin=weaponSlot.options[weaponSlot.selectedIndex!];
 assert.equal(twin.areas[0].description,'Double Shot');
 assert.deepEqual(twin.areas[0].cost,{energy:1,crew:1});
}
if(sensors.kind==='slot') {
 const effector=sensors.options[sensors.selectedIndex!];
 assert.equal(effector.rules,'');
 assert.deepEqual(effector.areas[0].cost,{energy:2});
}
if(bridge.kind==='system') {
 assert.equal(bridge.system.rules,'');
 assert.equal(bridge.system.areas[0].description,'Displace the ship by 1 DU maintaining facing.');
 assert.deepEqual(bridge.system.areas[0].cost,{energy:1,crew:1});
}

const opulence=parseShipDocument(PRESETS.find(p=>p.id==='opulence_freighter')!.data);
assert.equal(opulence.quarters.rules,'Crew: 4');
for(const side of ['left','right'] as const) {
 const aux=opulence.sections[side].flatMap(r=>r.kind==='slot'?r.options:[]).find(o=>o.name==='Aux Reactor');
 assert.equal(aux?.rules,'+1 production');
}
