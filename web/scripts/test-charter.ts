import assert from 'node:assert/strict';
import { advancementFor, authoredSystems, authoredWeapons, categoryFor, sharedWeapon, slotGroups, authoredVessels, hullMetadata, requirementFor, benefitsFor, requiredUpgrades, access, systemAccess, uniqueSystems, byId, cheapestPath, connected, fresh, parseWorkbench, purchaseReason, spent, upgrades, type Item } from '../src/charter/model';

assert.equal(upgrades.length,16);
assert.equal(upgrades.reduce((n,u)=>n+u.parents.length,0),21);
for (const u of upgrades) {
  assert.equal(u.cost,u.tier*5);
  for (const parent of u.parents) assert.equal(byId[parent].tier,u.tier-1);
}
assert.deepEqual(byId.contracting.parents,['habitat','hull','squadrons']);
assert.deepEqual(byId.fire.parents,['contracting']);
assert.deepEqual(byId.ordnance.parents,['squadrons']);
const state = {...fresh(),traits:['Trade','Science'] as ('Trade'|'Science')[]};
assert.equal(purchaseReason('commercial',state),'');
assert.match(purchaseReason('commercial',fresh()),/two traits/);
assert.match(purchaseReason('extraction',state),/Commercial Permit/);
assert.equal(purchaseReason('commercial',{...state,budget:0}),'Needs 5 more credits');
assert.equal(cheapestPath(['fire'],state)?.cost,50);
assert.equal(cheapestPath(['fusor','perimeter'],state)?.cost,70);
const purchased=['basic','tonnage','escorting','hull','contracting','fire'];
assert.deepEqual(connected(purchased.filter(id=>id!=='tonnage')),['basic','escorting','hull','contracting','fire']);
assert.deepEqual(connected(purchased.filter(id=>id!=='hull')),['basic','tonnage','escorting']);
assert.equal(spent(['basic','commercial','extraction']),15);
const item: Item={id:'system',name:'Test system',kind:'system',shipId:'ship',description:''};
const unrestricted={defined:true,traits:[],upgrades:[],reputation:''};
assert.equal(access(item,state).status,'available');
const authored={...state,requirements:{ship:unrestricted,system:unrestricted}};
assert.equal(access(item,authored).status,'available');
assert.equal(access(item,{...authored,requirements:{...authored.requirements,system:{...unrestricted,traits:['Military']}}}).status,'excluded');
assert.equal(access(item,{...authored,requirements:{...authored.requirements,ship:{...unrestricted,upgrades:['commercial']}}}).status,'later');
assert.equal(access(item,{...authored,requirements:{...authored.requirements,system:{...unrestricted,reputation:'Stakeholder level 2'}}}).status,'reputation');
assert.equal(access(item,{...authored,traits:[]}).status,'choose');
assert.equal(cheapestPath(['commercial'],{...state,purchased:['basic','commercial']})?.cost,0);
assert.throws(()=>parseWorkbench({...state,purchased:['basic','fire']}),/disconnected/);
assert.throws(()=>parseWorkbench({...state,purchased:['basic','commercial'],budget:0}),/budget/);
assert.throws(()=>parseWorkbench({...state,purchased:['basic','commercial','commercial']}),/duplicate/);
assert.throws(()=>parseWorkbench({...state,requirements:{system:{...unrestricted,upgrades:['fake']}}}));
assert.deepEqual(parseWorkbench(JSON.parse(JSON.stringify(authored))),authored);
const opulence: Item={id:'preset:opulence_freighter',name:'Opulence',kind:'ship',description:''};
assert.deepEqual(requiredUpgrades(opulence,state),['commercial','tonnage']);
assert.equal(access(opulence,state).status,'later');
assert.equal(access(opulence,{...state,purchased:['basic','commercial','tonnage']}).status,'available');
assert.equal(requirementFor({...state,requirements:{[opulence.id]:{...unrestricted,defined:false}}},opulence.id).defined,true);
assert.equal(hullMetadata['preset:contemplation_escort_vessel'].size,2);
assert.equal(hullMetadata['preset:providence_salvager'].size,2);
assert.deepEqual(requirementFor(state,'preset:salvation_utility_vessel').upgrades,['extraction','tonnage']);
assert.equal(authoredVessels.filter(v=>v.kind!=='ship').length,9);
assert.equal(access(authoredVessels.find(i=>i.id==='light:heavy_tugboat')!,state).status,'later');
for (const id of ['light:service_tugboat','light:light_tugboat']) {
  assert.equal(access(authoredVessels.find(i=>i.id===id)!,state).status,'available');
}
assert.equal(access(authoredVessels.find(i=>i.id==='platform:sensor')!,state).status,'available');
for (const [id,gates] of Object.entries({
  'light:railgun_corvette':['contracting'],
  'light:flak_corvette':['squadrons'],
  'light:gun_corvette':['squadrons'],
  'platform:shields':['hull'],
  'platform:weapon':['hull','contracting'],
})) {
  const vessel=authoredVessels.find(i=>i.id===id)!;
  assert.deepEqual(requiredUpgrades(vessel,state),gates);
  assert.equal(access(vessel,{...state,traits:['Trade','Military'],purchased:['basic',...gates]}).status,'available');
  for (const gate of gates) assert.equal(access(vessel,{...state,traits:['Trade','Military'],purchased:['basic',...gates.filter(g=>g!==gate)]}).status,'later');
}
assert.equal(access(authoredVessels.find(i=>i.id==='light:gun_corvette')!,{...state,traits:['Trade','Science'],purchased:['basic','squadrons']}).status,'excluded');
assert.deepEqual(benefitsFor(state,'commercial'),['Fleet cargo capacity +3']);
assert.deepEqual(requiredUpgrades({...item,shipId:opulence.id},state),['commercial','tonnage']);
const repeated = [{...item,slot:'left'}, {...item,id:'other-slot',slot:'right'}];
const grouped = uniqueSystems(repeated);
assert.equal(grouped.length,1);
assert.equal(grouped[0].slot,'left / right');
assert.equal(uniqueSystems([...repeated,{...item,id:'other-hull',shipId:'another-ship'}]).length,2);
const mixedSlots = {...authored,requirements:{...authored.requirements,system:{...unrestricted,traits:['Military'] as ['Military']},'other-slot':unrestricted}};
assert.equal(systemAccess(grouped[0],repeated,mixedSlots).status,'available');
assert.equal(systemAccess(grouped[0],repeated,{...mixedSlots,requirements:{ship:unrestricted,system:mixedSlots.requirements.system}}).status,'available');
console.log('Charter graph, legal purchases, alternative paths, refunds, inherited access, and import validation passed.');

