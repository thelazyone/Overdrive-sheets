import { z } from 'zod';
import graph from './upgrades.json';
import content from './content.json';
import categories from './categories.json';
import weaponData from './weapons.json';
export const vesselCategories = categories.vessels;
export const weaponCategories = categories.weapons;
export const advancementLevels = categories.advancement;

export const TRAITS = ['Trade', 'Military', 'Exploration', 'Science', 'Diplomacy'] as const;
export const upgrades = graph.upgrades;
export const revision = graph.revision;
export const byId = Object.fromEntries(upgrades.map(u => [u.id, u]));
const upgradeId = z.string().refine(id => !!byId[id], 'Unknown Charter upgrade');
export const requirementSchema = z.object({
  defined: z.boolean(), traits: z.array(z.enum(TRAITS)), upgrades: z.array(upgradeId),
  reputation: z.string().max(500),
});
export type Requirement = z.infer<typeof requirementSchema>;
export const unknownRequirement = (): Requirement => ({ defined: false, traits: [], upgrades: [], reputation: '' });
export const hullMetadata = content.hulls as Record<string, {size:number;role?:string;className?:string;upgrades:string[];defined:boolean;traits?:typeof TRAITS[number][];note?:string;tonnageExempt?:boolean}>;
export const baseRequirements: Record<string, Requirement> = Object.fromEntries([
  ...Object.entries(content.requirements).map(([id,r]) => [id, requirementSchema.parse(r)]),
  ...Object.entries(hullMetadata).map(([id,h]) => [id, {...unknownRequirement(),defined:h.defined,traits:h.traits??[],upgrades:[...h.upgrades,...(h.size===3&&!h.tonnageExempt?[content.size3Upgrade]:[])]}]),
]);
export const baseBenefits: Record<string,string[]> = Object.fromEntries(Object.entries(content.effects).map(([id,effects])=>[id,effects.map(e=>e.text)]));
export function requirementFor(state: Workbench, id: string): Requirement {
  const draft=state.requirements[id];
  // Empty unknown placeholders from earlier workbenches do not mask authored data.
  if(draft && (draft.defined || draft.traits.length || draft.upgrades.length || draft.reputation)) return {...draft,defined:true};
  const source=(content.requirementLinks as Record<string,string>)[id];
  return source ? requirementFor(state,source) : {...(baseRequirements[id] ?? draft ?? unknownRequirement()),defined:true};
}
export function benefitsFor(state: Workbench,id:string): string[] {
  return [...new Set([...(baseBenefits[id]??[]),...(state.benefits[id]??[])])];
}
export const itemSchema = z.object({
  id: z.string().min(1).max(300), name: z.string().min(1).max(150),
  kind: z.enum(['ship', 'system', 'light', 'platform', 'weapon']),
  category: z.string().optional(), family: z.string().optional(), advancement: z.enum(['base','advanced','cutting-edge','unassigned']).optional(),
  shipId: z.string().optional(), slot: z.string().optional(), description: z.string().max(10000),
});
export type Item = z.infer<typeof itemSchema>;
export const authoredVessels: Item[] = content.vessels.map(v=>itemSchema.parse({...v,description:'Designer-authored roster. Combat profile not yet imported.'}));
export const authoredSystems: Item[] = Object.entries(content.slotLayouts).flatMap(([shipId,slots])=>slots.flatMap(slot=>('options' in slot ? slot.options as string[] : []).map(name=>itemSchema.parse({id:`${shipId}/${slot.name.toLowerCase()}/${name.replace('Mining Beam','Mining Laser').toLowerCase().replace(/ /g,'_')}`,shipId,name,kind:'system',slot:slot.name,description:name==='Hull'?'Empty hull option. No actions or effects.':'Designer-authored fitting option. Combat profile pending.'}))));
export const authoredWeapons: Item[] = weaponData.weapons.map(w=>itemSchema.parse({...w,kind:'weapon',description:'Shared weapon design. Profile stays in the ship presets or system library.'}));
export function sharedWeapon(item:Item): Item | undefined {
  if(item.kind!=='system'&&item.kind!=='weapon') return undefined;
  const name=item.name.trim().toLowerCase();
  const entry=weaponData.weapons.find(w=>w.name.toLowerCase()===name||('aliases' in w&&w.aliases?.some(alias=>alias.toLowerCase()===name)));
  return authoredWeapons.find(w=>w.id===entry?.id);
}
export function categoryFor(item:Item,state:Workbench):string {
  return state.categories[item.id]??item.category??'unassigned';
}
export function advancementFor(item:Item,state:Workbench):string {
  return state.advancements[item.id]??item.advancement??'unassigned';
}
export function itemRequirement(item:Item,state:Workbench):Requirement {
  const shared=sharedWeapon(item);
  if(shared){const raw=state.requirements[shared.id]??baseRequirements[shared.id];if(raw&&(raw.defined||raw.upgrades.length||raw.traits.length||raw.reputation))return requirementFor(state,shared.id);}
  return requirementFor(state,item.id);
}
export function requiredUpgrades(item:Item,state:Workbench): string[] {
  return [...new Set([...(itemRequirement(item,state).upgrades),...(item.shipId?requirementFor(state,item.shipId).upgrades:[])])];
}
// Availability is about a system design, not the number of sockets it fits.
export function systemKey(item: Item): string {
  return item.kind === 'system' ? JSON.stringify([item.shipId, item.name.trim().toLowerCase()]) : item.id;
}
export function uniqueSystems(items: Item[]): Item[] {
  const groups = new Map<string, Item>();
  for (const item of items) {
    const key = systemKey(item);
    const existing = groups.get(key);
    if (!existing) groups.set(key, {...item});
    else existing.slot = [...new Set([...(existing.slot?.split(' / ') ?? []), ...(item.slot ? [item.slot] : [])])].join(' / ');
  }
  return [...groups.values()];
}
export function systemAccess(item: Item, items: Item[], state: Workbench): Access {
  const options = items.filter(candidate => systemKey(candidate) === systemKey(item));
  const results = (options.length ? options : [item]).map(option => access(option, state));
  // Usable in any compatible slot is usable. Unknown routes must not be reported
  // as impossible merely because a different slot is excluded by traits.
  const order: Access['status'][] = ['available','later','reputation','unknown','choose','excluded'];
  return results.sort((a,b) => order.indexOf(a.status)-order.indexOf(b.status))[0];
}
export function slotGroups(items: Item[], shipId: string): {name:string;count:number;locations:string[];options:Item[]}[] {
  const groups = new Map<string,{name:string;slots:Set<string>;locations:Set<string>;options:Item[]}>();
  const layouts = content.slotLayouts as Record<string,{name:string;locations:string[]}[]>;
  for (const slot of layouts[shipId]??[]) groups.set(slot.name.toLowerCase(),{name:slot.name,slots:new Set(slot.locations),locations:new Set(slot.locations),options:[]});
  for (const item of items.filter(i=>i.kind==='system'&&i.shipId===shipId)) {
    const label = item.slot?.split(' · ').slice(1).join(' · ') || item.slot || 'Proposed slot';
    const name = label.replace(/^(fore|aft|front|rear|left|right)\s+/i,'').replace(/^./,c=>c.toUpperCase());
    const key = name.toLowerCase();
    let group = groups.get(key);
    if (!group) {group={name,slots:new Set(),locations:new Set(),options:[]};groups.set(key,group);}
    if(!(layouts[shipId]??[]).some(slot=>slot.name.toLowerCase()===key)) {
      group.slots.add(item.id.startsWith('preset:')?item.id.slice(0,item.id.lastIndexOf('/')):item.slot??item.id);
      group.locations.add(item.slot??'Proposed slot');
    }
    group.options.push(item);
  }
  return [...groups.values()].map(g=>({name:g.name,count:g.slots.size,locations:[...g.locations],options:uniqueSystems(g.options)}));
}
export const workbenchSchema = z.object({
  format: z.literal('overdrive-charter-1'), graphRevision: z.literal(revision),
  name: z.string().max(150), traits: z.array(z.enum(TRAITS)).max(2).refine(v => new Set(v).size === v.length),
  budget: z.number().int().min(0).max(10000), purchased: z.array(upgradeId),
  requirements: z.record(requirementSchema),
  benefits: z.record(z.array(z.string().min(1).max(1000))).refine(v => Object.keys(v).every(id => !!byId[id])),
  concepts: z.array(itemSchema).max(1000),
  advancements: z.record(z.enum(['base','advanced','cutting-edge','unassigned'])).default({}),
  categories: z.record(z.string().refine(id=>[...vesselCategories,...weaponCategories].some(c=>c.id===id)||['main-guns','light-guns','heavy-guns','energy','utility'].includes(id),'Unknown category')).default({}),
});
export type Workbench = z.infer<typeof workbenchSchema>;
export const fresh = (): Workbench => ({ format: 'overdrive-charter-1', graphRevision: revision, name: 'Untitled fleet', traits: [], budget: 60, purchased: ['basic'], requirements: {}, benefits: {}, concepts: [], categories:{}, advancements:{} });
export const spent = (ids: string[]) => upgrades.filter(u => ids.includes(u.id)).reduce((sum, u) => sum + u.cost, 0);

