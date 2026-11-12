import referenceDesign from './fixtures/studio-reference.json';
import preset from '../src/studio/preset';
import assert from 'node:assert/strict';
import { designSchema, dimensions, formats, layouts, newDesign as presetDesign, defaultParameters } from '../src/studio/model';
import { renderCard, wrapText, titleFingerprint, type Measure } from '../src/studio/render';

// Keep geometry regressions on a fixed reference while product defaults can change.
const newDesign = () => designSchema.parse(referenceDesign);
const measure: Measure = (text, size) => [...text].length * size * 0.5;
const assets = { icons: {}, css: '' };
const d = newDesign();
assert.deepEqual(dimensions(d), { width: 88, height: 63, rounded: true });
d.orientation = 'portrait';
assert.deepEqual(dimensions(d), { width: 63, height: 88, rounded: true });
assert.deepEqual(designSchema.parse(JSON.parse(JSON.stringify(d))), d);
for (const layout of layouts) for (const format of Object.keys(formats) as Array<keyof typeof formats>) for (const mode of ['color', 'print'] as const) {
  const card = renderCard({ ...d, layout, format, mode }, assets, measure);
  assert.ok(!/NaN|Infinity/.test(card.svg), `${layout}/${format}/${mode} must have finite geometry`);
  if (format === 'a4' || format === 'a5') assert.ok(card.svg.includes('rx="0"'));
  if (layout === 'open') assert.ok(!card.svg.includes('<text'), 'Open must have no printed text');
}
d.content.character.title = '<script>alert("test")</script> &';
assert.ok(!renderCard(d, assets, measure).svg.includes('<script>'));
assert.ok(renderCard(d, assets, measure).svg.includes('&lt;SCRIPT&gt;'));
d.content.character.body = Array(200).fill('An overflowing paragraph').join('\n');
assert.ok(renderCard(d, assets, measure).warnings.some(w => w.includes('exceeds')));
const lines = wrapText('first paragraph\n\nSupercalifragilisticexpialidocious', 60, 20, 400, measure);
assert.ok(lines.includes(''), 'Explicit blank paragraph must be retained');
assert.ok(lines.every(l => measure(l.trimEnd(), 20, false, 400) <= 60), 'Long words must stay inside the box');
assert.equal(lines.join('').replace(/\s/g, ''), 'firstparagraphSupercalifragilisticexpialidocious');
assert.equal(designSchema.safeParse({ ...d, customWidth: 0 }).success, false);
assert.equal(designSchema.safeParse({ ...d, palettes: { ...d.palettes, color: { ...d.palettes.color, text: 'red" onload="bad' } } }).success, false);
assert.equal(designSchema.safeParse({ ...d, content: { ...d.content, character: { ...d.content.character, artwork: 'data:image/svg+xml,<svg onload="bad" />' } } }).success, false);
const print = renderCard(d, assets, measure, 'print');
assert.ok(print.svg.includes('id="print-outline"') && !print.svg.includes('id="card-outline"'), 'Print SVG IDs must not collide with preview');
const landscape = newDesign();
const withBleed = renderCard(landscape, assets, measure, 'bleed', true);
assert.equal(withBleed.width, 98);
assert.equal(withBleed.height, 73);
assert.ok(withBleed.svg.includes('rx="0"'), 'Bleed extends into square outside corners');
const cut = renderCard(landscape, assets, measure);
assert.ok(cut.svg.includes(`rx="${3 / 88 * 1000}"`), 'Trim corners are fixed at 3 mm');
landscape.parameters.inset = 50;
landscape.parameters.titleInset = 20;
const moved = renderCard(landscape, assets, measure);
assert.ok(moved.svg.includes('M50 0L50'), 'Side frame follows inset');
assert.ok(moved.svg.includes('M102 70L1000 70'), 'Top frame follows inset plus title inset');
const legacy = { ...newDesign(), parameters: { ...newDesign().parameters, radius: 7, spacing: 20, density: 5 } };
delete (legacy.parameters as Partial<typeof legacy.parameters>).titleInset;
delete (legacy.parameters as Partial<typeof legacy.parameters>).crossGap;
const migrated = designSchema.parse(legacy);
assert.equal(migrated.parameters.titleInset, 70);
assert.equal(migrated.parameters.crossGap, 3);
assert.ok(!('radius' in migrated.parameters), 'Old corner/bar settings must not override new fixed geometry');
console.log('Studio checks passed: 48 layout/format/palette combinations, physical sizing, text overflow/wrapping, draft round-trip and input validation.');