const sharedSlots = slotGroups([
  {...item,id:'preset:ship/core/0/0',name:'Asteroid Buster',slot:'core · Fore weapon'},
  {...item,id:'preset:ship/core/0/1',name:'Double Cannon',slot:'core · Fore weapon'},
  {...item,id:'preset:ship/core/1/0',name:'Asteroid Buster',slot:'core · Aft weapon'},
  {...item,id:'preset:ship/core/1/1',name:'Double Cannon',slot:'core · Aft weapon'},
  {...item,id:'preset:ship/left/0/0',name:'Point-Defense',slot:'left · Side'},
  {...item,id:'preset:ship/right/0/0',name:'Point-Defense',slot:'right · Side'},
], 'ship');
assert.deepEqual(sharedSlots.map(g=>[g.name,g.count,g.options.length]),[['Weapon',2,2],['Side',2,1]]);
assert.deepEqual(requirementFor(state,'preset:providence_salvager').upgrades,['commercial']);

const buster = authoredWeapons.find(w=>w.id==='weapon:asteroid_buster')!;
assert.equal(categoryFor(buster,state),'projectiles');
assert.equal(categoryFor(authoredVessels.find(i=>i.id==='light:heavy_tugboat')!,state),'tugboats');
const mountedBuster={...item,name:'Asteroid Buster',shipId:opulence.id};
assert.equal(sharedWeapon(mountedBuster)?.id,buster.id);
const weaponState={...state,purchased:['basic','commercial','tonnage'],requirements:{[buster.id]:{...unrestricted,traits:['Military'] as ['Military'],upgrades:['hull']}}};
assert.equal(access(mountedBuster,weaponState).status,'excluded');
const militaryWeaponState={...weaponState,traits:['Trade','Military'] as ['Trade','Military']};
assert.equal(access(mountedBuster,militaryWeaponState).status,'later');
assert.equal(access(mountedBuster,{...militaryWeaponState,purchased:[...militaryWeaponState.purchased,'hull']}).status,'available');
assert.deepEqual(requiredUpgrades(mountedBuster,militaryWeaponState),['hull','commercial','tonnage']);
assert.deepEqual(parseWorkbench({...state,categories:undefined}).categories,{});

