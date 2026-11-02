import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShipDocument } from '../src/core/schema';
import { advancementFor, advancementLevels, weaponCategories, authoredSystems, authoredWeapons, categoryFor, itemRequirement, slotGroups, hullMetadata, authoredVessels, requirementFor, fresh, byId, baseBenefits, type Item } from '../src/charter/model';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const presets=resolve(root,'web/src/presets');
const state=fresh();
const escape=(text:string)=>text.replaceAll('|','\\|').replaceAll('\n',' ');
const gates=(id:string,item?:Item)=>{const r=item?itemRequirement(item,state):requirementFor(state,id);return !r.defined?'Not defined':[...(r.traits.length?[r.traits.join(' or ')]:[]),...r.upgrades.map(u=>byId[u].name)].join(' + ')||'Always available';};
const lines=['# Ship systems and requirements','',
  'Generated from the current presets and `web/src/charter/content.json`. Regenerate with `npm run report:charter` from `web/`; edit the authoring sources rather than this report. Browser-only draft overrides are not included.','',
  'Only modular slots are listed. Shared fore/aft and left/right slot families appear once, with their physical slot count. System gates are not yet assigned unless explicitly shown.',''];
lines.push('## Capital roster','','| Vessel | Size | Class name | Requirements |','| --- | ---: | --- | --- |');
for(const [id,h] of Object.entries(hullMetadata))lines.push(`| ${h.role} | ${h.size} | ${h.className} | ${gates(id)} |`);
lines.push('');
for (const file of readdirSync(presets).filter(f=>f.endsWith('.json')).sort()) {
  const id=`preset:${file.replace('.json','')}`;
  const ship=parseShipDocument(JSON.parse(readFileSync(resolve(presets,file),'utf8')));
  const items:Item[]=[];
  for(const side of ['left','core','right'] as const)ship.sections[side].forEach((ref,index)=>{
    if(ref.kind!=='slot')return;
    ref.options.forEach((s,option)=>items.push({id:`${id}/${side}/${index}/${option}`,shipId:id,name:s.name,kind:'system',slot:`${side} · ${ref.label||`Slot ${index+1}`}`,description:s.rules??''}));
  });
  lines.push(`## ${ship.description || ship.name} — Size ${hullMetadata[id]?.size??'unknown'}`,'',`Hull requirements: **${gates(id)}**.`, '');
  if(hullMetadata[id]?.note)lines.push(hullMetadata[id].note!,'');
  lines.push('| Slot family | Slots | Options | Systems | Additional system requirements |','| --- | ---: | ---: | --- | --- |');
  for(const g of slotGroups(items,id))lines.push(`| ${escape(g.name)} | ${g.count} | ${g.options.length} | ${g.options.map(i=>escape(i.name)).join('; ')} | ${g.options.map(i=>`${escape(i.name)}: ${gates(i.id,i)}`).join('; ')} |`);
  const sparse=slotGroups(items,id).filter(g=>g.options.length===1).map(g=>g.name);
  lines.push('',`One-option families: ${sparse.length?sparse.join(', '):'none'}.`,'');
}
lines.push('## Hulls awaiting profiles','','| Vessel | Slot family | Slots | Options | Additional system requirements |','| --- | --- | ---: | --- | --- |');
for(const vessel of authoredVessels.filter(v=>v.kind==='ship'))for(const group of slotGroups(authoredSystems,vessel.id))lines.push(`| ${vessel.name} | ${group.name} | ${group.count} | ${group.options.map(i=>i.name).join('; ')||'To be defined'} | ${group.options.map(i=>`${i.name}: ${gates(i.id,i)}`).join('; ')||'To be defined'} |`);
lines.push('','## Light ships and platforms','','| Vessel | Category | Required upgrades |','| --- | --- | --- |');
for(const vessel of authoredVessels.filter(v=>v.kind!=='ship'))lines.push(`| ${vessel.name} | ${categoryFor(vessel,state)} | ${gates(vessel.id)} |`);
lines.push('','## Shared weapons','','| Weapon | Family | Advancement | Requirements |','| --- | --- | --- | --- |');
for(const weapon of authoredWeapons)lines.push(`| ${weapon.name} | ${weaponCategories.find(c=>c.id===categoryFor(weapon,state))?.name??'Unassigned'} | ${advancementLevels.find(l=>l.id===advancementFor(weapon,state))?.name??'Unassigned'} | ${gates(weapon.id)} |`);
lines.push('','## Fleet effects','');
for(const [id,effects] of Object.entries(baseBenefits))for(const effect of effects)lines.push(`- ${byId[id].name}: ${effect}.`);
lines.push('','## Next design work','','See [SYSTEM-IDEAS.md](SYSTEM-IDEAS.md) for proposed additions. These are separate from accepted profiles and requirements.','');
mkdirSync(resolve(root,'docs'),{recursive:true});
writeFileSync(resolve(root,'docs/SHIP-SYSTEMS.md'),lines.join('\n'));
console.log('Updated docs/SHIP-SYSTEMS.md');
