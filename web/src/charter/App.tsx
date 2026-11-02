import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { access as directAccess, advancementFor, advancementLevels, categoryFor, sharedWeapon, itemRequirement, authoredSystems, authoredWeapons, vesselCategories, weaponCategories, slotGroups, authoredVessels, hullMetadata, requirementFor, benefitsFor, systemAccess, systemKey, uniqueSystems, byId, cheapestPath, connected, fresh, parseWorkbench, purchaseReason, spent, TRAITS, unknownRequirement, upgrades, type Item, type Requirement, type Workbench } from './model';
import { catalog, catalogFingerprint, beforeAuxReactorFingerprint, legacyCatalogFingerprint, beforeTenderFingerprint, beforeHabOptionsFingerprint, beforeFreighterExpansionFingerprint, beforeFreighterFingerprint, beforeHabFingerprint, beforeAntennaFingerprint, beforeSalvagerFingerprint, fixedSystemIds } from './catalog';

const STORAGE = 'overdrive-charter-workbench-v1';
const TAB_STORAGE = 'overdrive-charter-tab-v1';
type ContentTab = 'capital'|'vessels'|'weapons';
function savedContentTab(): ContentTab {
  try {
    const saved=localStorage.getItem(TAB_STORAGE);
    if(saved==='capital'||saved==='vessels'||saved==='weapons') return saved;
  } catch { /* Browsing works when local storage is unavailable. */ }
  return 'capital';
}
const labels = {available:'Available now', later:'Needs upgrades', excluded:'Other traits only', unknown:'Not defined', reputation:'Reputation check', choose:'Choose traits'};