// Salvager alternatives retain the hull gate as well as their own trait gate.
const salvager = {id:'preset:providence_salvager',name:'Providence',kind:'ship' as const,description:''};
const salvageState = {...fresh(),traits:['Exploration','Trade'] as ['Exploration','Trade'],purchased:['basic','commercial']};
const salvageOption=(suffix:string):Item=>({id:`${salvager.id}/${suffix}`,shipId:salvager.id,name:suffix,kind:'system',description:''});
assert.deepEqual(requirementFor(salvageState,salvager.id).traits,['Exploration','Science']);
assert.equal(access(salvager,salvageState).status,'available');
assert.equal(access(salvager,{...salvageState,traits:['Trade','Military']}).status,'excluded');
assert.equal(access(salvageOption('core/1/1'),salvageState).status,'available');
assert.equal(access(salvageOption('core/1/0'),salvageState).status,'available');
assert.equal(access(salvageOption('core/1/2'),salvageState).status,'later');
assert.equal(access(salvageOption('core/1/2'),{...salvageState,traits:['Science','Trade'],purchased:['basic','commercial','hull']}).status,'available');
assert.equal(access(salvageOption('core/2/1'),salvageState).status,'later');
assert.equal(access(salvageOption('core/2/1'),{...salvageState,traits:['Science','Exploration'],purchased:['basic','commercial','storage']}).status,'available');
assert.equal(access(salvageOption('core/2/0'),salvageState).status,'available');
assert.equal(access(salvageOption('core/2/0'),{...salvageState,purchased:['basic']}).status,'later');
assert.deepEqual(requirementFor(salvageState,'preset:providence_salvager/core/2/1').upgrades,['storage']);

assert.deepEqual(slotGroups([], 'hull:hierarchy_gunship').map(g=>[g.name,g.count,g.options.length]),[['Weapon',1,0],['Sensors',1,0],['Utilities',1,0],['Hull',2,0]]);
assert.deepEqual(slotGroups([], 'hull:schooner').map(g=>[g.name,g.count,g.options.length]),[['Effectors',1,0],['Systems',2,0]]);

assert.equal(authoredWeapons.some(w=>w.id==='weapon:dual_flak_battery'),false);
assert.equal(sharedWeapon({...item,name:'Dual Flak Battery'}),undefined);
assert.equal(sharedWeapon({...item,name:'Flak Battery'}),undefined);

assert.deepEqual(slotGroups(authoredSystems,'hull:hierarchy_gunship').map(g=>[g.name,g.count,g.options.length]),[['Weapon',1,6],['Sensors',1,3],['Utilities',1,4],['Hull',2,1]]);
assert.deepEqual(requirementFor(fresh(),'hull:hierarchy_gunship').traits,['Military','Diplomacy']);
assert.equal(sharedWeapon({...item,name:'EMP Emitter'})?.id,'weapon:emp_emitter');

const gunshipMining = authoredSystems.find(i=>i.shipId==='hull:hierarchy_gunship'&&i.name==='Mining Beam')!;
const gunshipPlasma = authoredSystems.find(i=>i.shipId==='hull:hierarchy_gunship'&&i.name==='Plasma Cutter')!;
assert.deepEqual(requiredUpgrades(gunshipMining,fresh()),['extraction','escorting']);
assert.deepEqual(requiredUpgrades(gunshipPlasma,fresh()),['hull','escorting']);
assert.deepEqual(requirementFor(fresh(),'weapon:heavy_mining_laser').traits,['Trade']);
assert.deepEqual(requirementFor(fresh(),'weapon:heavy_mining_laser').upgrades,['storage']);

assert.deepEqual(requirementFor(fresh(),'hull:hierarchy_gunship/sensors/shield_extension').traits,['Science']);
assert.deepEqual(requirementFor(fresh(),'hull:hierarchy_gunship/sensors/effector_antenna').upgrades,['logistics']);
assert.deepEqual(requirementFor(fresh(),'hull:hierarchy_gunship/sensors/fire_control_array').upgrades,['squadrons']);
for(const name of ['Forward Effector','Cargo Storage','Hull','Shield Generator','Torpedo System']) {
 const sensor=authoredSystems.find(i=>i.shipId==='hull:hierarchy_gunship'&&i.name===name)!;
 assert.equal(access(sensor,{...fresh(),traits:['Military','Trade'],purchased:['basic','escorting']}).status,'available');
}