// Walk by tier: a purchased node survives when any surviving parent supports it.
export function connected(ids: string[]): string[] {
  const result = ['basic'];
  for (const u of [...upgrades].sort((a,b) => a.tier - b.tier)) {
    if (u.id !== 'basic' && ids.includes(u.id) && u.parents.some(p => result.includes(p))) result.push(u.id);
  }
  return result;
}
export function parseWorkbench(raw: unknown): Workbench {
  const value = workbenchSchema.parse(raw);
  if (new Set(value.purchased).size !== value.purchased.length || !value.purchased.includes('basic') || connected(value.purchased).length !== value.purchased.length) throw new Error('The saved Charter has disconnected or duplicate purchases.');
  if (spent(value.purchased) > value.budget) throw new Error('The saved Charter exceeds its budget.');
  // A draft may be between trait selections. Purchases are trait-neutral;
  // purchaseReason still prevents buying until a pair is selected.
  if (new Set(value.concepts.map(i => i.id)).size !== value.concepts.length) throw new Error('Duplicate concept IDs.');
  return value;
}
export function purchaseReason(id: string, state: Workbench): string {
  const u = byId[id];
  if (!u) return 'Unknown upgrade';
  if (state.purchased.includes(id)) return id === 'basic' ? 'Always included' : 'Purchased';
  if (state.traits.length !== 2) return 'Choose two traits first';
  if (!u.parents.some(p => state.purchased.includes(p))) return `Needs one of: ${u.parents.map(p => byId[p].name).join(', ')}`;
  if (spent(state.purchased) + u.cost > state.budget) return `Needs ${u.cost - (state.budget - spent(state.purchased))} more credits`;
  return '';
}
export type Access = { status: 'available' | 'later' | 'excluded' | 'unknown' | 'reputation' | 'choose'; reason: string };
export function access(item: Item, state: Workbench): Access {
  const own = itemRequirement(item,state);
  const reqs = [own];
  if (item.shipId) reqs.push(requirementFor(state,item.shipId));
  if (state.traits.length !== 2) return {status:'choose', reason:'Choose two traits to explore access.'};
  const excluded = reqs.find(r => r.defined && r.traits.length && !r.traits.some(t => state.traits.includes(t)));
  if (excluded) return {status:'excluded', reason:`Requires one of: ${excluded.traits.join(', ')}${excluded === own ? '' : ' (hull requirement)'}.`};
  const missing = [...new Set(reqs.flatMap(r => r.upgrades))].filter(id => !state.purchased.includes(id));
  if (missing.length) return {status:'later', reason:`Needs: ${missing.map(id => byId[id].name).join(', ')}.`};
  const rep = reqs.map(r => r.reputation).filter(Boolean);
  if (rep.length) return {status:'reputation', reason:`Check reputation: ${rep.join('; ')}`};
  return {status:'available', reason:'All authored access requirements met. Fleet capacity and deployment are not evaluated.'};
}

// Minimum additional spend for ALL targets, accounting for shared prerequisites.
export function cheapestPath(targets: string[], state: Workbench): {cost:number; ids:string[]} | null {
  let best: {cost:number; ids:string[]} | null = null;
  const optional = upgrades.filter(u => !state.purchased.includes(u.id));
  for (let mask = 0; mask < 2 ** optional.length; mask++) {
    const ids = optional.filter((_, i) => mask & (1 << i)).map(u => u.id);
    const cost = spent(ids);
    if (best && cost >= best.cost) continue;
    const all = [...state.purchased, ...ids];
    if (!targets.every(id => all.includes(id))) continue;
    if (connected(all).length === all.length) best = {cost, ids};
  }
  return best;
}
