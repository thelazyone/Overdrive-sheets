import {readFileSync,writeFileSync} from 'node:fs';
import {parseShipDocument} from '../src/core/schema';
import {fresh,itemRequirement,requirementFor,hullMetadata,byId} from '../src/charter/model';
const id='preset:opulence_freighter';
const raw=JSON.parse(readFileSync('src/presets/opulence_freighter.json','utf8'));
const ship=parseShipDocument(raw);
const state=fresh();
function gates(r:any){return {traits:r.traits,upgrades:r.upgrades.map((id:string)=>byId[id].name)};}
const sections=Object.fromEntries((['left','core','right'] as const).map(side=>[side,ship.sections[side].map((ref,index)=>ref.kind==='slot'?{kind:'slot',label:ref.label,options:ref.options.map((system,option)=>({name:system.name,profile:raw.sections[side][index].options[option],requirements:gates(itemRequirement({id:`${id}/${side}/${index}/${option}`,name:system.name,kind:'system',shipId:id,description:''},state))}))}:{kind:'fixed',system:ref.system})]));
writeFileSync('../tmp/pdfs/opulence-manual-data.json',JSON.stringify({ship,hull:hullMetadata[id],requirements:gates(requirementFor(state,id)),sections},null,2));
