import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { dataURL, loadAssets, type Assets } from './assets';
import { colorPalette, defaultParameters, designSchema, dimensions, formats, layouts, newDesign, printPalette, traits, type Design, type Layout, type Palette } from './model';
import { renderCard, type Measure } from './render';

const STORAGE = 'overdrive-layout-studio-guild-preset-v1';
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Studio() {
  const [design, setDesign] = createStore<Design>(newDesign());
  const [assets, setAssets] = createSignal<Assets>();
  const [message, setMessage] = createSignal('Loading local fonts and symbols…');
  const [storageStatus, setStorageStatus] = createSignal('Local draft');
  const [ready, setReady] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [zoom, setZoom] = createSignal(100);
  const [guides, setGuides] = createSignal(false);
  const [bleed, setBleed] = createSignal(false);
  const [background, setBackground] = createSignal('dark');
  let importInput!: HTMLInputElement;
  let imageInput!: HTMLInputElement;
  const context = document.createElement('canvas').getContext('2d')!;
  const measure: Measure = (text, size, heading, weight) => { context.font = `${weight} ${size}px ${heading ? 'StudioHeading' : 'StudioBody'}`; return context.measureText(text).width; };
  measure.ink = (text, size, weight = 700) => {
    context.font = `${weight} ${size}px StudioHeading`;
    const metrics = context.measureText(text);
    return { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent, width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight };
  };
  measure.bodyInk = (text, size, weight = 400) => {
    // Measure large outlines and scale down: tiny canvas fonts round their ink
    // bounds to pixels, which shifts the apparent center of inline rail text.
    const metricSize = 1000;
    context.font = `${weight} ${metricSize}px StudioBody`;
    const metrics = context.measureText(text);
    return { ascent: metrics.actualBoundingBoxAscent * size / metricSize, descent: metrics.actualBoundingBoxDescent * size / metricSize };
  };
  const preview = createMemo(() => assets() ? renderCard(design, assets()!, measure, 'card', bleed()) : undefined);
  const dim = () => dimensions(design);
  const content = () => design.content[design.layout];
  const bodyLineSpacing = () => design.parameters.bodyLineSpacings[design.layout] ?? (design.layout === 'overdrive' ? 0 : design.parameters.lineSpacing);
  const bodyWeight = () => design.parameters.bodyWeights[design.layout] ?? design.parameters.weight;
  const palette = () => design.palettes[design.mode];
  const filename = () => (content().title || design.layout).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'overdrive';
  onMount(async () => {
    let restored = false;
    let savedDraft: { bundledArtwork?: Partial<Record<Layout, string>>; objectiveArtworkInitialized?: boolean; overdriveArtworkInitialized?: boolean } = {};
    try { const saved = localStorage.getItem(STORAGE); if (saved) { savedDraft = JSON.parse(saved); setDesign(reconcile(designSchema.parse(savedDraft))); restored = true; } }
    catch { setStorageStatus('Saved draft unavailable'); }
    for (const [key, placeholder] of Object.entries({ inlineLeft: 'RPA // VERIFIED', inlineDivider: 'OVERDRIVE // FIELD RECORD', inlineRight: 'VESSEL // REGISTERED' })) {
      const field = key as 'inlineLeft' | 'inlineDivider' | 'inlineRight';
      if (design.content.objective[field] === placeholder) setDesign('content', 'objective', field, newDesign().content.objective[field]);
      if (design.content.overdrive[field] === placeholder) setDesign('content', 'overdrive', field, newDesign().content.character[field]);
    }
    if (design.content.objective.title === 'OBJECTIVE' && design.content.objective.subtitle === 'NUMBER_01' && design.content.objective.body === 'Write your objective here.\n\nAdd the conditions for completing it and the reward.') {
      const objective = newDesign().content.objective;
      setDesign('content', 'objective', { title: objective.title, subtitle: objective.subtitle, body: objective.body });
    }
    if (design.content.objective.title === 'Fighting Ace' && design.content.objective.body.startsWith('Activates as a Fast Light Ship.')) {
      const object = newDesign().content.objective;
      setDesign('content', 'objective', { title: object.title, body: object.body });
      if (design.parameters.bodySize === 24) setDesign('parameters', 'bodySize', 30);
    }
    if (design.content.objective.title === 'MINE' && design.content.objective.body.replace(/\s+/g, ' ').trim() === 'The Mine detonates if any Capital Ship ends a movement within 1 DU from it: remove the Mine and deal an Attack 4 to any vessel within 1 DU from the Mine; then, detonate any other Mine within 2 DU from the detonating mine.') setDesign('content', 'objective', 'body', newDesign().content.objective.body);
    if (design.content.overdrive.title === 'OVERDRIVE' && design.content.overdrive.subtitle === 'MANOEUVRE') setDesign('content', 'overdrive', { title: 'AMBUSH', subtitle: 'OVERDRIVE CARD', traits: ['Military'] });
    if (['MANOEUVRE', 'OVERDRIVE CARD'].includes(design.content.overdrive.subtitle.toUpperCase())) setDesign('content', 'overdrive', 'subtitle', 'OVERDRIVE');
    if (design.content.overdrive.heading === 'PUSH THE LIMIT') setDesign('content', 'overdrive', 'heading', 'APPROACH');
    if (design.content.overdrive.body === 'Write the card effect here.\n\nAdd timing, costs and any restrictions.') setDesign('content', 'overdrive', 'body', newDesign().content.overdrive.body);
    const approachBody = newDesign().content.overdrive.body;
    if (design.content.overdrive.body.replace('a round of Approach if', 'a round if').replace('Increase your alert by two;', 'Increase your alert by 2;').replace(/\n+/g, '\n\n') === approachBody) setDesign('content', 'overdrive', 'body', approachBody);
    if (design.content.overdrive.body === approachBody.replace('\n\n', '\n')) setDesign('content', 'overdrive', 'body', approachBody);
    const mineBody = newDesign().content.objective.body;
    if (design.content.objective.body === mineBody.replace('from it.\n\n', 'from it\n\n')) {
      setDesign('content', 'objective', 'body', mineBody);
      if (design.parameters.bodySize === 24 || design.parameters.bodySize === 30) setDesign('parameters', 'bodySize', 36);
    }
    if (design.content.objective.body.replace(/\s+/g, ' ').trim() === mineBody) setDesign('content', 'objective', 'body', mineBody);
    try {
      const loaded = await loadAssets();
      if (!restored) setDesign('content', 'character', 'artwork', loaded.defaultArtwork || '');
      for (const layout of layouts) {
        const reference = savedDraft.bundledArtwork?.[layout];
        if (reference === 'gunship') setDesign('content', layout, 'artwork', loaded.defaultArtwork || '');
        if (reference === 'ambush') setDesign('content', layout, 'artwork', loaded.defaultOverdriveArtwork || '');
        if (reference === 'minefield') setDesign('content', layout, 'artwork', loaded.defaultObjectiveArtwork || '');
      }
      if (!savedDraft.objectiveArtworkInitialized && !design.content.objective.artwork) setDesign('content', 'objective', 'artwork', loaded.defaultObjectiveArtwork || '');
      if (!savedDraft.overdriveArtworkInitialized && !design.content.overdrive.artwork) setDesign('content', 'overdrive', { artwork: loaded.defaultOverdriveArtwork || '', imageHorizontal: 'right' });
      setAssets(loaded); setMessage('');
    }
    catch (error) { setMessage(String(error)); }
    setReady(true);
  });
  createEffect(() => {
    const snapshot = JSON.parse(JSON.stringify(design));
    if (!ready()) return;
    snapshot.objectiveArtworkInitialized = true;
    snapshot.overdriveArtworkInitialized = true;
    snapshot.bundledArtwork = {};
    for (const layout of layouts) {
      const artwork = snapshot.content[layout].artwork;
      const reference = artwork && artwork === assets()?.defaultArtwork ? 'gunship' : artwork && artwork === assets()?.defaultObjectiveArtwork ? 'minefield' : artwork && artwork === assets()?.defaultOverdriveArtwork ? 'ambush' : undefined;
      if (reference) { snapshot.content[layout].artwork = ''; snapshot.bundledArtwork[layout] = reference; }
    }
    const serialized = JSON.stringify(snapshot);
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE, serialized); setStorageStatus('Saved on this device'); }
      catch { setStorageStatus('Draft not saved — export JSON to keep it'); }
    }, 250);
    // Each write contains a complete snapshot; timers are replaced on the next edit.
    onCleanup(() => clearTimeout(timer));
  });
  function selectLayout(layout: Layout) {
    setDesign('layout', layout);
    if (layout !== 'open') setDesign('orientation', layout === 'overdrive' ? 'portrait' : 'landscape');
  }
  async function importDesign(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64000000) throw new Error('Design file exceeds 64 MB.');
      const next = designSchema.parse(JSON.parse(await file.text()));
      setDesign(reconcile(next)); setMessage('Design imported');
    } catch { setMessage('Could not import this design. Use a Layout Studio v1 JSON file (maximum 64 MB).'); }
    importInput.value = '';
  }
  async function uploadArtwork(file?: File) {
    if (!file) return;
    const layout = design.layout;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8000000) throw new Error('Choose a PNG, JPEG or WebP image under 8 MB.');
      const url = await dataURL(file);
      const img = new Image(); img.src = url; await img.decode();
      setDesign('content', layout, 'artwork', url); setMessage('Artwork added');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load artwork.'); }
    imageInput.value = '';
  }
  async function exportPNG(dpi: 300 | 600) {
    const card = preview(); if (!card) return;
    setBusy(true);
    const url = URL.createObjectURL(new Blob([card.svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = Math.round(card.width / 25.4 * dpi); canvas.height = Math.round(card.height / 25.4 * dpi);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed.')), 'image/png'));
      download(blob, `${filename()}-${dpi}dpi.png`); setMessage(`PNG exported · ${canvas.width} × ${canvas.height} px`);
    } catch { setMessage('PNG export failed. Try SVG export instead.'); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  }
  const field = (key: 'title' | 'subtitle' | 'heading' | 'code' | 'footer' | 'topDecoration' | 'inlineLeft' | 'inlineDivider' | 'inlineRight' | 'points', name: string) => <label>{name}<input value={content()[key]} maxLength={key === 'points' ? 20 : key === 'code' ? 100 : 200} onInput={e => setDesign('content', design.layout, key, e.currentTarget.value)} /></label>;
  const range = (key: 'line' | 'inset' | 'cross' | 'crossGap' | 'titleInset' | 'titleGap' | 'titleOffset' | 'symbolWidth' | 'symbolUprightExtra' | 'rightDecorationWidth' | 'overdriveDecorationWidth' | 'traitSize' | 'traitSpacing' | 'symbolHeight' | 'symbolX' | 'symbolY' | 'symbolGap' | 'titleSpacing' | 'titleWeight' | 'titleSize' | 'barThickness' | 'subtitleSize' | 'subtitleWeight' | 'bodySize' | 'lineSpacing' | 'effectHeadingSize' | 'effectHeadingGap' | 'leading' | 'artShare' | 'overdriveArtShare' | 'objectiveArtShare' | 'textFrameMargin' | 'imageMargin' | 'decorationTextSize' | 'decorationTextWeight' | 'leftDecorationWidth', name: string, min: number, max: number, step = 1, suffix = '') => <label class="range-label"><span>{name}<output>{design.parameters[key]}{suffix}</output></span><input aria-label={name} type="range" min={min} max={max} step={step} value={design.parameters[key]} onInput={e => setDesign('parameters', key, +e.currentTarget.value)} /></label>;
  return <div class="studio">

    <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e => void importDesign(e.currentTarget.files?.[0])} />
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => void uploadArtwork(e.currentTarget.files?.[0])} />
    <div class="workspace"><aside class="controls" aria-label="Design controls">
      <div class="file-actions"><button onClick={() => importInput.click()}>Open design</button><button onClick={() => { download(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }), `${filename()}.json`); setMessage('Design saved as JSON'); }}>Save design <span>↗</span></button></div>
      <details><summary>Format<span class="chevron">⌄</span></summary><div class="detail-content"><label><select aria-label="Format" value={design.format} onChange={e => setDesign('format', e.currentTarget.value as Design['format'])}><For each={Object.entries(formats)}>{([id, f]) => <option value={id}>{f.name}{id !== 'custom' ? ` · ${f.width} × ${f.height} mm` : ''}</option>}</For></select></label>
        <Show when={design.format === 'custom'}><div class="field-pair"><label>Short side / mm<input type="number" min="30" max="420" value={design.customWidth} onChange={e => setDesign('customWidth', Math.min(420, Math.max(30, +e.currentTarget.value || 63)))} /></label><label>Long side / mm<input type="number" min="30" max="420" value={design.customHeight} onChange={e => setDesign('customHeight', Math.min(420, Math.max(30, +e.currentTarget.value || 88)))} /></label></div><label class="check"><input type="checkbox" checked={design.customRounded} onChange={e => setDesign('customRounded', e.currentTarget.checked)} />Rounded corners</label></Show>
        <div class="segmented" aria-label="Orientation"><For each={['landscape', 'portrait'] as const}>{value => <button aria-pressed={design.orientation === value} onClick={() => setDesign('orientation', value)}>{value === 'landscape' ? '▭' : '▯'} {value}</button>}</For></div>
      <div class="segmented"><button aria-pressed={design.mode === 'color'} onClick={() => setDesign('mode', 'color')}>Full color</button><button aria-pressed={design.mode === 'print'} onClick={() => setDesign('mode', 'print')}>Printer-friendly</button></div>
        <div class="swatches"><For each={Object.entries({ background: 'Background', dark: 'Dark detail', light: 'Light detail', text: 'Text', accent: 'Accent' })}>{([key, label]) => <label title={`${label}: ${palette()[key as keyof Palette]}`}><input aria-label={label + ' color'} type="color" value={palette()[key as keyof Palette]} onInput={e => setDesign('palettes', design.mode, key as keyof Palette, e.currentTarget.value)} /><span>{label}</span></label>}</For></div>
        <button class="text-button" onClick={() => setDesign('palettes', design.mode, { ...(design.mode === 'color' ? colorPalette : printPalette) })}>Reset palette ↺</button>
      <div class="layout-grid"><For each={layouts}>{layout => <button aria-pressed={design.layout === layout} onClick={() => selectLayout(layout)}><span class={`layout-icon ${layout}`}><i/><b/></span><span>{layout === 'objective' ? 'object' : layout}</span></button>}</For></div></div></details>
      <Show when={design.layout !== 'open'}><details><summary>Content<span class="chevron">⌄</span></summary><div class="detail-content"><Show when={design.layout === 'character' || design.layout === 'overdrive'}><fieldset><legend>Charter traits <span>{design.layout === 'overdrive' ? 'select one' : 'select any'}</span></legend><div class="trait-buttons"><For each={traits}>{trait => <button aria-label={trait} title={trait} aria-pressed={content().traits.includes(trait)} onClick={() => setDesign('content', design.layout, 'traits', list => design.layout === 'overdrive' ? [trait] : list.includes(trait) ? list.filter(t => t !== trait) : [...list, trait])}><Show when={assets()}><img src={assets()!.icons[trait]} alt="" /></Show><span>{trait}</span></button>}</For></div></fieldset></Show>{field('title', 'Title')}<div class="field-pair">{field('subtitle', 'Category / subtitle')}{field('code', 'Card ID')}</div>

        <Show when={design.layout === 'objective'}><label>Shield value<select value={content().points} onChange={e => setDesign('content', 'objective', 'points', e.currentTarget.value)}><For each={['1', '2', '3', '4', '5', '6', '7', '8', '9']}>{value => <option value={value}>{value}</option>}</For></select></label></Show>
        {field('heading', 'Effect heading')}<label>Body text<textarea rows="5" maxLength="12000" value={content().body} onInput={e => setDesign('content', design.layout, 'body', e.currentTarget.value)} /></label>

      </div></details></Show>
      <details><summary>Style <span class="chevron">⌄</span></summary><div class="detail-content">
      <Show when={design.layout !== 'open'}><details class="subsection"><summary>Image frame<span class="chevron">⌄</span></summary><div class="subsection-content">
        {range('imageMargin', 'Image margin', 0, 40)}<Show when={design.layout === 'objective'}><label class="check"><input type="checkbox" checked={design.parameters.objectProtrusion} onChange={e => setDesign('parameters', 'objectProtrusion', e.currentTarget.checked)} />Diagonal protrusion</label></Show><Show when={design.layout !== 'objective'}>{range(design.layout === 'overdrive' ? 'overdriveArtShare' : 'artShare', 'Artwork share', 30, 72, 1, '%')}</Show>
        <div class="art-controls"><button onClick={() => imageInput.click()}>{content().artwork ? 'Replace artwork' : '+ Add artwork'}</button><Show when={content().artwork}><button class="text-button" onClick={() => setDesign('content', design.layout, 'artwork', '')}>Remove</button><label>Horizontal alignment<select value={content().imageHorizontal} onChange={e => setDesign('content', design.layout, 'imageHorizontal', e.currentTarget.value as 'left' | 'center' | 'right')}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Image alignment<select value={content().imagePosition} onChange={e => setDesign('content', design.layout, 'imagePosition', +e.currentTarget.value)}><option value="0">Top</option><option value="50">Center</option><option value="100">Bottom</option></select></label></Show></div>
      </div></details></Show>

        <Show when={design.layout === 'character' || design.layout === 'overdrive'}><details class="subsection"><summary>Traits<span class="chevron">⌄</span></summary><div class="subsection-content">        {range('traitSize', 'Trait size', 16, 80)}{range('traitSpacing', 'Trait spacing', 0, 40)}<label class="check"><input type="checkbox" checked={design.parameters.traitsBarcode} onChange={e => setDesign('parameters', 'traitsBarcode', e.currentTarget.checked)} />Barcode above traits</label></div></details></Show>
        <Show when={design.layout !== 'open'}><details class="subsection"><summary>Decoration<span class="chevron">⌄</span></summary><div class="subsection-content">
          {range('decorationTextSize', 'Mini text size', 2, 6, 0.5)}{range('decorationTextWeight', 'Mini text weight', 400, 700, 100)}{field('topDecoration', 'Top decoration text')}<label class="check"><input type="checkbox" checked={design.parameters.topBarcode} onChange={e => setDesign('parameters', 'topBarcode', e.currentTarget.checked)} />Top barcode (42)</label>{field('inlineLeft', 'Inline text · left rail')}{field('inlineDivider', design.layout === 'objective' ? 'Inline text · bottom rail' : 'Inline text · image divider')}{field('inlineRight', 'Inline text · right rail')}{field('footer', 'Bottom decoration text')}<Show when={design.layout !== 'objective'}><label class="check"><input type="checkbox" checked={design.parameters.bottomBarcode} onChange={e => setDesign('parameters', 'bottomBarcode', e.currentTarget.checked)} />Bottom barcode (08)</label></Show><Show when={design.layout === 'objective'}><label class="check"><input type="checkbox" checked={design.parameters.shieldBarcode} onChange={e => setDesign('parameters', 'shieldBarcode', e.currentTarget.checked)} />Shield barcode</label></Show>
          {range('leftDecorationWidth', 'Left decoration width', 24, 120)}<label class="check"><input type="checkbox" checked={design.parameters.hideFrameAbove} onChange={e => setDesign('parameters', 'hideFrameAbove', e.currentTarget.checked)} />Hide frame above</label><label>Left decoration text<textarea rows="6" maxLength="12000" value={content().leftDecoration} onInput={e => setDesign('content', design.layout, 'leftDecoration', e.currentTarget.value)} /></label>
          <Show when={design.layout === 'character' || design.layout === 'overdrive'}><label class="check"><input type="checkbox" checked={design.parameters.barcode} onChange={e => setDesign('parameters', 'barcode', e.currentTarget.checked)} />RPA logo, hash and barcode</label>{range(design.layout === 'overdrive' ? 'overdriveDecorationWidth' : 'rightDecorationWidth', 'Right decoration width', 80, 240)}<label>Right decoration text<textarea rows="5" maxLength="12000" value={content().rightDecoration} onInput={e => setDesign('content', design.layout, 'rightDecoration', e.currentTarget.value)} /></label></Show>
        </div></details></Show>
        <details class="subsection"><summary>Frame<span class="chevron">⌄</span></summary><div class="subsection-content">
          {range('line', 'Line thickness', 0.5, 5, 0.5)}{range('inset', 'Frame inset', 24, 65)}{range('cross', 'Cross size', 4, 22)}{range('crossGap', 'Cross spacing', 0, 24)}<Show when={design.layout !== 'open'}><label class="check"><input type="checkbox" checked={design.parameters.topLeftContinuation} onChange={e => setDesign('parameters', 'topLeftContinuation', e.currentTarget.checked)} />Top-left line continuation</label></Show>
        </div></details>
        <Show when={design.layout !== 'open'}><details class="subsection"><summary>Title<span class="chevron">⌄</span></summary><div class="subsection-content">
          {range('titleSize', 'Title size', 24, 64)}{range('titleInset', 'Title inset', 0, 150)}{range('titleSpacing', 'Title letter spacing', 0, 12, 0.25)}{range('titleWeight', 'Title weight', 400, 900, 10)}
          {range('titleGap', 'Title gap from L', 0, 80)}{range('symbolWidth', 'L band thickness', 20, 120)}{range('symbolUprightExtra', 'L upright extra thickness', 0, 80)}{range('barThickness', 'Diagonal bar thickness', 1, 24, 0.5)}{range('subtitleSize', 'Subtitle size', 10, 48)}{range('subtitleWeight', 'Subtitle weight', 400, 900, 10)}
        </div></details></Show>
        <Show when={design.layout !== 'open'}><details class="subsection"><summary>Body<span class="chevron">⌄</span></summary><div class="subsection-content"><Show when={design.layout === 'objective'}>{range('textFrameMargin', 'Text frame margin', 0, 50)}<label>Text frame color<input type="color" value={design.parameters.textFrameColor === 'background' ? palette().background : design.parameters.textFrameColor || palette().accent} onInput={e => setDesign('parameters', 'textFrameColor', e.currentTarget.value)} /></label><div class="field-pair"><button onClick={() => setDesign('parameters', 'textFrameColor', '')}>Use accent color</button><button onClick={() => setDesign('parameters', 'textFrameColor', 'background')}>Use background color</button></div></Show>{range('bodySize', 'Body size', 16, 44)}<label class="range-label"><span>Line spacing<output>{bodyLineSpacing()}</output></span><input aria-label="Line spacing" type="range" min="-24" max="40" step="1" value={bodyLineSpacing()} onInput={e => setDesign('parameters', 'bodyLineSpacings', design.layout, +e.currentTarget.value)} /></label><Show when={content().heading}>{range('effectHeadingSize', 'Effect heading size', 12, 64)}{range('effectHeadingGap', 'Space below effect heading', -24, 64)}</Show><label class="range-label"><span>Body weight<output>{bodyWeight() === 400 ? 'Regular' : bodyWeight() === 600 ? 'Semibold' : 'Bold'}</output></span><input aria-label="Body weight" aria-valuetext={bodyWeight() === 400 ? 'Regular' : bodyWeight() === 600 ? 'Semibold' : 'Bold'} type="range" min="0" max="2" step="1" value={[400, 600, 700].indexOf(bodyWeight())} onInput={e => setDesign('parameters', 'bodyWeights', design.layout, ([400, 600, 700] as const)[+e.currentTarget.value])} /></label></div></details></Show>
        <button class="text-button" onClick={() => setDesign('parameters', { ...defaultParameters })}>Reset parameters ↺</button>
      </div></details><div class="sidebar-footer">{storageStatus()}</div>
    </aside>
    <main class={`preview-pane ${background()}`}><div class="preview-toolbar"><span>{dim().width} × {dim().height} mm</span><div class="preview-options"><label><input type="checkbox" checked={bleed()} onChange={e => setBleed(e.currentTarget.checked)} />Bleed area</label><label><input type="checkbox" checked={guides()} onChange={e => setGuides(e.currentTarget.checked)} />Safe area</label><button aria-label="Toggle preview background" title="Toggle preview background" onClick={() => setBackground(background() === 'dark' ? 'light' : 'dark')}>◐</button></div></div>
      <div class="preview-stage"><div class="card-shell" style={{ width: `${zoom()}%`, 'max-width': 'min(' + (1040 * zoom() / 100) + 'px, calc(max(300px, 100dvh - 250px) * ' + ((dim().width + (bleed() ? 10 : 0)) / (dim().height + (bleed() ? 10 : 0)) * zoom() / 100) + '))', 'aspect-ratio': `${dim().width + (bleed() ? 10 : 0)} / ${dim().height + (bleed() ? 10 : 0)}` }}><Show when={preview()} fallback={<div class="loading">{message()}</div>}><div class="card-preview" innerHTML={preview()!.svg}/><Show when={bleed()}><div class="cut-guide" style={{ inset: `${5 / (dim().height + 10) * 100}% ${5 / (dim().width + 10) * 100}%`, "border-radius": dim().rounded ? `${3 / dim().width * 100}% / ${3 / dim().height * 100}%` : "0" }}><span>Cut edge · 5 mm bleed</span></div></Show><Show when={guides()}><div class="safe-guide" style={{ inset: `${(bleed() ? 8 : 3) / (dim().height + (bleed() ? 10 : 0)) * 100}% ${(bleed() ? 8 : 3) / (dim().width + (bleed() ? 10 : 0)) * 100}%` }}><span>3 mm safe area</span></div></Show></Show></div></div>
      <div class="preview-bottom"><Show when={preview()?.warnings.length}><div class="warnings" role="alert"><For each={preview()?.warnings}>{warning => <p>⚠ {warning}</p>}</For></div></Show><div class="bottom-controls"><label class="zoom-control">Zoom<input type="range" min="40" max="200" value={zoom()} onInput={e => setZoom(+e.currentTarget.value)} /><output>{zoom()}%</output></label><span class="scale-note">Export: {dim().width + (bleed() ? 10 : 0)} × {dim().height + (bleed() ? 10 : 0)} mm{bleed() ? " · 5 mm bleed" : ""}</span></div><div class="export-bar"><Show when={message()}><p role="status">{message()}</p></Show><div><button disabled={!preview()} onClick={() => { download(new Blob([preview()!.svg], { type: 'image/svg+xml' }), `${filename()}.svg`); setMessage('Self-contained SVG exported'); }}>Export SVG ↗</button><button disabled={!preview() || busy()} onClick={() => void exportPNG(300)}>{busy() ? 'Exporting…' : 'PNG · 300 DPI'}</button><button disabled={!preview() || busy()} onClick={() => void exportPNG(600)}>{busy() ? 'Exporting…' : 'PNG · 600 DPI'}</button><button class="primary" disabled={!preview()} onClick={() => window.print()}>Print / PDF</button></div></div></div>
    </main></div><div class="print-output" innerHTML={assets() ? renderCard(design, assets()!, measure, 'print', bleed()).svg : ''}/><style>{`@media print { @page { size: ${dim().width + (bleed() ? 10 : 0)}mm ${dim().height + (bleed() ? 10 : 0)}mm; margin: 0; } }`}</style>
  </div>;
}