const headerDesign = newDesign();
const headerCard = renderCard(headerDesign, assets, measure);
const titleMatch = headerCard.svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>GUILD ATTACHÉ<\/text>/);
assert.ok(titleMatch);
assert.ok(Number(titleMatch[2]) < headerDesign.parameters.inset + headerDesign.parameters.titleInset - headerDesign.parameters.cross);
assert.equal(Number(titleMatch[1]), 38 + 52 + 16);
assert.equal(designSchema.safeParse({ ...headerDesign, parameters: { ...headerDesign.parameters, titleInset: 150 } }).success, true);
assert.equal(designSchema.safeParse({ ...headerDesign, symbolImage: 'javascript:bad' }).success, false);

for (const layout of ['character', 'overdrive'] as const) {
  const dividerDesign = { ...newDesign(), layout };
  const divider = renderCard(dividerDesign, assets, measure, 'divider', true).svg.match(/<g data-frame-divider="true">(.*?)<\/g>/)![1];
  const bleedUnits = 5 / 88 * 1000;
  assert.ok(divider.includes(`d="M${-bleedUnits} `), 'Divider starts at outer bleed edge');
  assert.ok(divider.includes(`L${1000 + bleedUnits} `), 'Divider ends at outer bleed edge');
  assert.equal((divider.match(/<path /g) || []).length, 5, 'Divider plus two complete crosses');
  assert.equal((divider.match(/<rect /g) || []).length, 0, 'Cross clearance must not erase a square of artwork');
  dividerDesign.parameters.artShare = 40;
  const shifted = renderCard(dividerDesign, assets, measure, 'divider', true).svg.match(/<g data-frame-divider="true">(.*?)<\/g>/)![1];
  assert.notEqual(shifted, divider, 'Artwork share moves the divider and its crosses together');
}
assert.ok(!renderCard({ ...newDesign(), layout: 'objective' }, assets, measure).svg.includes('data-frame-divider'), 'Objective has no horizontal image/effect divider');

assert.equal((headerCard.svg.match(/data-symbol-cut=/g) || []).length, 3, 'L contains exactly three diagonal cutouts');
const metricMeasure: Measure = Object.assign(measure, { ink: (text: string, size: number) => ({ ascent: size * 0.72, descent: 0, width: size * 0.12 }) });
const measuredHeader = renderCard(headerDesign, assets, metricMeasure).svg;
assert.ok(measuredHeader.includes('data-title-symbol="true"'));
assert.ok(!renderCard({ ...headerDesign, layout: 'open' }, assets, metricMeasure).svg.includes('data-title-symbol'));

