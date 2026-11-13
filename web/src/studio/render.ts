import { dimensions, type Design } from './model';
import type { Assets } from './assets';
export const escapeXML = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export type Measure = ((text: string, size: number, heading: boolean, weight: number) => number) & {
  bodyInk?: (text: string, size: number, weight?: number) => { ascent: number; descent: number };
  ink?: (text: string, size: number, weight?: number) => { ascent: number; descent: number; width: number };
};
export function wrapText(text: string, width: number, size: number, weight: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line}${word}`, size, false, weight) > width) { lines.push(line.trimEnd()); line = ''; }
      // Split unbroken strings too, so imported text cannot run beyond the panel.
      for (const char of word) {
        const candidate = line + char;
        if (measure(candidate, size, false, weight) > width && line) { lines.push(line.trimEnd()); line = ''; }
        line += char;
      }
      line += ' ';
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
type BodyRun = { text: string; weight: number };
export function wrapBody(text: string, width: number, size: number, weight: number, measure: Measure) {
  const result: { runs: BodyRun[]; gap: number }[] = [];
  let pendingGap = 0;
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) { pendingGap += size; continue; }
    const runs: BodyRun[] = paragraph.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(text => ({ text: text.startsWith('**') && text.endsWith('**') ? text.slice(2, -2) : text, weight: text.startsWith('**') && text.endsWith('**') ? 700 : weight }));
    let line: BodyRun[] = [], used = 0, space = false;
    const flush = () => { if (line.length) { result.push({ runs: line, gap: pendingGap }); pendingGap = 0; line = []; used = 0; } };
    const append = (text: string, runWeight: number) => {
      const last = line[line.length - 1];
      if (last?.weight === runWeight) last.text += text; else line.push({ text, weight: runWeight });
      used += measure(text, size, false, runWeight);
    };
    for (const run of runs) for (const token of run.text.split(/(\s+)/).filter(Boolean)) {
      if (/^\s+$/.test(token)) { space = true; continue; }
      const spaceWidth = space && line.length ? measure(' ', size, false, weight) : 0;
      if (line.length && used + spaceWidth + measure(token, size, false, run.weight) > width) flush();
      if (space && line.length) append(' ', weight);
      space = false;
      for (const char of token) {
        if (line.length && used + measure(char, size, false, run.weight) > width) flush();
        append(char, run.weight);
      }
    }
    flush();
    pendingGap = 0;
  }
  return result;
}
// Stable 64-bit FNV-1a fingerprint; the decorative barcode encodes these same bits.
export function titleFingerprint(title: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(title.normalize('NFC'))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).toUpperCase().padStart(16, '0');
}
// Visible alpha bounds in the repository's 420×420 trait PNGs.
const traitBounds: Record<string, [number, number, number, number]> = {
  Trade: [39, 80, 341, 259], Military: [79, 50, 261, 320],
  Exploration: [3, 33, 387, 353], Science: [69, 69, 282, 282], Diplomacy: [79, 42, 262, 335],
};
export function contrastText(color: string) {
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
}
export function renderCard(d: Design, assets: Assets, measure: Measure, prefix = 'card', bleed = false) {
  // Normalize the longest edge: typography keeps the same physical scale when rotated.
  const dim = dimensions(d), w = 1000 * dim.width / Math.max(dim.width, dim.height), h = w * dim.height / dim.width;
  const p = { ...d.parameters, titleInset: d.layout === 'vessel' ? d.parameters.vesselTitleInset : d.parameters.titleInset, barcode: d.layout === 'vessel' ? false : d.parameters.barcode, lineSpacing: d.parameters.bodyLineSpacings[d.layout] ?? (d.layout === 'overdrive' ? 2 : d.parameters.lineSpacing), weight: d.parameters.bodyWeights[d.layout] ?? d.parameters.weight }, source = d.content[d.layout], pal = d.palettes[d.mode], m = p.inset;
  // Normalize before measuring as well as drawing, so uppercase text fits correctly.
  const c = { ...source, traits: d.layout === 'overdrive' ? source.traits.slice(0, 1) : source.traits, title: source.title.toUpperCase(), subtitle: source.subtitle.toUpperCase(), code: source.code.toUpperCase(), heading: source.heading.toUpperCase() };
  const radius = dim.rounded ? 3 / dim.width * w : 0;
  const b = bleed ? 5 / dim.width * w : 0;
  const frameTop = m + p.titleInset;
  const uprightWidth = p.symbolWidth + p.symbolUprightExtra;
  const warnings: string[] = [];
  if (d.layout !== 'open' && (w < 350 || h < 350)) warnings.push('This extreme aspect ratio is too narrow for the text layout. Choose Open or increase the shorter side.');
  const parts: string[] = [];
  const rect = (x: number, y: number, width: number, height: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${Math.max(0, width)}" height="${Math.max(0, height)}" fill="${fill}" ${extra}/>`;
  const line = (x1: number, y1: number, x2: number, y2: number, color = pal.light) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${p.line}"/>`;
  function barcodeBars(bits: string, x: number, y: number, unit: number, height: number) {
    // One rectangle per continuous ink run avoids antialiasing seams between modules.
    for (const run of bits.matchAll(/1+/g)) parts.push(rect(x + run.index! * unit, y, run[0].length * unit, height, pal.dark));
  }
  function edgeBarcode(value: string, x: number, y: number, width: number, height: number, name: string) {
    if (height <= 0 || width <= 0) return;
    const payload = name === 'traits' ? [...value].map(char => parseInt(char, 16).toString(2).padStart(4, '0')).join('') : [...new TextEncoder().encode(value)].map(byte => byte.toString(2).padStart(8, '0')).join('');
    const bits = '101' + payload + '101';
    const unit = width / bits.length;
    parts.push(`<g data-edge-barcode="${name}" data-value="${escapeXML(value)}">`);
    barcodeBars(bits, x, y, unit, height);
    parts.push('</g>');
  }
  function frameCrosses(y: number, omitLeft = false) {
    for (const x of omitLeft ? [w - m] : [m, w - m]) {
      const crossPath = `M${d.layout === 'overdrive' && p.barcode && y === h - m && x === w - m ? x : x - p.cross} ${y}H${x + p.cross}M${x} ${y - p.cross}V${y + p.cross}`;
      // Clearance follows the arms rather than erasing a square of artwork.
      parts.push(`<path d="${crossPath}" fill="none" stroke="${pal.background}" stroke-width="${p.line + 2 * p.crossGap}" stroke-linecap="square"/>`);
      parts.push(`<path d="${crossPath}" fill="none" stroke="${pal.light}" stroke-width="${p.line}"/>`);
    }
  }
  function label(text: string, x: number, y: number, size: number, fill: string, maxWidth: number, heading = false, weight: number = heading ? 700 : p.weight, spacing = 0) {
    const measured = measure(text, size, heading, weight) + Math.max(0, [...text].length - 1) * spacing;
    const fitted = Math.min(size, size * maxWidth / Math.max(1, measured));
    if (text && fitted < size * 0.6) warnings.push('A heading is very long; shorten it for a readable print.');
    return `<text x="${x}" y="${y}" fill="${fill}" font-family="${heading ? 'StudioHeading' : 'StudioBody'}" font-weight="${weight}" font-size="${fitted}" letter-spacing="${spacing * fitted / size}">${escapeXML(text)}</text>`;
  }
  function inlineLabel(text: string, x: number, y: number, vertical: boolean, maxWidth: number, name: string) {
    if (!text.trim()) return;
    const copy = text.toUpperCase();
    const size = Math.min(p.decorationTextSize, p.decorationTextSize * Math.max(1, maxWidth - 8) / Math.max(1, measure(copy, p.decorationTextSize, false, p.decorationTextWeight)));
    const width = measure(copy, size, false, p.decorationTextWeight);
    const metrics = measure.bodyInk?.(copy, size, p.decorationTextWeight) ?? { ascent: size * 0.75, descent: size * 0.2 };
    const height = Math.max(p.line + 2, metrics.ascent + metrics.descent + 2);
    parts.push(`<g data-inline-decoration="${name}" transform="translate(${x} ${y})${vertical ? ' rotate(90)' : ''}">`);
    parts.push(rect(-width / 2 - 4, -height / 2, width + 8, height, pal.background));
    parts.push(`<text x="0" y="${(metrics.ascent - metrics.descent) / 2}" text-anchor="middle" fill="${pal.light}" font-family="StudioBody" font-weight="${p.decorationTextWeight}" font-size="${size}">${escapeXML(copy)}</text></g>`);
  }
  function body(x: number, y: number, width: number, height: number, fill = pal.text) {
    if (d.mode === 'print') fill = '#000000';
    const lines = wrapBody(c.body, width, p.bodySize, p.weight, measure);
    const lineAdvance = Math.max(1, p.bodySize * p.leading + p.lineSpacing);
    const extraGap = (gap: number) => gap * (d.layout === 'objective' || d.layout === 'overdrive' ? 0.5 : 1);
    const headingHeight = c.heading ? p.effectHeadingSize + p.effectHeadingGap : 0;
    const textHeight = lines.length ? p.bodySize + (lines.length - 1) * lineAdvance + lines.reduce((sum, line) => sum + extraGap(line.gap), 0) : 0;
    const blockHeight = textHeight + headingHeight;
    let top = y + (d.layout === 'objective' ? Math.max(0, (height - blockHeight) / 2) : 0);
    if (c.heading) { parts.push(label(c.heading, x, top + p.effectHeadingSize * 30 / 32, p.effectHeadingSize, d.mode === 'print' ? '#000000' : d.layout === 'objective' ? fill : fill === pal.text ? pal.accent : fill, width, true)); top += headingHeight; }
    let baseline = top + p.bodySize, hidden = 0;
    for (const line of lines) {
      baseline += extraGap(line.gap);
      if (baseline > y + height) { hidden++; continue; }
      if (line.runs.every(run => run.weight === p.weight)) parts.push(label(line.runs.map(run => run.text).join(''), x, baseline, p.bodySize, fill, width));
      else parts.push(`<text x="${x}" y="${baseline}" fill="${fill}" font-family="StudioBody" font-size="${p.bodySize}">${line.runs.map(run => `<tspan font-weight="${run.weight}">${escapeXML(run.text)}</tspan>`).join('')}</text>`);
      baseline += lineAdvance;
    }
    if (hidden) warnings.push(`Body text exceeds its panel by ${hidden} line(s). Reduce font size, shorten text, or adjust panel split.`);
  }
  let artworkCutout = '';
  let panelCutout = '';
  function art(x: number, y: number, width: number, height: number) {
    width = Math.max(1, width); height = Math.max(1, height);
    parts.push(`<mask id="${prefix}-art-cutout" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}" style="mask-type:luminance">${rect(x, y, width, height, '#ffffff')}<path d="${artworkCutout}" fill="#000000" stroke="#000000" stroke-width="${2 * p.imageMargin}" stroke-linejoin="miter"/></mask><g data-image-frame="true" mask="url(#${prefix}-art-cutout)">`);
    if (panelCutout) parts.push(`<clipPath id="${prefix}-panel-image-clip"><path d="${panelCutout}"/></clipPath><g clip-path="url(#${prefix}-panel-image-clip)">`);
    // A light placeholder under loaded artwork leaks through antialiased edges.
    if (!c.artwork && d.layout !== 'vessel') parts.push(rect(x, y, width, height, d.mode === 'print' ? '#f3f3f3' : pal.light));
    const vesselPNG = d.layout === 'vessel' && c.artwork.startsWith('data:image/png;');
    const invertLinework = vesselPNG && contrastText(pal.background) === '#ffffff';
    if (invertLinework) parts.push(`<filter id="${prefix}-linework-invert" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/><feFuncA type="identity"/></feComponentTransfer></filter>`);
    if (c.artwork) parts.push(`<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden"><image ${vesselPNG ? 'data-vessel-linework="true"' : ''} ${invertLinework ? `filter="url(#${prefix}-linework-invert)"` : ''} href="${c.artwork}" width="${width}" height="${height}" preserveAspectRatio="${c.imageHorizontal === 'right' ? 'xMax' : c.imageHorizontal === 'left' ? 'xMin' : 'xMid'}${c.imagePosition < 34 ? 'YMin' : c.imagePosition > 66 ? 'YMax' : 'YMid'} ${vesselPNG ? 'meet' : 'slice'}"/></svg>`);
    if (panelCutout) parts.push('</g>');
    parts.push('</g>');
  }
  parts.push(rect(-b, -b, w + b * 2, h + b * 2, pal.background));
  // Frame inset moves every rail equally; rails continue through the bleed.
  parts.push(line(m, -b, m, h + b), line(w - m, -b, w - m, h + b), line(d.layout === 'open' ? -b : m + uprightWidth, frameTop, w + b, frameTop));
  if (d.layout !== 'character' && d.layout !== 'vessel') parts.push(line(-b, h - m, w + b, h - m));
  frameCrosses(frameTop, d.layout !== 'open');
  if (d.layout !== 'character' && d.layout !== 'vessel') frameCrosses(h - m);
  if (d.layout !== 'open') {
    const start = m + 16, inner = w - 2 * start, top = frameTop + 40, bottom = h - m - 20;
    const symbolX = m;
    const titleX = symbolX + uprightWidth + p.titleGap;
    const iconSize = p.traitSize, iconGap = p.traitSpacing;
    const traitWidths = c.traits.map(trait => iconSize * traitBounds[trait][2] / traitBounds[trait][3]);
    const iconWidth = (d.layout === 'character' || d.layout === 'overdrive') ? traitWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, c.traits.length - 1) * iconGap : (d.layout === 'objective' || d.layout === 'vessel') ? 55 : 0;
    const traitsRight = w - m - p.line / 2 - 6;
    const titleRight = d.layout === 'character' ? traitsRight : w - start;
    const titleSpace = Math.max(1, titleRight - titleX - iconWidth - 16);
    const titleSize = Math.min(p.titleSize, p.titleSize * titleSpace / Math.max(1, measure(c.title, p.titleSize, true, p.titleWeight) + Math.max(0, [...c.title].length - 1) * p.titleSpacing));
    const ink = (text: string, size: number, weight = 700) => measure.ink?.(text, size, weight) ?? { ascent: size * 0.75, descent: 0, width: size * 0.15 };
    // O deliberately excludes accents; I provides the actual ink width, not its advance.
    const titleY = frameTop - 2 - p.titleGap - ink('O', titleSize, p.titleWeight).descent;
    const symbolY = titleY - ink('O', titleSize, p.titleWeight).ascent;
    const cutWidth = p.barThickness;
    const bandTop = frameTop - 2, bandHeight = p.symbolWidth;
    const bandBottom = bandTop + bandHeight;
    const slant = bandHeight * Math.tan(Math.PI / 6);
    const elbow = symbolX + uprightWidth;
    const cutsEnd = elbow + cutWidth * 5.5; // Three cuts, two white intervals of 1.25 widths.
    const padding = titleSize * 0.25;
    const categoryX = cutsEnd + padding;
    const categorySize = Math.min(p.subtitleSize, Math.max(1, w - start - categoryX - padding - slant) / Math.max(1, measure(c.subtitle, 1, true, p.subtitleWeight)));
    const bandRight = categoryX + measure(c.subtitle, categorySize, true, p.subtitleWeight) + padding + slant;
    const shape = `M${symbolX} ${symbolY}H${elbow}V${bandTop}H${bandRight}L${bandRight - slant} ${bandBottom}H${symbolX}Z`;
    artworkCutout = shape;
    parts.push(`<g data-title-symbol="true"><path d="${shape}" fill="${pal.background}" stroke="${pal.background}" stroke-width="${2 * p.crossGap + p.line}" stroke-linejoin="miter"/>`);
    parts.push(`<path d="${shape}" fill="${pal.text}"/>`);
    const cutOvershoot = 1;
    const cutSlant = Math.tan(Math.PI / 6);
    for (let i = 0; i < 3; i++) {
      const x = elbow + i * cutWidth * 2.25;
      parts.push(`<path data-symbol-cut="${i}" d="M${x + cutOvershoot * cutSlant} ${bandTop - cutOvershoot}h${cutWidth}l${-(bandHeight + 2 * cutOvershoot) * cutSlant} ${bandHeight + 2 * cutOvershoot}h${-cutWidth}Z" fill="${pal.background}"/>`);
    }
    const categoryInk = ink(c.subtitle, categorySize, p.subtitleWeight);
    parts.push(label(c.subtitle, categoryX, bandTop + (bandHeight + categoryInk.ascent - categoryInk.descent) / 2, categorySize, pal.background, Math.max(1, bandRight - categoryX - padding), true, p.subtitleWeight), '</g>');
    if (p.topLeftContinuation) parts.push(`<g data-top-left-continuation="true">${line(-b, frameTop, symbolX - p.crossGap, frameTop)}</g>`);
    if (symbolY < 0) warnings.push('Title extends above the cut edge. Increase Title inset or reduce Title size.');
    parts.push(label(c.title, titleX, titleY, p.titleSize, pal.accent, titleSpace, true, p.titleWeight, p.titleSpacing));
    const edgeBarWidth = 44, edgeBarGap = 8, edgeBarX = m + p.line / 2 + 3;
    const topDecorationY = symbolY - 8;
    const topTextX = p.topBarcode ? edgeBarX + edgeBarWidth + edgeBarGap : m + p.line / 2 + p.crossGap;
    const topTextRight = (d.layout === 'character' || d.layout === 'overdrive') && c.traits.length ? traitsRight - iconWidth - 16 : w - start;
    parts.push(label(c.topDecoration.toUpperCase(), topTextX, topDecorationY, p.decorationTextSize, pal.light, Math.max(1, topTextRight - topTextX), false, p.decorationTextWeight));
    if (p.topBarcode) edgeBarcode('42', edgeBarX, -b, edgeBarWidth, Math.max(0, topDecorationY + b), 'top');
    if (p.traitsBarcode && (d.layout === 'character' || d.layout === 'overdrive') && c.traits.length) {
      const cap = ink('O', titleSize, p.titleWeight);
      const traitsTop = titleY + (cap.descent - cap.ascent - iconSize) / 2;
      const barcodeRight = w - m - p.line / 2 - 3;
      const barcodeWidth = Math.max((d.layout === 'overdrive' ? 1 : 3) * iconSize + (d.layout === 'overdrive' ? 0 : 2 * iconGap), iconWidth) + 16;
      const traitsHash = titleFingerprint([...c.traits].sort().join('|'));
      edgeBarcode(traitsHash, barcodeRight - barcodeWidth, -b, barcodeWidth, Math.max(0, Math.min(symbolY, traitsTop) - 8 + b), 'traits');
    }
    if (d.layout === 'character' || d.layout === 'overdrive') c.traits.forEach((trait, i) => {
      const x = traitsRight - iconWidth + traitWidths.slice(0, i).reduce((sum, width) => sum + width, 0) + i * iconGap;
      const width = traitWidths[i];
      const cap = ink('O', titleSize, p.titleWeight);
      const y = titleY + (cap.descent - cap.ascent - iconSize) / 2;
      const bounds = traitBounds[trait];
      parts.push(`<mask id="${prefix}-trait-${trait}" mask-type="alpha"><svg data-trait="${trait}" x="${x}" y="${y}" width="${width}" height="${iconSize}" viewBox="${bounds.join(' ')}"><image href="${assets.icons[trait] || ''}" width="420" height="420"/></svg></mask>`);
      parts.push(rect(x, y, width, iconSize, pal.text, `mask="url(#${prefix}-trait-${trait})"`));
    });
    let decorationBottom = h - m;
    if (d.layout === 'objective' || d.layout === 'vessel') {
      const shieldValue = String(Math.min(9, Math.max(1, Math.round(Number(c.points) || 1))));
      const badgeRadius = 21;
      const badgeX = w - m - p.line / 2 - 6 - badgeRadius;
      const cap = ink('O', titleSize, p.titleWeight);
      const badgeY = titleY + (cap.descent - cap.ascent) / 2;
      parts.push(`<circle data-shield="${shieldValue}" cx="${badgeX}" cy="${badgeY}" r="${badgeRadius}" fill="none" stroke="${pal.text}" stroke-width="${p.line}"/>`);
      const digit = ink(shieldValue, 27);
      parts.push(`<text x="${badgeX}" y="${badgeY + (digit.ascent - digit.descent) / 2}" text-anchor="middle" fill="${pal.text}" font-family="StudioHeading" font-weight="700" font-size="27">${shieldValue}</text>`);
      if (p.shieldBarcode) edgeBarcode(shieldValue, w - m - p.line / 2 - 3 - 70, -b, 70, Math.max(0, badgeY - badgeRadius - 8 + b), 'shield');
    }
    if (d.layout === 'objective') {
      const panelInset = p.line / 2 + p.imageMargin;
      const textStart = m + panelInset + p.leftDecorationWidth;
      const panelTop = frameTop + panelInset;
      const panelBottom = h - m - panelInset;
      const availableWidth = Math.max(1, w - m - panelInset - textStart - p.imageMargin);
      const panelHeight = Math.max(1, panelBottom - panelTop);
      const imageWidth = Math.min(panelHeight * 9 / 16, availableWidth * 0.7);
      const textWidth = availableWidth - imageWidth;
      const panelColor = d.mode === 'print' ? '#ffffff' : p.textFrameColor === 'background' ? pal.background : p.textFrameColor || pal.accent;
      // A centered 60-degree bevel from vertical, shared by both panels.
      const extension = Math.min(48, imageWidth * 0.2, panelHeight * 0.2) * 0.6;
      const angle = Math.PI / 3;
      const protrusion = p.objectProtrusion ? extension : 0;
      const bevelHeight = protrusion / Math.tan(angle);
      const edgeX = textStart + textWidth - extension / 2;
      const bevelTop = panelTop + panelHeight * 2 / 3 - bevelHeight / 2;
      const bevelBottom = bevelTop + bevelHeight;
      const panelShape = `M ${textStart} ${panelTop} H ${edgeX} V ${bevelTop} L ${edgeX + protrusion} ${bevelBottom} V ${panelBottom} H ${textStart} Z`;
      // Parallel offset preserves the image margin perpendicular to the bevel.
      const gap = p.imageMargin;
      const imageEdge = edgeX + gap;
      const offsetY = gap * (1 - Math.cos(angle)) / Math.sin(angle);
      const imageRight = w - m - panelInset;
      panelCutout = `M ${imageEdge} ${panelTop} H ${imageRight} V ${panelBottom} H ${imageEdge + protrusion} V ${bevelBottom - offsetY} L ${imageEdge} ${bevelTop - offsetY} Z`;
      parts.push(`<mask id="${prefix}-text-cutout" maskUnits="userSpaceOnUse" x="${textStart}" y="${panelTop}" width="${textWidth + extension / 2}" height="${panelHeight}" style="mask-type:luminance"><path data-text-bevel="true" d="${panelShape}" fill="#ffffff"/><path d="${shape}" fill="#000000" stroke="#000000" stroke-width="${2 * p.imageMargin}" stroke-linejoin="miter"/></mask>`);
      parts.push(rect(textStart, panelTop, textWidth + extension / 2, panelHeight, panelColor, `data-text-frame="true" mask="url(#${prefix}-text-cutout)"`));
      const textTop = Math.max(panelTop, bandBottom + p.imageMargin) + p.textFrameMargin;
      body(textStart + p.textFrameMargin, textTop, Math.max(1, textWidth - extension / 2 - 2 * p.textFrameMargin), Math.max(1, panelBottom - p.textFrameMargin - textTop), contrastText(panelColor));
      art(imageEdge, panelTop, imageRight - imageEdge, panelHeight);
    } else {
      const imageHeight = (bottom - top) * (d.layout === 'overdrive' ? p.overdriveArtShare : d.layout === 'vessel' ? p.vesselArtShare : p.artShare) / 100;
      const leftStrip = d.layout === 'overdrive' ? 16 : p.leftDecorationWidth;
      const dividerY = top + imageHeight + 10;
      const imageInset = p.line / 2 + p.imageMargin;
      decorationBottom = dividerY;
      if (d.mode === 'print') parts.push(rect(m + p.line / 2, dividerY + p.line / 2, w - 2 * m - p.line, ((d.layout === 'character' || d.layout === 'vessel') ? h + b : h - m - p.line / 2) - dividerY - p.line / 2, '#ffffff', 'data-print-body-panel="true"'));
      art(m + imageInset + leftStrip, frameTop + imageInset, w - 2 * (m + imageInset) - leftStrip, dividerY - frameTop - 2 * imageInset);
      parts.push(`<g data-frame-divider="true">`, line(-b, dividerY, w + b, dividerY));
      frameCrosses(dividerY);
      parts.push('</g>');
      const rightInset = p.line / 2 + p.imageMargin;
      const rightWidth = Math.min(d.layout === 'overdrive' ? p.overdriveDecorationWidth : p.rightDecorationWidth, inner * 0.35);
      const rightX = w - m - rightInset - rightWidth;
      const rightTop = dividerY + rightInset;
      const bodyX = m + imageInset + leftStrip;
      if (d.layout !== 'overdrive') body(bodyX, top + imageHeight + 22, Math.max(1, (p.barcode ? rightX - 16 : w - start) - bodyX), bottom - top - imageHeight - 22);
      if (d.layout !== 'vessel') {
      const mini = p.decorationTextSize;
      const notice = c.rightDecoration.toUpperCase().split('\n').slice(0, 3);
      const noticeColor = pal.light;
      const noticeLeading = mini * 1.15;
      const noticeHeight = mini + 2 * noticeLeading;
      const barcodeHeight = p.barcode ? m + b : 0;
      const barcodeY = h - m;
      const hashInk = ink('#0123456789ABCDEF-', 17);
      const hashY = barcodeY - 3 - hashInk.descent;
      const logoBottom = hashY - hashInk.ascent - 4;
      const availableLogoHeight = Math.max(1, logoBottom - rightTop - noticeHeight - 5);
      const logoWidth = Math.min(rightWidth, availableLogoHeight * 592 / 614);
      const logoHeight = logoWidth * 614 / 592;
      const logoX = rightX + rightWidth - logoWidth;
      const logoY = logoBottom - logoHeight;
      if (d.layout === 'overdrive' && p.barcode) parts.push(rect(logoX - p.crossGap, h - m - p.line / 2 - 1.5, w - m - p.line / 2 - logoX + p.crossGap, p.line + 3, pal.background, 'data-barcode-rail-knockout="true"'));
      const fingerprint = titleFingerprint(c.title);
      parts.push(`<g data-right-decoration="true" data-title-hash="${fingerprint}">`);
      notice.forEach((text, i) => parts.push(`<text x="${rightX + rightWidth}" y="${rightTop + mini + i * noticeLeading}" text-anchor="end" fill="${noticeColor}" font-family="StudioBody" font-size="${mini}" font-weight="${p.decorationTextWeight}">${escapeXML(text)}</text>`));
      if (p.barcode) {
      // Reference image: circle centered at (296,307), three satellites at the measured positions.
      parts.push(`<svg data-rpa-logo="true" x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" viewBox="0 0 592 614"><defs><mask id="${prefix}-rpa-band"><rect width="592" height="614" fill="white"/><rect y="222" width="592" height="177" fill="black"/></mask></defs><circle cx="296" cy="307" r="307" fill="${pal.dark}" mask="url(#${prefix}-rpa-band)"/><g fill="${pal.dark}"><circle cx="41" cy="61" r="37"/><circle cx="41" cy="556" r="37"/><circle cx="545" cy="560" r="37"/><text x="296" y="380" font-family="StudioHeading" font-weight="700" font-size="195" text-anchor="middle" textLength="586" lengthAdjust="spacingAndGlyphs">RPA</text></g></svg>`);
      const formatHash = (count: number) => {
        const first = Math.ceil(count / 3), second = Math.ceil((count - first) / 2);
        return '#' + fingerprint.slice(0, first) + '-' + fingerprint.slice(first, first + second) + '-' + fingerprint.slice(first + second, count);
      };
      let hashCharacters = 16;
      while (hashCharacters > 6 && measure(formatHash(hashCharacters), 17, true, 700) > logoWidth) hashCharacters--;
      const displayHash = formatHash(hashCharacters);
      parts.push(`<text data-short-hash="true" x="${logoX}" y="${hashY}" fill="${pal.dark}" font-family="StudioHeading" font-weight="700" font-size="17" textLength="${logoWidth}" lengthAdjust="spacingAndGlyphs">${displayHash}</text>`);
      if (p.barcode) {
        const bits = '101' + [...fingerprint].map(char => parseInt(char, 16).toString(2).padStart(4, '0')).join('') + '101';
        const unit = logoWidth / bits.length;
        parts.push(`<g data-title-barcode="${fingerprint}">`);
        barcodeBars(bits, logoX, barcodeY, unit, barcodeHeight);
        parts.push('</g>');
      }
      }
      parts.push('</g>');
      }
      // Overdrive text uses the full width and composites over the decoration.
      if (d.layout === 'overdrive') body(bodyX, top + imageHeight + 22, w - m - imageInset - bodyX, bottom - top - imageHeight - 22);
    }
    const decorationTop = bandBottom + p.imageMargin;
    const stripWidth = d.layout === 'overdrive' ? 16 : p.leftDecorationWidth;
    if (p.hideFrameAbove) parts.push(rect(m - p.line / 2 - 1, bandBottom, p.line + 2, p.imageMargin + 1, pal.background, 'data-hide-frame-above="true"'));
    parts.push('<g data-left-decoration="true">');
    const codeY = decorationTop;
    const boxWidth = d.layout === 'overdrive' ? 15 : Math.min(15, stripWidth - 8), boxHeight = 25, boxGap = 7;
    const boxInset = p.line / 2 + 7; // Six clear units plus the box stroke half-width.
    const boxBottom = decorationBottom - boxInset;
    const boxesTop = boxBottom - 2 * boxHeight - boxGap;
    const codeSpace = Math.max(1, boxesTop - codeY - 10);
    const codeSize = Math.min(26, 26 * codeSpace / Math.max(1, measure(c.code, 26, true, 700)));
    const codeInk = ink(c.code, codeSize);
    // With 90-degree rotation, the underscore's descent becomes the left edge.
    const codeX = m - p.line / 2 + ink('_', codeSize).descent;
    if (c.code) {
      parts.push(rect(m - p.line / 2 - 3, codeY - 3, codeInk.ascent + codeInk.descent + p.line / 2 + 6, measure(c.code, codeSize, true, 700) + p.crossGap + 3, pal.background));
      parts.push(`<g transform="translate(${codeX} ${codeY}) rotate(90)">${label(c.code, 0, 0, codeSize, pal.text, codeSpace, true)}</g>`);
    }
    const mini = p.decorationTextSize, miniLeading = mini * 1.15;
    const textRight = m + p.line / 2 + stripWidth;
    const textLeft = codeX + codeInk.ascent + 4;
    const columnCount = Math.max(1, Math.floor((textRight - textLeft) / miniLeading));
    const decorationLines = wrapText(c.leftDecoration.toUpperCase(), codeSpace, mini, p.decorationTextWeight, measure);
    const placeholder = d.layout === 'overdrive' ? [] : decorationLines.slice(0, columnCount);
    const lastLine = placeholder[placeholder.length - 1] || '';
    const rightInk = measure.bodyInk?.(lastLine, mini, p.decorationTextWeight).ascent ?? mini * 0.75;
    const miniX = textRight - rightInk - (placeholder.length - 1) * miniLeading;
    placeholder.forEach((text, i) => parts.push(`<text data-decoration-column="${i}" transform="translate(${miniX + i * miniLeading} ${codeY}) rotate(90)" x="0" y="0" fill="${pal.light}" font-family="StudioBody" font-size="${mini}" font-weight="${p.decorationTextWeight}">${escapeXML(text)}</text>`));
    if (d.layout === 'overdrive') {
      const smallTop = codeY + measure(c.code, codeSize, true, 700) + p.crossGap;
      const smallSpace = Math.max(1, boxesTop - smallTop - 8);
      const smallLines = wrapText(c.leftDecoration.toUpperCase(), smallSpace, mini, p.decorationTextWeight, measure).slice(0, 3);
      const lastInk = measure.bodyInk?.(smallLines[smallLines.length - 1] || '', mini, p.decorationTextWeight).ascent ?? mini * 0.75;
      const smallX = codeX + codeInk.ascent - lastInk - (smallLines.length - 1) * miniLeading;
      smallLines.forEach((text, i) => parts.push(`<text data-overdrive-id-note="${i}" transform="translate(${smallX + i * miniLeading} ${smallTop}) rotate(90)" fill="${pal.light}" font-family="StudioBody" font-size="${mini}" font-weight="${p.decorationTextWeight}">${escapeXML(text)}</text>`));
    }
    if (boxesTop > codeY) for (let i = 0; i < 2; i++) {
      const boxX = m + boxInset, boxY = boxesTop + i * (boxHeight + boxGap);
      parts.push(rect(boxX, boxY, boxWidth, boxHeight, pal.background, `data-decoration-box="${i}" rx="4" stroke="${pal.light}" stroke-width="1.5"`));
      parts.push(`<text transform="translate(${boxX + boxWidth / 2} ${boxY + boxHeight / 2}) rotate(90)" text-anchor="middle" dominant-baseline="central" fill="${pal.light}" font-family="StudioHeading" font-weight="700" font-size="8">${i === 0 ? '03' : '42'}</text>`);
    }
    parts.push('</g>');
    const showBottomBarcode = p.bottomBarcode && (d.layout === 'character' || d.layout === 'vessel');
    const footerOnRail = d.layout === 'objective' || d.layout === 'overdrive';
    const footerX = footerOnRail ? m + p.cross + p.crossGap + 24 : showBottomBarcode ? edgeBarX + edgeBarWidth + edgeBarGap : start;
    const footerWidth = inner * 0.66 - (footerX - start);
    const footerSize = Math.min(12, 12 * footerWidth / Math.max(1, measure(c.footer, 12, true, 700)));
    const footerInk = ink(c.footer, footerSize);
    const footerY = footerOnRail ? h - m - p.line / 2 + footerInk.ascent : (d.layout === 'character' || d.layout === 'vessel') ? h - m + footerInk.ascent : h - m + 23;
    if (footerOnRail) {
      const footerHeight = Math.max(p.line + 2, footerInk.ascent + footerInk.descent + 2);
      parts.push(rect(footerX - 4, h - m - p.line / 2 - 1, measure(c.footer, footerSize, true, 700) + 8, footerHeight, pal.background, 'data-footer-knockout="true"'));
    }
    if (showBottomBarcode) edgeBarcode('08', edgeBarX, h - m, edgeBarWidth, m + b, 'bottom');
    parts.push(label(c.footer, footerX, footerY, 12, pal.light, footerWidth, true));

    // Center the simple incoming mark in the upright; optional artwork can override it.
    if (!d.symbolImage) {
      const centerX = symbolX + uprightWidth / 2;
      const uprightHeight = Math.max(1, bandTop - symbolY);
      const logoSize = 1.5 * Math.min(uprightWidth * 0.7, uprightHeight * 0.64);
      const logoInk = ink('>', logoSize, p.titleWeight);
      const microSize = p.decorationTextSize;
      const microLeading = microSize * 1.15;
      const gap = microSize * 0.6;
      const blockHeight = logoInk.ascent + logoInk.descent + gap + microLeading * 2;
      const logoBaseline = symbolY + (uprightHeight - blockHeight) / 2 + logoInk.ascent;
      const logoLeft = centerX - logoInk.width / 2;
      const microY = logoBaseline + logoInk.descent + gap + microSize;
      parts.push(`<g data-incoming-logo="true" fill="${pal.background}" text-anchor="middle"><text x="${centerX}" y="${logoBaseline}" font-family="StudioHeading" font-weight="${p.titleWeight}" font-size="${logoSize}">&gt;</text><text fill="${pal.light}" text-anchor="start" x="${logoLeft}" y="${microY}" font-family="StudioBody" font-weight="${p.decorationTextWeight}" font-size="${microSize}">INCOMING</text><text fill="${pal.light}" text-anchor="start" x="${logoLeft}" y="${microY + microLeading}" font-family="StudioBody" font-weight="${p.decorationTextWeight}" font-size="${microSize}">ID NO#</text></g>`);
    }
    if (d.symbolImage) {
      const logoPad = 4;
      parts.push(`<image href="${d.symbolImage}" x="${symbolX + logoPad}" y="${symbolY + logoPad}" width="${Math.max(1, uprightWidth - 2 * logoPad)}" height="${Math.max(1, bandTop - symbolY - 2 * logoPad)}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    // Composite labels last: each clears only its own short section of rail.
    const hasDivider = d.layout !== 'objective';
    const actionStart = hasDivider ? decorationBottom : frameTop;
    const actionSpan = h - m - actionStart;
    inlineLabel(c.inlineLeft, m, actionStart + actionSpan * 0.42, true, actionSpan * 0.6, 'left');
    if (hasDivider) inlineLabel(c.inlineDivider, m + (w - 2 * m) * 0.42, decorationBottom, false, (w - 2 * m) * 0.55, 'divider');
    else inlineLabel(c.inlineDivider, m + (w - 2 * m) * 0.65, h - m, false, (w - 2 * m) * 0.5, 'divider');
    const imageSpan = decorationBottom - frameTop;
    inlineLabel(c.inlineRight, w - m, frameTop + imageSpan * 0.2, true, Math.max(1, imageSpan * 0.3 - p.cross - p.crossGap), 'right');
  }
  const width = dim.width + (bleed ? 10 : 0), height = dim.height + (bleed ? 10 : 0);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${-b} ${-b} ${w + 2 * b} ${h + 2 * b}" role="img" aria-label="${escapeXML(d.layout + ' layout preview')}"><defs><style>${assets.css}</style><clipPath id="${prefix}-outline"><rect x="${-b}" y="${-b}" width="${w + 2 * b}" height="${h + 2 * b}" rx="${bleed ? 0 : radius}"/></clipPath></defs><g clip-path="url(#${prefix}-outline)">${parts.join('')}</g></svg>`, warnings, ...dim, width, height };
}