export function CharterApp() {
  const [notice, setNotice] = createSignal('');
  const [state, setState] = createSignal<Workbench>(fresh());
  const [selected, setSelected] = createSignal('basic');
  const [hoveredUpgrade,setHoveredUpgrade] = createSignal<string|null>(null);
  const [editing, setEditing] = createSignal<Item | null>(null);
  const [search, setSearch] = createSignal('');
  const [filter, setFilter] = createSignal('all');
  const [focusedShip,setFocusedShip] = createSignal('');
  const [benefitText, setBenefitText] = createSignal('');
  const [conceptName, setConceptName] = createSignal('');
  const [conceptKind, setConceptKind] = createSignal<Item['kind']>('light');
  const [conceptShip, setConceptShip] = createSignal('');
  const [authorMode, setAuthorMode] = createSignal(false);
  const [compare, setCompare] = createSignal(false);
  const [contentTab,setContentTab]=createSignal<ContentTab>(savedContentTab());
  createEffect(()=>{
    const tab=contentTab();
    try { localStorage.setItem(TAB_STORAGE,tab); } catch { /* Optional view preference. */ }
  });
  const [conceptCategory,setConceptCategory]=createSignal('unassigned');
  const [hovered,setHovered] = createSignal<{item:Item;traits?:Workbench['traits'];left:number;top:number}|null>(null);
  const hoverRequirements = createMemo(()=>hovered()?itemRequirement(hovered()!.item,state()).upgrades:[]);
  const hoverAccess = createMemo(()=>hovered()?directAccess({...hovered()!.item,shipId:undefined},{...state(),traits:hovered()!.traits??state().traits}):null);
  const hoverProps = (item:Item,traits?:Workbench['traits']) => {
    const show = (event: {currentTarget: HTMLElement}) => {
      const rect=event.currentTarget.getBoundingClientRect();
      setHovered({item,traits,left:Math.max(8,Math.min(rect.left,window.innerWidth-316)),top:rect.bottom+140<window.innerHeight?rect.bottom+7:Math.max(8,rect.top-130)});
    };
    return {onMouseEnter:show,onMouseLeave:()=>setHovered(null),onFocus:show,onBlur:()=>setHovered(null),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Escape')setHovered(null);},'aria-describedby':hovered()?.item.id===item.id?'access-tooltip':undefined};
  };
  const inspectItem = (item:Item) => { if(authorMode()){setHovered(null);setEditing(item);} };
  const sizeLabel = (item:Item) => hullMetadata[item.id]?` · Size ${hullMetadata[item.id].size}`:'';
  const pairs = TRAITS.flatMap((a,i) => TRAITS.slice(i+1).map(b => [a,b]));
  let importInput!: HTMLInputElement;
  const sourceItems = createMemo(() => [...catalog, ...authoredVessels, ...authoredSystems, ...authoredWeapons, ...state().concepts].map(item=>({...item,name:hullMetadata[item.id]?.role??item.name})));
  const items = createMemo(() => uniqueSystems(sourceItems()));
  const access = (item: Item, snapshot: Workbench) => systemAccess(item, sourceItems(), snapshot);
  const matrixFamilies = createMemo(()=>weaponCategories.filter(f=>f.id!=='unassigned'||items().some(i=>i.kind==='weapon'&&categoryFor(i,state())==='unassigned')));
  const matrixLevels = createMemo(()=>advancementLevels.filter(l=>l.id!=='unassigned'||items().some(i=>i.kind==='weapon'&&advancementFor(i,state())==='unassigned')));
  const ships = createMemo(() => items().filter(i => i.kind === 'ship'));
  const shownShips = createMemo(() => ships().filter(ship=>!focusedShip()||ship.id===focusedShip()));
  const current = createMemo(() => byId[selected()]);
  const remaining = createMemo(() => state().budget - spent(state().purchased));
  const requiresHoveredUpgrade = (item:Item) => !!hoveredUpgrade() && sourceItems().some(candidate=>systemKey(candidate)===systemKey(item)&&itemRequirement(candidate,state()).upgrades.includes(hoveredUpgrade()!));
  const linked = createMemo(() => items().filter(i => sourceItems().some(s => systemKey(s) === systemKey(i) && itemRequirement(s,state()).upgrades.includes(selected()))));
  const path = createMemo(() => cheapestPath([selected()], state()));
  const activeBenefits = createMemo(() => state().purchased.flatMap(id => benefitsFor(state(),id).map(text => ({id, text}))));
  const req = createMemo(() => {
    const item = editing();
    if (!item) return unknownRequirement();
    if(sharedWeapon(item)) return itemRequirement(item,state());
    return sourceItems().filter(s => systemKey(s) === systemKey(item)).map(s => itemRequirement(s,state())).find(r => r?.defined) ?? requirementFor(state(),item.id);
  });
  const editPath = createMemo(() => {
    const item = editing();
    if (!item) return null;
    const targets = [...req().upgrades, ...(item.shipId ? requirementFor(state(),item.shipId).upgrades : [])];
    return cheapestPath(targets, state());
  });

  function decode(text: string) {
    const parsed = JSON.parse(text);
    // This display-name-only change leaves all slot identities and mappings intact.
    if(typeof parsed.catalogFingerprint==='string') parsed.catalogFingerprint=parsed.catalogFingerprint.replaceAll('"name":"Double Cannon"','"name":"Twin Cannon"').replaceAll('Mining Laser','Mining Beam');
    const legacy = parsed.catalogFingerprint === legacyCatalogFingerprint || parsed.catalogFingerprint === beforeSalvagerFingerprint || parsed.catalogFingerprint === beforeAntennaFingerprint || parsed.catalogFingerprint === beforeHabFingerprint || parsed.catalogFingerprint === beforeFreighterFingerprint;
    if (parsed.catalogFingerprint !== catalogFingerprint && parsed.catalogFingerprint !== beforeAuxReactorFingerprint && parsed.catalogFingerprint !== beforeTenderFingerprint && parsed.catalogFingerprint !== beforeFreighterExpansionFingerprint && parsed.catalogFingerprint !== beforeHabOptionsFingerprint && !legacy) throw new Error('This file uses a different ship catalog. Keep the file and reconcile its mappings before importing.');
    const next = parseWorkbench(parsed.state);
    if(parsed.catalogFingerprint!==catalogFingerprint) {
      // Former Asteroid Buster positions now contain different weapon designs.
      for(const id of ['preset:contemplation_escort_vessel/left/0/0','preset:contemplation_escort_vessel/right/0/0']) delete next.requirements[id];
    }
    if(legacy) {
      const habId='preset:opulence_freighter/right/2/0';
      for(const oldId of ['preset:opulence_freighter/left/1/1','preset:opulence_freighter/right/0/1']) {
        if(next.requirements[oldId] && !next.requirements[habId]) next.requirements[habId]=next.requirements[oldId];
        delete next.requirements[oldId];
      }
    }
    for(const id of ['weapon:cutting_laser','weapon:double_minigun','weapon:missile_rack','weapon:field_gun','hull:schooner/systems/prehensile_cranes','hull:schooner/systems/processing_bay','hull:schooner/systems/cargo_bay']) {
      delete next.requirements[id];
      delete next.categories[id];
    }
    // Dual Flak is a mount configuration of the same weapon, not a separate unlock.
    for (const records of [next.requirements,next.categories]) {
      const oldId='weapon:dual_flak_battery', id='weapon:flak_battery';
      if(records[oldId]!==undefined) {
        if(records[id]===undefined) Object.assign(records,{[id]:records[oldId]});
        delete records[oldId];
      }
    }
    if (legacy) {
      // Preserve purchases and modular requirements; fixed equipment cannot have gates.
      next.requirements = Object.fromEntries(Object.entries(next.requirements).filter(([id]) => !fixedSystemIds.has(id)));
    }
    for(const id of ['weapon:flak_battery','weapon:dual_flak_battery','weapon:point_defense']) {
      delete next.requirements[id]; delete next.categories[id]; delete next.advancements[id];
    }
    for(const [id,category] of Object.entries(next.categories)) {
      if(['main-guns','light-guns','heavy-guns','energy','utility'].includes(category)) {
        const weapon=authoredWeapons.find(w=>w.id===id)??next.concepts.find(w=>w.id===id&&w.kind==='weapon');
        if(weapon) next.categories[id]=weapon.category&&weaponCategories.some(c=>c.id===weapon.category)?weapon.category:'unassigned';
      }
    }
    for(const item of next.concepts) if(item.kind==='weapon'&&item.category&&!weaponCategories.some(c=>c.id===item.category)) item.category='unassigned';
    if(Object.keys(next.advancements).some(id=>![...authoredWeapons,...next.concepts.filter(i=>i.kind==='weapon')].some(w=>w.id===id))) throw new Error('Advancement refers to a missing weapon.');
    const ids = new Set([...catalog, ...authoredVessels, ...authoredSystems, ...authoredWeapons, ...next.concepts].map(i => i.id));
    if (ids.size !== catalog.length + authoredVessels.length + authoredSystems.length + authoredWeapons.length + next.concepts.length) throw new Error('Concept IDs conflict with existing content.');
    if (Object.keys(next.requirements).some(id => !ids.has(id))) throw new Error('Requirements refer to missing content.');
    for (const [id,category] of Object.entries(next.categories)) {
      const item=[...catalog,...authoredVessels,...authoredWeapons,...next.concepts].find(i=>i.id===id);
      const allowed=item?.kind==='weapon'?weaponCategories:item?.kind==='light'||item?.kind==='platform'?vesselCategories:[];
      if(!allowed.some(c=>c.id===category)) throw new Error('Category does not match its content type.');
    }
    if (next.concepts.some(i => i.kind === 'system' && (!i.shipId || ![...catalog,...authoredVessels,...authoredWeapons,...next.concepts].some(h => h.id === i.shipId && h.kind === 'ship')))) throw new Error('A system concept needs a valid parent hull.');
    return next;
  }
  let maySave = true;
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) setState(decode(saved));
  } catch (e) { maySave = false; setNotice(`Saved draft could not be loaded: ${String(e)}. The saved copy is preserved; export any new work to keep it.`); }
  createEffect(() => {
    const snapshot = state();
    if (!maySave) return;
    try { localStorage.setItem(STORAGE, JSON.stringify({catalogFingerprint, state:snapshot})); }
    catch { setNotice('Local saving is unavailable. Export your workbench to keep your changes.'); }
  });
  createEffect(() => setBenefitText((state().benefits[selected()] ?? []).join('\n')));
  const update = (patch: Partial<Workbench>) => setState(s => ({...s, ...patch}));

  function toggleTrait(trait: typeof TRAITS[number]) {
    const traits = state().traits;
    if (!traits.includes(trait) && traits.length === 2) { setNotice('Deselect one trait before choosing another.'); return; }
    const next = traits.includes(trait) ? traits.filter(t => t !== trait) : [...traits, trait];
    // Retain purchases while switching a pair; purchases themselves are trait-neutral.
    update({traits:next});
    setNotice('');
  }
  function buy() {
    const id = selected();
    if (id === 'basic') return;
    if (state().purchased.includes(id)) {
      const next = connected(state().purchased.filter(p => p !== id));
      update({purchased:next});
      setNotice('');
    } else if (!purchaseReason(id, state())) {
      update({purchased:[...state().purchased, id]}); setNotice('');
    }
  }
  function saveRequirement(patch: Partial<Requirement>) {
    const item = editing(); if (!item) return;
    const requirements = {...state().requirements};
    const weapon=sharedWeapon(item);
    if(weapon) requirements[weapon.id]={...req(),...patch};
    else for (const option of sourceItems().filter(s => systemKey(s) === systemKey(item))) requirements[option.id] = {...req(), ...patch};
    update({requirements});
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify({catalogFingerprint, state:state()}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='overdrive-charter.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('');
  }
  async function importDraft(file?: File) {
    if (!file) return;
    try { if (file.size > 5000000) throw new Error('File is too large.'); const next = decode(await file.text()); setState(next); setEditing(null); setNotice(''); }
    catch (e) { setNotice(`Import rejected; your current work is unchanged. ${String(e)}`); }
    importInput.value='';
  }
  function addConcept(event: SubmitEvent) {
    event.preventDefault();
    if (!conceptName().trim() || (conceptKind() === 'system' && !conceptShip())) return;
    if(conceptKind()==='weapon'&&items().some(i=>i.kind==='weapon'&&i.name.toLowerCase()===conceptName().trim().toLowerCase())) {setNotice('That weapon already exists. Edit its shared entry.');return;}
    const item: Item = {id:`concept:${crypto.randomUUID()}`, name:conceptName().trim(), kind:conceptKind(), category:conceptCategory(), description:'Draft concept — not an accepted profile.', ...(conceptKind() === 'system' ? {shipId:conceptShip(), slot:'Proposed slot — fitting unconfirmed'} : {})};
    update({concepts:[...state().concepts, item]}); setConceptName(''); setEditing(item);
  }
  function visible(item: Item) {
    return (!search() || `${item.name} ${item.slot ?? ''}`.toLowerCase().includes(search().toLowerCase())) && (filter() === 'all' || access(item,state()).status === filter());
  }
  const UpgradeNames = (props: {item:Item}) => {
    const names = createMemo(() => itemRequirement(props.item,state()).upgrades.map(id=>byId[id].name));
    return <Show when={names().length}><small class="upgrade-requisites">{names().join(' + ')}</small></Show>;
  };
  const TraitInitials = (props: {item:Item}) => {
    const traits = createMemo(() => itemRequirement(props.item,state()).traits);
    return <Show when={traits().length}><span class="trait-initials" title={`Requires ${traits().join(' or ')}`} aria-label={`Requires ${traits().join(' or ')}`}>{traits().map(t=>t[0]).join('/')}</span></Show>;
  };
  const weaponMounts = (item:Item) => [...new Set(sourceItems().filter(i=>i.kind==='system'&&sharedWeapon(i)?.id===item.id).map(i=>ships().find(s=>s.id===i.shipId)?.name).filter(Boolean))].join(' \u00b7 ') || 'No mounts';
  const ItemButton = (props: {item:Item}) => {
    const a = createMemo(() => access(props.item,state()));
    return <button {...hoverProps(props.item)} class={`content-item ${a().status}`} classList={{"upgrade-dependent":requiresHoveredUpgrade(props.item)}} onClick={() => inspectItem(props.item)}  aria-label={`${props.item.name} · ${props.item.slot ?? props.item.kind} · ${labels[a().status]}`}>
      <span class={`status-dot ${a().status}`}/><span class="entry-name">{props.item.name}<Show when={props.item.kind==='weapon'}><small class="weapon-mounts">{weaponMounts(props.item)}</small></Show><UpgradeNames item={props.item}/></span><TraitInitials item={props.item}/>
    </button>;
  };

  return <div class="workbench">
    <header><h1>OVERDRIVE <span>Charter explorer</span></h1><div class="header-actions"><a href="./">Ship sheets ↗</a><button aria-pressed={authorMode()} onClick={()=>setAuthorMode(!authorMode())}>{authorMode()?'Finish editing':'Edit data'}</button><button onClick={()=>importInput.click()}>Import</button><button onClick={exportDraft}>Export</button><input hidden type="file" accept=".json,application/json" ref={importInput} onChange={e=>void importDraft(e.currentTarget.files?.[0])}/></div></header>
    <section class="setup"><div class="trait-buttons"><span class="muted">Traits {state().traits.length}/2</span><For each={TRAITS}>{t=><button aria-pressed={state().traits.includes(t)} classList={{chosen:state().traits.includes(t)}} onClick={()=>toggleTrait(t)}>{t}</button>}</For></div><div class="budget"><label>Budget <input aria-label="Charter budget" type="number" min={spent(state().purchased)} max="10000" value={state().budget} onChange={e=>{const n=Number(e.currentTarget.value);if(Number.isInteger(n)&&n>=spent(state().purchased)&&n<=10000)update({budget:n});else{e.currentTarget.value=String(state().budget);setNotice('Budget must cover purchases (maximum 10,000).');}}}/></label><span><strong>{remaining()}</strong> left · {spent(state().purchased)} spent</span><button onClick={()=>{update({purchased:['basic']});setNotice('');}}>Reset</button></div></section>
    <Show when={notice()}><div class="error-toast" role="alert"><span>{notice()}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div></Show>
    <main class="workspace-grid">
      <section onScroll={()=>setHovered(null)} class="graph-panel" aria-label="Charter upgrades"><div class="section-heading"><h2>Charter upgrades</h2><div class="legend"><span><i class="owned"/>Purchased</span><span><i class="ready"/>Buyable</span><span><i/>Locked</span></div></div>
        <div class="graph"><svg viewBox="0 0 900 480" preserveAspectRatio="none" aria-hidden="true"><For each={upgrades}>{u=><For each={u.parents}>{(pid,index)=>{const p=byId[pid];const start=p.tier*96+88;const end=u.tier*96+8;const mid=start+4+index()*4;return <path classList={{lit:state().purchased.includes(pid),focused:selected()===u.id||selected()===pid}} d={`M ${p.x} ${start} V ${mid} H ${u.x+(index()-(u.parents.length-1)/2)*9} V ${end}`}/>;}}</For>}</For></svg>
        <For each={upgrades}>{u=><button style={{left:`${(u.x-104)/9}%`,top:`${u.tier*96+8}px`}} class="upgrade" onMouseEnter={()=>setHoveredUpgrade(u.id)} onMouseLeave={()=>setHoveredUpgrade(null)} onFocus={()=>setHoveredUpgrade(u.id)} onBlur={()=>setHoveredUpgrade(null)} onKeyDown={e=>{if(e.key==='Escape')setHoveredUpgrade(null);}} classList={{owned:state().purchased.includes(u.id),ready:!purchaseReason(u.id,state()),selected:selected()===u.id, 'missing-requirement':hoverRequirements().includes(u.id)&&!state().purchased.includes(u.id), 'met-requirement':hoverRequirements().includes(u.id)&&state().purchased.includes(u.id)}} aria-pressed={selected()===u.id} title={`${u.description} · ${purchaseReason(u.id,state()) || 'Can purchase'}`} onClick={()=>setSelected(u.id)}><span class="node-meta">{u.tier===0?'BASIC':`${u.cost} cr`}<span>{state().purchased.includes(u.id)?'✓':!purchaseReason(u.id,state())?'+':''}</span></span><strong>{u.name}</strong><small class="node-description">{u.description}</small></button>}</For></div>
        <div class="inspector"><div class="inspector-top"><div><h3>{current().name}</h3><p>{current().description}</p><For each={benefitsFor(state(),selected())}>{text=><small class="upgrade-effect">{text}</small>}</For></div><button class="primary" disabled={selected()==='basic'||(!state().purchased.includes(selected())&&!!purchaseReason(selected(),state()))} onClick={buy}>{state().purchased.includes(selected())?selected()==='basic'?'Included':'Refund':`Buy · ${current().cost} cr`}</button></div><div class="inspector-meta"><span>{current().parents.length?`Needs one: ${current().parents.map(p=>byId[p].name).join(' / ')}`:'Starting upgrade'}</span><Show when={!state().purchased.includes(selected())&&path()}><span title={path()!.ids.map(id=>byId[id].name).join(' → ')}>Cheapest path: {path()!.cost} cr{path()!.cost>remaining()?' · over budget':''}</span></Show></div><Show when={!state().purchased.includes(selected())&&purchaseReason(selected(),state())}><small>{purchaseReason(selected(),state())}</small></Show><Show when={linked().length}><div class="linked-strip"><For each={linked()}>{i=><button {...hoverProps(i)} onClick={()=>inspectItem(i)}>{i.name}</button>}</For></div></Show>
        <Show when={authorMode()}><details><summary>Edit fleet effects</summary><textarea aria-label="Fleet effects" rows="3" value={benefitText()} onInput={e=>setBenefitText(e.currentTarget.value)}/><button onClick={()=>{const lines=benefitText().split('\n').map(t=>t.trim()).filter(Boolean);if(lines.some(l=>l.length>1000)){setNotice('Maximum 1,000 characters per effect.');return;}update({benefits:{...state().benefits,[selected()]:lines}});}}>Save effects</button></details></Show>
        </div><Show when={activeBenefits().length}><div class="fleet-benefits"><strong>Fleet effects</strong><For each={activeBenefits()}>{b=><span title={byId[b.id].name}>{b.text}</span>}</For></div></Show>
      </section>
      <section onScroll={()=>setHovered(null)} class="availability-panel" aria-label="Ship and system availability"><div class="section-heading"><h2>Fleet availability</h2><Show when={contentTab()==='capital'}><div class="view-switch"><button aria-pressed={!compare()} onClick={()=>setCompare(false)}>Selected pair</button><button aria-pressed={compare()} onClick={()=>setCompare(true)}>All 10 pairs</button></div></Show></div><div class="content-tabs" role="tablist" aria-label="Content type"><For each={[['capital','Capital Ships'],['vessels','Light Ships & Platforms'],['weapons','Weapons']] as const}>{([id,label])=><button role="tab" aria-selected={contentTab()===id} onClick={()=>{setContentTab(id);setHovered(null);setSearch('');setFilter('all');}}>{label}</button>}</For></div>
        <div class="availability-legend"><For each={Object.entries(labels).filter(([key])=>key!=='choose'&&key!=='unknown')}>{([key,label])=><span><i class={`status-dot ${key}`}/>{label}</span>}</For></div>
        <Show when={contentTab()==='capital'}><div class="ship-focus"><label for="ship-focus">Ship</label><select id="ship-focus" value={focusedShip()} onChange={e=>{setFocusedShip(e.currentTarget.value);setHovered(null);setSearch('');setFilter('all');}}><option value="">All ships</option><For each={ships()}>{ship=><option value={ship.id}>{ship.name}</option>}</For></select></div><Show when={!compare()} fallback={<div class="pair-grid"><For each={pairs}>{pair=>{const pairState=createMemo(()=>({...state(),traits:pair}));return <article class="pair-card" classList={{active:pair.every(t=>state().traits.includes(t))}}><button class="pair-heading" onClick={()=>{update({traits:pair});setNotice('');}}>{pair.join(' + ')}<span>{items().filter(i=>i.kind==='system'&&(!focusedShip()||i.shipId===focusedShip())&&access(i,pairState()).status==='available').length}/{items().filter(i=>i.kind==='system'&&(!focusedShip()||i.shipId===focusedShip())).length} systems</span></button><For each={shownShips()}>{ship=><div class="mini-ship"><button {...hoverProps(ship,pair)} class={`mini-hull ${access(ship,pairState()).status}`} classList={{"upgrade-dependent":requiresHoveredUpgrade(ship)}}  onClick={()=>{update({traits:pair});inspectItem(ship);}}><span class="hull-name">{ship.name.replace(' Class ',' ')}</span><span class="hull-size">{sizeLabel(ship)}</span><TraitInitials item={ship}/></button><div class="mini-groups"><For each={slotGroups(sourceItems(),ship.id)}>{group=><div class="system-dots mini-slot" title={`${group.name}${group.count>1?` ×${group.count}`:''} · ${group.options.length} options`}><For each={group.options}>{item=><button {...hoverProps(item,pair)} class={`system-dot ${access(item,pairState()).status}`} classList={{"upgrade-dependent":requiresHoveredUpgrade(item)}}  aria-label={`${pair.join(' + ')} · ${ship.name} · ${item.name} · ${item.slot} · ${labels[access(item,pairState()).status]}`} onClick={()=>{update({traits:pair});inspectItem(item);}}>{access(item,pairState()).status==='unknown'?'?':''}</button>}</For></div>}</For></div></div>}</For><For each={focusedShip()?[]:['light','platform'] as const}>{kind=><div class="mini-ship"><span class="muted">{kind==='light'?'Light ships':'Platforms'}</span><div class="system-dots"><For each={items().filter(i=>i.kind===kind)}>{item=><button {...hoverProps(item,pair)} class={`system-dot ${access(item,pairState()).status}`} classList={{"upgrade-dependent":requiresHoveredUpgrade(item)}}  aria-label={`${pair.join(' + ')} · ${item.name} · ${labels[access(item,pairState()).status]}`} onClick={()=>{update({traits:pair});inspectItem(item);}}>{access(item,pairState()).status==='unknown'?'?':''}</button>}</For></div></div>}</For></article>;}}</For></div>}>
          <div class="filters"><input aria-label="Search content" placeholder="Find ship or system…" value={search()} onInput={e=>setSearch(e.currentTarget.value)}/><select aria-label="Filter access" value={filter()} onChange={e=>setFilter(e.currentTarget.value)}><option value="all">All states</option><For each={Object.entries(labels).filter(([key])=>key!=='unknown')}>{([id,name])=><option value={id}>{name}</option>}</For></select></div>
          <div class="ship-grid" classList={{focused:!!focusedShip()}}><For each={shownShips().filter(ship=>visible(ship)||items().some(i=>i.shipId===ship.id&&visible(i)))}>{ship=><article class="ship-card"><button {...hoverProps(ship)} class={`ship-title ${access(ship,state()).status}`} classList={{"upgrade-dependent":requiresHoveredUpgrade(ship)}}  onClick={()=>inspectItem(ship)}><span class="entry-name"><strong><span class="hull-name">{ship.name.replace(' Class ',' ')}</span><span class="hull-size">{sizeLabel(ship)}</span></strong><UpgradeNames item={ship}/></span><span>{labels[access(ship,state()).status]}</span><TraitInitials item={ship}/></button><div class="slot-groups"><For each={slotGroups(sourceItems(),ship.id).filter(g=>g.options.some(visible)||(!g.options.length&&!search()&&filter()==='all'))}>{group=><section class="slot-group"><div class="slot-heading" title={group.locations.join(' / ')}><strong>{group.name}{group.count>1?` ×${group.count}`:''}</strong><span classList={{sparse:group.options.length===1}}>{group.options.length} option{group.options.length===1?'':'s'}</span></div><div class="system-tiles"><Show when={!group.options.length}><small>Options to be defined</small></Show><For each={group.options.filter(visible)}>{i=><ItemButton item={i}/>}</For></div></section>}</For><Show when={!slotGroups(sourceItems(),ship.id).length}><small>{sourceItems().some(i=>i.shipId===ship.id)?'No matching systems':'Modular options not yet defined'}</small></Show></div></article>}</For></div>

        </Show>
        </Show>
        <Show when={contentTab()==='vessels'}><div class="category-grid" classList={{"weapons-grid":contentTab()==='weapons'}}><For each={contentTab()==='weapons'?weaponCategories:vesselCategories}>{category=><article class="category-card" classList={{unassigned:category.id==='unassigned'}}><h3>{category.name}<Show when={'proposed' in category && category.proposed}><small>proposed</small></Show><span>{items().filter(i=>(contentTab()==='weapons'?i.kind==='weapon':i.kind==='light'||i.kind==='platform')&&categoryFor(i,state())===category.id).length}</span></h3><div class="category-items"><For each={items().filter(i=>(contentTab()==='weapons'?i.kind==='weapon':i.kind==='light'||i.kind==='platform')&&categoryFor(i,state())===category.id)}>{item=><div class="catalog-row"><ItemButton item={item}/></div>}</For><Show when={!items().some(i=>(contentTab()==='weapons'?i.kind==='weapon':i.kind==='light'||i.kind==='platform')&&categoryFor(i,state())===category.id)}><small class="empty-category">No entries yet</small></Show></div></article>}</For></div></Show>
        <Show when={contentTab()==='weapons'}><div class="weapon-matrix-wrap"><table class="weapon-matrix" aria-label="Weapon families and advancement"><thead><tr><th scope="col">Family</th><For each={matrixLevels()}>{level=><th scope="col">{level.name}</th>}</For></tr></thead><tbody><For each={matrixFamilies()}>{family=><tr><th scope="row">{family.name}</th><For each={matrixLevels()}>{level=><td><For each={items().filter(i=>i.kind==='weapon'&&categoryFor(i,state())===family.id&&advancementFor(i,state())===level.id)}>{item=><ItemButton item={item}/>}</For><Show when={!items().some(i=>i.kind==='weapon'&&categoryFor(i,state())===family.id&&advancementFor(i,state())===level.id)}><span class="matrix-empty">—</span></Show></td>}</For></tr>}</For></tbody></table></div></Show>
        <Show when={authorMode()}><details class="concept-form"><summary>Add concept</summary><form onSubmit={addConcept}><input required maxlength={150} aria-label="Concept name" placeholder="Name" value={conceptName()} onInput={e=>setConceptName(e.currentTarget.value)}/><select aria-label="Concept type" value={conceptKind()} onChange={e=>{setConceptKind(e.currentTarget.value as Item['kind']);setConceptCategory('unassigned');}}><option value="light">Light ship</option><option value="platform">Platform</option><option value="ship">Capital ship</option><option value="system">System</option><option value="weapon">Weapon</option></select><Show when={['light','platform','weapon'].includes(conceptKind())}><select aria-label="Concept category" value={conceptCategory()} onChange={e=>setConceptCategory(e.currentTarget.value)}><For each={conceptKind()==='weapon'?weaponCategories:vesselCategories}>{c=><option value={c.id}>{c.name}</option>}</For></select></Show><Show when={conceptKind()==='system'}><select required aria-label="Concept hull" value={conceptShip()} onChange={e=>setConceptShip(e.currentTarget.value)}><option value="">Hull</option><For each={ships()}>{s=><option value={s.id}>{s.name}</option>}</For></select></Show><button type="submit">Add</button></form></details></Show>
      </section>
    </main>
    <Show when={hovered()}><div id="access-tooltip" role="tooltip" class="access-tooltip" style={{left:`${hovered()!.left}px`,top:`${hovered()!.top}px`}}><strong>{hovered()!.item.name}{sizeLabel(hovered()!.item)}</strong><p>{hovered()!.item.kind==='system'&&hoverAccess()?.status==='available'?'System requirements met. Hull access is checked separately.':hoverAccess()?.reason}</p><Show when={hovered()!.item.slot}><small>{hovered()!.item.slot}</small></Show><Show when={hullMetadata[hovered()!.item.id]?.note}><small>{hullMetadata[hovered()!.item.id].note}</small></Show></div></Show>
    <Show when={editing()}>{item=><div class="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setEditing(null);}}><section class="item-editor" role="dialog" aria-modal="true" aria-label="Content requirements" onKeyDown={e=>{if(e.key==='Escape')setEditing(null);if(e.key==='Tab'){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea')).filter(el=>!el.hasAttribute('disabled'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><button class="close" autofocus onClick={()=>setEditing(null)} aria-label="Close requirements">×</button><div class="eyebrow">{authorMode()?'EDIT REQUIREMENTS':'ACCESS DETAILS'}</div><h2>{item().name}</h2><p>{item().slot ?? item().kind}{sizeLabel(item())}</p><Show when={hullMetadata[item().id]?.note}><p class="muted">{hullMetadata[item().id].note}</p></Show><p class="muted">{item().description}</p><div class={`access-reason ${access(item(),state()).status}`}><strong>{labels[access(item(),state()).status]}</strong><p>{access(item(),state()).reason}</p></div>
      <Show when={authorMode()}><Show when={['weapon','light','platform'].includes(item().kind)}><label>{item().kind==='weapon'?'Family':'Category'}<select aria-label="Item category" value={categoryFor(item(),state())} onChange={e=>update({categories:{...state().categories,[item().id]:e.currentTarget.value}})}><For each={item().kind==='weapon'?weaponCategories:vesselCategories}>{c=><option value={c.id}>{c.name}</option>}</For></select></label></Show><Show when={item().kind==='weapon'}><label>Advancement<select aria-label="Weapon advancement" value={advancementFor(item(),state())} onChange={e=>update({advancements:{...state().advancements,[item().id]:e.currentTarget.value as 'base'|'advanced'|'cutting-edge'|'unassigned'}})}><For each={advancementLevels}>{level=><option value={level.id}>{level.name}</option>}</For></select></label></Show><Show when={sharedWeapon(item())}><p class="muted">Weapon requirements are shared across all ships using this design; hull requirements still apply.</p></Show><p class="muted">No listed conditions means unrestricted. Systems also inherit their hull's requirements.</p>
      <h3>Any one of these traits</h3><div class="trait-buttons"><For each={TRAITS}>{t=><button aria-pressed={req().traits.includes(t)} classList={{chosen:req().traits.includes(t)}} onClick={()=>saveRequirement({traits:req().traits.includes(t)?req().traits.filter(v=>v!==t):[...req().traits,t]})}>{t}</button>}</For></div><small class="muted">None selected = no trait restriction.</small>
      <h3>All of these Charter upgrades</h3><div class="requirement-grid"><For each={upgrades.filter(u=>u.id!=='basic')}>{u=><label class="check"><input type="checkbox" checked={req().upgrades.includes(u.id)} onChange={e=>saveRequirement({upgrades:e.currentTarget.checked?[...req().upgrades,u.id]:req().upgrades.filter(id=>id!==u.id)})}/>{u.name}</label>}</For></div>
      <Show when={req().defined && editPath() && editPath()!.cost>0}><p class="path-note">Minimum additional Charter spend: {editPath()!.cost} cr{editPath()!.cost>remaining() ? ' · over current budget' : ''}. This does not bypass trait or reputation requirements.</p></Show>
      <label>Reputation requirement (manual check)<input maxlength={500} placeholder="Leave blank if none" value={req().reputation} onInput={e=>saveRequirement({reputation:e.currentTarget.value})}/></label></Show><div class="editor-footer"><small>{authorMode()?'Changes apply to every matching slot on this ship.':'Access includes this item and its hull.'}</small><button class="primary" onClick={()=>setEditing(null)}>Done</button></div>
    </section></div>}</Show>
  </div>;
}