const headerBaseline = Number(measuredHeader.match(/<text x="[^"]+" y="([^"]+)"[^>]*>GUILD ATTACHÉ<\/text>/)![1]);
const symbolTop = Number(measuredHeader.match(/data-title-symbol="true"><path d="M[^ ]+ ([^H]+)H/)![1]);
assert.ok(Math.abs(symbolTop - (headerBaseline - headerDesign.parameters.titleSize * 0.72)) < 1e-8, 'Upright aligns with O ink top');
const cuts = [...measuredHeader.matchAll(/data-symbol-cut="\d" d="M([^ ]+) ([^h]+)h([^l]+)l([^ ]+) ([^h]+)h/g)].map(m => m.slice(1).map(Number));
assert.equal(cuts.length, 3);
assert.ok(Math.abs(cuts[0][2] - headerDesign.parameters.barThickness) < 1e-8, 'Cut width follows its independent slider');
assert.ok(Math.abs(-cuts[0][3] / cuts[0][4] - Math.tan(Math.PI / 6)) < 1e-8, 'Cuts are 30 degrees from vertical');
assert.ok(Math.abs(cuts[1][0] - cuts[0][0] - cuts[0][2] * 2.25) < 1e-8, 'White interval is 125 percent of cut width');

const headerText = (svg: string) => svg.match(/<text x="[^"]+" y="[^"]+"[^>]*>GUILD ATTACHÉ<\/text>/)![0];
const crossChange = newDesign();
const beforeCross = renderCard(crossChange, assets, measure).svg;
crossChange.parameters.cross = 22;
const afterCross = renderCard(crossChange, assets, measure).svg;
assert.equal(headerText(beforeCross), headerText(afterCross), 'Cross size must not move or resize the title');
assert.deepEqual(beforeCross.match(/<mask .*?<\/mask>/g), afterCross.match(/<mask .*?<\/mask>/g), 'Cross size must not move traits');
crossChange.parameters.titleGap += 10;
const gapHeader = renderCard(crossChange, assets, measure).svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>GUILD ATTACHÉ<\/text>/)!;
const baseHeader = beforeCross.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>GUILD ATTACHÉ<\/text>/)!;
assert.equal(+gapHeader[1] - +baseHeader[1], 10);
assert.equal(+gapHeader[2] - +baseHeader[2], -10);

const imageDesign = newDesign();
const imageCard = renderCard(imageDesign, assets, measure).svg;
assert.ok(imageCard.includes('data-image-frame="true" mask="url(#card-art-cutout)"'));
const imageMask = imageCard.match(/<mask id="card-art-cutout".*?<\/mask>/)![0];
assert.ok(imageMask.includes('maskUnits="userSpaceOnUse"'));
assert.ok(imageMask.includes('stroke-width="20"'), 'L cutout uses twice the image margin for its outline');
imageDesign.parameters.imageMargin = 20;
const largerMargin = renderCard(imageDesign, assets, measure).svg.match(/<mask id="card-art-cutout".*?<\/mask>/)![0];
assert.ok(largerMargin.includes('stroke-width="40"'));
assert.notEqual(largerMargin, imageMask, 'Margin changes the artwork bounds and symbol cutout');
assert.ok(imageCard.includes('text-anchor="start"'), 'Logo microtext is left aligned');

const fixedSymbol = newDesign();
const fixedBefore = renderCard(fixedSymbol, assets, measure).svg;
fixedSymbol.parameters.symbolX = 80;
assert.equal(renderCard(fixedSymbol, assets, measure).svg, fixedBefore, 'Legacy horizontal offset cannot shift the symbol off the rail');
fixedSymbol.parameters.barThickness = 12;
assert.ok(renderCard(fixedSymbol, assets, measure).svg.match(/data-symbol-cut="0" d="[^"]+h12l/), 'Bar thickness changes the cut geometry');
fixedSymbol.parameters.subtitleSize = 30;
assert.ok(renderCard(fixedSymbol, assets, measure).svg.match(/font-size="30"[^>]*>CHARACTER</), 'Subtitle size is independently adjustable');

const stripDesign = newDesign();
stripDesign.parameters.leftDecorationWidth = 24;
const stripSVG = renderCard(stripDesign, assets, measure).svg;
const strip = stripSVG.match(/<g data-left-decoration="true">(.*?)<\/g><text x=/s)![1];
assert.equal((strip.match(/font-family="StudioBody"/g) || []).length, 1, 'Narrow decoration strip keeps one fixed-size line');
assert.equal((strip.match(/data-decoration-box=/g) || []).length, 2, 'Left decoration has two empty boxes');
const imageLeft = (svg: string) => +svg.match(/<mask id="card-art-cutout"[^>]* x="([^"]+)"/)![1];
stripDesign.parameters.leftDecorationWidth += 20;
const widerStrip = renderCard(stripDesign, assets, measure).svg;
assert.equal(imageLeft(widerStrip) - imageLeft(stripSVG), 20, 'Strip width moves the image right by the same amount');
assert.notEqual(widerStrip.match(/<g data-left-decoration="true">.*?<\/g><text x=/s)![0], stripSVG.match(/<g data-left-decoration="true">.*?<\/g><text x=/s)![0], 'Placeholder text adapts to strip width');

const columns = (svg: string) => [...svg.matchAll(/<text data-decoration-column="\d+"[^>]*font-size="([^"]+)"/g)];
assert.ok(columns(widerStrip).length > columns(stripSVG).length, 'Wider strip adds lines');
assert.ok(columns(widerStrip).every(m => +m[1] === stripDesign.parameters.decorationTextSize), 'Wider strip never rescales microtext');
assert.ok(columns(stripSVG).every(m => +m[1] === stripDesign.parameters.decorationTextSize), 'Narrow strip never rescales microtext');
const lastColumn = [...widerStrip.matchAll(/data-decoration-column="\d+" transform="translate\(([^ ]+) /g)].at(-1)!;
assert.equal(+lastColumn[1] + stripDesign.parameters.decorationTextSize * 0.75, imageLeft(widerStrip) - stripDesign.parameters.imageMargin, 'Right ink edge meets the image margin boundary');
assert.equal(designSchema.parse({ ...stripDesign, parameters: { ...stripDesign.parameters, decorationTextSize: 10 } }).parameters.decorationTextSize, 6, 'Older large mini-text settings migrate to the new maximum');

const editableDecoration = newDesign();
editableDecoration.content.character.leftDecoration = 'Custom <identity> & terms';
const editedStrip = renderCard(editableDecoration, assets, measure).svg;
assert.ok(editedStrip.includes('CUSTOM &lt;IDENTITY&gt; &amp; TERMS'), 'Decoration copy renders uppercase and XML escaped');
assert.ok(editedStrip.includes('data-decoration-box="0" rx="4"'), 'Decoration boxes have rounded corners');
assert.ok(editedStrip.indexOf('data-decoration-box="0"') > editedStrip.indexOf('data-frame-divider'), 'Boxes render above the cross and its clearance');
const decorationBox = editedStrip.match(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"[^>]*data-decoration-box="1"/)!;
const dividerY = +editedStrip.match(/data-frame-divider="true"><path d="M[^ ]+ ([^L]+)L/)![1];
assert.ok(Math.abs((+decorationBox[1] - editableDecoration.parameters.inset) - (dividerY - +decorationBox[2] - +decorationBox[4])) < 1e-8, 'Boxes have equal left and bottom offsets');

assert.equal(titleFingerprint('GUILD ATTACHÉ'), titleFingerprint('GUILD ATTACHÉ'), 'Title fingerprints are stable');
assert.notEqual(titleFingerprint('GUILD ATTACHÉ'), titleFingerprint('OTHER TITLE'), 'Different titles generate different sample codes');
const rightDesign = newDesign();
rightDesign.content.character.rightDecoration = 'ONE\nTWO\nTHREE';
const rightSVG = renderCard(rightDesign, assets, measure).svg;
const fingerprint = titleFingerprint(rightDesign.content.character.title);
assert.ok(rightSVG.includes(`data-title-hash="${fingerprint}"`));
assert.ok(rightSVG.includes(`data-title-barcode="${fingerprint}"`));
assert.ok(rightSVG.includes('data-rpa-logo="true"'));
assert.ok(rightSVG.includes('cx="41" cy="61" r="37"') && rightSVG.includes('cx="545" cy="560" r="37"'), 'RPA satellites match reference positions');
assert.ok(rightSVG.includes('>03</text>') && rightSVG.includes('>42</text>'));
assert.ok(+decorationBox[4] > +decorationBox[3], 'Left badges are taller than they are wide');
rightDesign.parameters.symbolUprightExtra = 20;
const thickL = renderCard(rightDesign, assets, measure).svg;
assert.ok(thickL.includes(`H${rightDesign.parameters.inset + rightDesign.parameters.symbolWidth + 20}V`), 'Upright width increases independently');
rightDesign.parameters.traitSize = 60;
rightDesign.parameters.traitSpacing = 20;
const traitSVG = renderCard(rightDesign, assets, measure).svg;
const traitImages = [...traitSVG.matchAll(/data-trait="[^"]+" x="([^"]+)" y="[^"]+" width="([^"]+)" height="([^"]+)"/g)];
assert.equal(+traitImages[0][3], 60);
assert.ok(Math.abs(+traitImages[1][1] - +traitImages[0][1] - +traitImages[0][2] - 20) < 1e-8, 'Spacing is between visible trait edges');
const lastTrait = traitImages[traitImages.length - 1];
assert.equal(+lastTrait[1] + +lastTrait[2], 1000 - rightDesign.parameters.inset - rightDesign.parameters.line / 2 - 6);


const bottomDesign = newDesign();
const bottomCard = renderCard(bottomDesign, assets, measure, 'bottom', true);
const cutHeight = 1000 * 63 / 88;
const formerBottom = cutHeight - bottomDesign.parameters.inset;
assert.ok(!bottomCard.svg.includes(`M${-5 / 88 * 1000} ${formerBottom}L`), 'Character omits the bottom horizontal rail');
const barcodeRect = bottomCard.svg.match(/data-title-barcode="[^"]+"><rect x="[^"]+" y="([^"]+)" width="[^"]+" height="([^"]+)"/)!;
assert.ok(Math.abs(+barcodeRect[1] - formerBottom) < 1e-8);
assert.ok(Math.abs(+barcodeRect[1] + +barcodeRect[2] - (cutHeight + 5 / 88 * 1000)) < 1e-8, 'Barcode reaches the outer bleed edge');
const getCodePosition = (svg: string) => svg.match(/<g transform="translate\(([^)]+)\) rotate\(90\)"><text[^>]*>CHR_05/)![1];
const codeBeforeMargin = getCodePosition(bottomCard.svg);
bottomDesign.parameters.imageMargin = 30;
assert.equal(+getCodePosition(renderCard(bottomDesign, assets, measure).svg).split(' ')[1] - +codeBeforeMargin.split(' ')[1], 20, 'Card ID follows image margin');

const noWrapDesign = newDesign();
noWrapDesign.content.character.rightDecoration = 'A VERY LONG LINE THAT MUST REMAIN ON ONE LINE EVEN WHEN IT EXTENDS LEFT OF THE LOGO\nSECOND LINE\nTHIRD LINE';
const noWrapSVG = renderCard(noWrapDesign, assets, measure).svg;
assert.ok(noWrapSVG.includes('>A VERY LONG LINE THAT MUST REMAIN ON ONE LINE EVEN WHEN IT EXTENDS LEFT OF THE LOGO</text>'));
assert.ok(noWrapSVG.match(/data-short-hash="true"[^>]*font-size="17"[^>]*>#[0-9A-F]+-[0-9A-F]+-[0-9A-F]+<\/text>/));

const matchedWidths = (design: ReturnType<typeof newDesign>) => {
  const svg = renderCard(design, assets, measure).svg;
  const logo = svg.match(/data-rpa-logo="true" x="([^"]+)"[^>]* width="([^"]+)"/)!;
  const hash = svg.match(/data-short-hash="true" x="([^"]+)"[^>]*textLength="([^"]+)"/)!;
  assert.equal(hash[1], logo[1]); assert.equal(hash[2], logo[2]);
  const barcode = svg.match(/data-title-barcode="[^"]+">(.*?)<\/g>/)![1];
  const bars = [...barcode.matchAll(/<rect x="([^"]+)"[^>]* width="([^"]+)"/g)];
  assert.equal(+bars[0][1], +logo[1]);
  const last = bars[bars.length - 1];
  assert.ok(Math.abs(+last[1] + +last[2] - (+logo[1] + +logo[2])) < 1e-8);
  const imageX = +svg.match(/<mask id="card-art-cutout"[^>]* x="([^"]+)"/)![1];
  assert.equal(+svg.match(/<text x="([^"]+)"[^>]*>SINGLE USE<\/text>/)![1], imageX);
};
matchedWidths(newDesign());
const smallLogo = newDesign(); smallLogo.parameters.rightDecorationWidth = 80; matchedWidths(smallLogo);
assert.equal(newDesign().parameters.decorationTextSize, 5);

const docked = newDesign();
const dockingGeometry = (design: ReturnType<typeof newDesign>) => {
  const svg = renderCard(design, assets, measure).svg;
  const logo = svg.match(/data-rpa-logo="true"[^>]* y="([^"]+)"[^>]* height="([^"]+)"/)!;
  const hash = svg.match(/data-short-hash="true"[^>]* y="([^"]+)"/)!;
  const barcode = svg.match(/data-title-barcode="[^"]+"><rect[^>]* y="([^"]+)"/)!;
  assert.equal(+barcode[1] - +hash[1], 3, 'Hash sits three units above barcode');
  assert.ok(Math.abs(+hash[1] - 17 * 0.72 - (+logo[1] + +logo[2]) - 4) < 1e-8, 'Logo bottom sits four units above hash ink');
  return +hash[1];
};
const anchoredHashY = dockingGeometry(docked);
docked.parameters.rightDecorationWidth = 80;
assert.equal(dockingGeometry(docked), anchoredHashY, 'Resizing logo does not move hash away from barcode');

const identityOff = newDesign(); identityOff.parameters.barcode = false;
const withoutIdentity = renderCard(identityOff, assets, measure).svg;
assert.ok(!withoutIdentity.includes('data-rpa-logo'));
assert.ok(!withoutIdentity.includes('data-short-hash'));
assert.ok(!withoutIdentity.includes('data-title-barcode'));
assert.ok(withoutIdentity.includes('data-right-decoration'), 'Small right notice remains independent of identity toggle');

const edgesDesign = newDesign();
const edgesSVG = renderCard(edgesDesign, assets, measure, 'edges', true).svg;
for (const [name, value] of [['top', '42'], ['bottom', '08']] as const) assert.ok(edgesSVG.includes(`data-edge-barcode="${name}" data-value="${value}"`));
assert.ok(edgesSVG.includes('>FULL SPECTRUM OVERDRIVE</text>'));
for (const name of ['top', 'traits']) {
  const y = +edgesSVG.match(new RegExp(`data-edge-barcode="${name}"[^>]*><rect[^>]* y="([^"]+)"`))![1];
  assert.equal(y, -5 / 88 * 1000, 'Top decorations reach outer bleed');
}
const bottomEdge = edgesSVG.match(/data-edge-barcode="bottom"[^>]*><rect[^>]* y="([^"]+)"[^>]* height="([^"]+)"/)!;
assert.ok(Math.abs(+bottomEdge[1] + +bottomEdge[2] - (1000 * 63 / 88 + 5 / 88 * 1000)) < 1e-8);
for (const [key, name] of [['topBarcode', 'top'], ['bottomBarcode', 'bottom'], ['traitsBarcode', 'traits']] as const) {
  const toggled = newDesign(); toggled.parameters[key] = false;
  const svg = renderCard(toggled, assets, measure).svg;
  assert.ok(!svg.includes(`data-edge-barcode="${name}"`));
  assert.equal((svg.match(/data-edge-barcode=/g) || []).length, 2, 'Each toggle affects only its own barcode');
}

const boldMini = newDesign(); boldMini.parameters.decorationTextWeight = 600;
const boldMiniSVG = renderCard(boldMini, assets, measure).svg;
assert.ok(boldMiniSVG.match(/data-decoration-column="0"[^>]*font-weight="600"/));
for (const name of ['top', 'bottom']) {
  const bar = boldMiniSVG.match(new RegExp(`data-edge-barcode="${name}"[^>]*><rect x="([^"]+)"[^>]* width="([^"]+)"[^>]* fill="([^"]+)"`))!;
  assert.equal(+bar[1], boldMini.parameters.inset + boldMini.parameters.line / 2 + 3);
  assert.equal(+bar[2], 2, 'Short barcode modules have thicker two-unit bars');
  assert.equal(bar[3], boldMini.palettes.color.dark);
}

const mergedBarsSVG = renderCard(newDesign(), assets, measure).svg;
for (const group of mergedBarsSVG.matchAll(/<g (?:data-edge-barcode|data-title-barcode)=[^>]+>(.*?)<\/g>/g)) {
  const bars = [...group[1].matchAll(/<rect x="([^"]+)"[^>]* width="([^"]+)"/g)];
  for (let i = 1; i < bars.length; i++) assert.ok(+bars[i][1] - (+bars[i - 1][1] + +bars[i - 1][2]) > 0.01, 'Every separate barcode rectangle has a real white gap; adjacent ink is merged');
}

const chunkyTraits = newDesign(); chunkyTraits.content.character.traits = ['Military'];
const traitBarcode = (d: ReturnType<typeof newDesign>) => renderCard(d, assets, measure).svg.match(/<g data-edge-barcode="traits"[^>]*>(.*?)<\/g>/)![0];
const originalTraitBarcode = traitBarcode(chunkyTraits);
chunkyTraits.content.character.title = 'A DIFFERENT TITLE';
assert.equal(traitBarcode(chunkyTraits), originalTraitBarcode, 'Trait barcode does not depend on title');
chunkyTraits.content.character.traits = ['Science'];
assert.notEqual(traitBarcode(chunkyTraits), originalTraitBarcode, 'Trait selection changes barcode');
const chunkyBars = [...originalTraitBarcode.matchAll(/<rect x="([^"]+)"[^>]* width="([^"]+)"/g)];
const chunkyLast = chunkyBars[chunkyBars.length - 1];
assert.ok(Math.abs(+chunkyLast[1] + +chunkyLast[2] - +chunkyBars[0][1] - (3 * 40 + 2 * 9 + 16)) < 1e-8, 'Barcode spans three slots plus extra');
assert.ok(+chunkyBars[0][2] >= 2 && +chunkyBars[0][2] < 3, 'Trait barcode thickness matches the other barcodes');

const inlineDesign = newDesign();
const inlineSVG = renderCard(inlineDesign, assets, measure).svg;
for (const name of ['left', 'divider', 'right']) {
  const group = inlineSVG.match(new RegExp(`<g data-inline-decoration="${name}".*?<\\/g>`))![0];
  assert.ok(group.includes('<rect'), 'Inline text clears the rail behind it');
  assert.ok(group.includes('text-anchor="middle"'), 'Inline text is centered');
  assert.ok(group.includes('font-size="5"'));
}
inlineDesign.content.character.inlineLeft = '';
assert.ok(!renderCard(inlineDesign, assets, measure).svg.includes('data-inline-decoration="left"'), 'Empty inline field restores continuous rail');

const subtitleDesign = newDesign(); subtitleDesign.parameters.subtitleWeight = 900;
const subtitleSVG = renderCard(subtitleDesign, assets, measure).svg;
assert.ok(subtitleSVG.match(/font-weight="900"[^>]*>CHARACTER<\/text>/));
assert.ok(subtitleSVG.includes('data-hide-frame-above="true"'));
assert.ok(subtitleSVG.match(/font-size="26"[^>]*>CHR_05<\/text>/));
subtitleDesign.parameters.hideFrameAbove = false;
assert.ok(!renderCard(subtitleDesign, assets, measure).svg.includes('data-hide-frame-above'));

const suppliedPreset = presetDesign();
assert.deepEqual(suppliedPreset, designSchema.parse(preset), 'Startup design matches the supplied preset');
assert.deepEqual(defaultParameters, suppliedPreset.parameters, 'Reset parameters restores supplied settings');
assert.equal(suppliedPreset.parameters.inset, 43);
assert.equal(suppliedPreset.parameters.titleWeight, 900);
assert.equal(suppliedPreset.parameters.decorationTextSize, 4.5);
assert.deepEqual(suppliedPreset.content.character.traits, ['Diplomacy', 'Military']);
for (const layout of layouts) assert.ok(!/NaN|Infinity/.test(renderCard({ ...suppliedPreset, layout }, assets, measure).svg));

const upperFields = newDesign();
Object.assign(upperFields.content.character, { title: 'Mixed title', subtitle: 'Mixed category', code: 'chr_abc', heading: 'Single use' });
const upperSVG = renderCard(upperFields, assets, measure).svg;
for (const text of ['MIXED TITLE', 'MIXED CATEGORY', 'CHR_ABC', 'SINGLE USE']) assert.ok(upperSVG.includes('>' + text + '</text>'));
assert.equal(upperFields.content.character.title, 'Mixed title', 'Rendering preserves editable source text');
