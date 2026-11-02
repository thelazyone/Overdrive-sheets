import { parseShipDocument } from '../core/schema';
import oldTenderWeapons from './migrations/tender-before-weapons.json';
import oldFreighter from './migrations/freighter-before-refit.json';
import type { Item } from './model';

// Read existing authoring sources directly. Requirements live in a separate draft
// overlay until the ship authoring schema can preserve them end to end.
const modules = import.meta.glob('../presets/*.json', { eager: true, import: 'default' });
// Retain the old shape only to recognize and migrate existing saved workbenches.
const previousCatalog: Item[] = [];
export const fixedSystemIds = new Set<string>();
for (const [path, raw] of Object.entries(modules).sort()) {
  const key = path.split('/').pop()!.replace('.json', '');
  const ship = parseShipDocument(raw);
  const id = `preset:${key}`;
  previousCatalog.push({id, name:ship.description || ship.name, kind:'ship', description:'Current card-builder preset. Access requirements have not yet been authored.'});
  for (const side of ['left','core','right'] as const) {
    ship.sections[side].forEach((ref, slotIndex) => {
      const options = ref.kind === 'slot' ? ref.options : [ref.system];
      options.forEach((system, optionIndex) => {
        const systemId = `${id}/${side}/${slotIndex}/${optionIndex}`;
        if (ref.kind !== 'slot') fixedSystemIds.add(systemId);
        previousCatalog.push({id:systemId, shipId:id, name:system.name, kind:'system', slot:`${side} · ${ref.kind === 'slot' ? ref.label || `Slot ${slotIndex+1}` : 'Fixed system'}`, description:[system.rules, ...system.areas.map(a => [a.name,a.description].filter(Boolean).join(': '))].filter(Boolean).join(' · ')});
      });
    });
  }
}
// Preserve the preceding descriptions for historical fingerprint migrations.
const auxIds = new Set(['preset:opulence_freighter/left/1/3','preset:opulence_freighter/right/0/3']);
for (const item of previousCatalog) if (auxIds.has(item.id)) item.description = 'Profile pending designer authoring.';
// A fingerprint prevents draft mappings from silently attaching to changed slots.
export const legacyCatalogFingerprint = JSON.stringify(previousCatalog);
// Fixed systems are inherent hull equipment, never gated Charter options.
export const beforeAuxReactorFingerprint = JSON.stringify(previousCatalog.filter(item => !fixedSystemIds.has(item.id)));
export const catalog = previousCatalog.filter(item => !fixedSystemIds.has(item.id)).map(item => auxIds.has(item.id) ? {...item,description:'+1 production'} : item);
export const catalogFingerprint = JSON.stringify(catalog);
const tenderWeaponSlot = (item:Item) => /^preset:contemplation_escort_vessel\/(left|right)\/0\//.test(item.id);
const beforeTenderFull = previousCatalog.flatMap(item=>tenderWeaponSlot(item)?item.id.endsWith('/0')?oldTenderWeapons.filter(old=>old.id===item.id) as Item[]:[]:[item]);
const beforeTenderCatalog = beforeTenderFull.filter(item=>!fixedSystemIds.has(item.id));
export const beforeTenderFingerprint = JSON.stringify(beforeTenderCatalog);
// Exact preceding catalog: migrate only the named Salvager revision, preserving
// existing draft mappings while dropping Effectors now included in the hull.
// Frozen migration data, never an authoring source.
const preRefitFull = beforeTenderFull.flatMap(item=>item.id==='preset:opulence_freighter'?oldFreighter as Item[]:item.shipId==='preset:opulence_freighter'?[]:[item]);
const preRefitCatalog = preRefitFull.filter(item=>!item.slot?.endsWith('Fixed system'));
export const beforeFreighterFingerprint = JSON.stringify(preRefitCatalog);
const beforeHabCatalog = preRefitCatalog.filter(i=>!i.id.startsWith('preset:opulence_freighter/right/2/'));
export const beforeHabFingerprint = JSON.stringify(beforeHabCatalog);
const beforeAntennaCatalog = beforeHabCatalog.filter(i=>!i.id.startsWith('preset:contemplation_escort_vessel/left/1/'));
export const beforeAntennaFingerprint = JSON.stringify(beforeAntennaCatalog);
export const beforeSalvagerFingerprint = JSON.stringify(beforeAntennaCatalog.flatMap(item => {
  if (['preset:providence_salvager/core/1/2','preset:providence_salvager/core/2/1'].includes(item.id)) return [];
  if (item.id === 'preset:providence_salvager/core/2/0') {
    const effectors = previousCatalog.find(i=>i.id==='preset:providence_salvager/right/2/0')!;
    return [{...item,name:'Docking Bay'},{...effectors,slot:'right · Effectors'}];
  }
  return [item];
}));

// Additive Freighter options preserve every existing positional mapping.
const beforeHabOptionsCatalog = beforeTenderCatalog.filter(i=>!['preset:opulence_freighter/right/2/3','preset:opulence_freighter/right/2/4'].includes(i.id));
export const beforeHabOptionsFingerprint = JSON.stringify(beforeHabOptionsCatalog);
export const beforeFreighterExpansionFingerprint = JSON.stringify(beforeHabOptionsCatalog.filter(i=>!['preset:opulence_freighter/left/0/2',...['left/1','right/0'].flatMap(slot=>[5,6,7].map(index=>`preset:opulence_freighter/${slot}/${index}`))].includes(i.id)));