const schoonerGroups=slotGroups(authoredSystems,'hull:schooner');
assert.deepEqual(schoonerGroups.map(g=>[g.name,g.count,g.options.length]),[['Effectors',1,4],['Systems',2,4]]);
assert.deepEqual(requirementFor(fresh(),'hull:schooner/systems/shield_extension').traits,['Science']);
assert.equal(requirementFor(fresh(),'hull:schooner/systems/sensor_array').defined,true);

for(const [name,gate] of [['long_range_effectors','logistics'],['heavy_duty_effectors','storage'],['industrial_effectors','fields']])assert.deepEqual(requirementFor(fresh(),`hull:schooner/effectors/${name}`).upgrades,[gate]);
assert.deepEqual(schoonerGroups.find(g=>g.name==='Systems')!.options.map(i=>i.name),['Resources Scanner','Shield Extension','Forcefield Generator','Sensor Array']);

for(const id of ['preset:providence_salvager/core/1/2','hull:schooner/systems/forcefield_generator']) {
 assert.deepEqual(requirementFor(fresh(),id).traits,[]);
 assert.deepEqual(requirementFor(fresh(),id).upgrades,['hull']);
}

assert.deepEqual(requirementFor(fresh(),'preset:opulence_freighter/left/0/2').traits,['Military']);
assert.deepEqual(requirementFor(fresh(),'preset:opulence_freighter/left/0/2').upgrades,['perimeter']);
for(const index of [1,2,3,4,5,6]) assert.deepEqual(requirementFor(fresh(),`preset:opulence_freighter/right/0/${index}`),requirementFor(fresh(),`preset:opulence_freighter/left/1/${index}`));
assert.deepEqual(requirementFor(fresh(),'weapon:tracking_laser').upgrades,['contracting']);
assert.equal(requirementFor(fresh(),'weapon:point_defense').defined,true);

for(const [id,gates] of [['weapon:railgun',['contracting']],['weapon:double_railgun',['ordnance']],['weapon:triple_cannon',['ordnance']],['preset:opulence_freighter/left/2/3',['squadrons']]] as const)assert.deepEqual(requirementFor(fresh(),id).upgrades,[...gates]);
assert.deepEqual(requirementFor(fresh(),'preset:opulence_freighter/left/2/0').traits,['Science']);
assert.deepEqual(requirementFor(fresh(),'preset:opulence_freighter/left/2/1').traits,['Military']);
assert.deepEqual(requirementFor(fresh(),'weapon:double_cannon').traits,[]);

assert.deepEqual(parseWorkbench({...fresh(),advancements:undefined}).advancements,{});
const stagedWeaponState=parseWorkbench({...fresh(),advancements:{'weapon:railgun':'advanced'}});
assert.equal(advancementFor(authoredWeapons.find(w=>w.id==='weapon:railgun')!,stagedWeaponState),'advanced');
assert.equal(advancementFor(buster,fresh()),'advanced');
assert.equal(sharedWeapon({...item,name:'Mining Laser'})?.name,'Mining Beam');
assert.equal(sharedWeapon({...item,name:'Heavy Mining Beam'})?.id,'weapon:heavy_mining_laser');
assert.equal(authoredWeapons.some(w=>w.id==='weapon:point_defense'),false);
assert.equal(authoredWeapons.some(w=>w.id==='weapon:flak_battery'),false);
assert.equal(authoredSystems.find(i=>i.name==='Mining Beam'&&i.shipId==='hull:hierarchy_gunship')?.id,'hull:hierarchy_gunship/weapon/mining_laser');

assert.equal(authoredWeapons.every(w=>advancementFor(w,fresh())!=='unassigned'),true);
assert.equal(advancementFor(authoredWeapons.find(w=>w.name==='Heavy Ion Beam')!,fresh()),'advanced');
assert.equal(advancementFor(authoredWeapons.find(w=>w.name==='Ballistic Cannon')!,fresh()),'base');
assert.equal(advancementFor(authoredWeapons.find(w=>w.name==='Siege Cannon')!,fresh()),'cutting-edge');
