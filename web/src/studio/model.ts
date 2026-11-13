import preset from './preset';
import { z } from 'zod';

export const traits = ['Trade', 'Military', 'Exploration', 'Science', 'Diplomacy'] as const;
export const layouts = ['character', 'objective', 'overdrive', 'vessel', 'open'] as const;
export type Layout = typeof layouts[number];
export const formats = {
  poker: { name: 'European poker', width: 63, height: 88, rounded: true },
  bridge: { name: 'Bridge', width: 57, height: 89, rounded: true },
  tarot: { name: 'Tarot', width: 70, height: 120, rounded: true },
  a4: { name: 'A4 sheet', width: 210, height: 297, rounded: false },
  a5: { name: 'A5 sheet', width: 148, height: 210, rounded: false },
  custom: { name: 'Custom', width: 63, height: 88, rounded: true },
} as const;
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const paletteSchema = z.object({ background: color, dark: color, light: color, text: color, accent: color });
export type Palette = z.infer<typeof paletteSchema>;
export const colorPalette: Palette = { background: '#080909', dark: '#383b3c', light: '#a8aaa8', text: '#ffffff', accent: '#f3b500' };
export const printPalette: Palette = { background: '#ffffff', dark: '#dddddd', light: '#7b7b7b', text: '#161616', accent: '#161616' };
const previousLeftDecoration = 'The identity of the individual is Property of Reclaim and Prospecting Authority.\nAny breach of the identity contract is punishable with indented servitude.\nIndividuals are hereby accepting the T&C.';
const uppercaseLeftDecoration = 'INDIVIDUALS ARE HEREBY ACCEPTING THE T&C.\nBREACH OF CONTRACT IS PUNISHABLE WITH INDENTED SERVITUDE.\nTHE IDENTITY OF THE INDIVIDUAL IS PROPERTY OF RECLAIM AND PROSPECTING AUTHORITY.';
export const defaultLeftDecoration = 'Individuals are hereby accepting the T&C.\nBreach of contract is punishable with indented servitude.\nThe identity of the individual is Property of Reclaim and Prospecting Authority.';
const contentSchema = z.object({ inlineLeft: z.string().max(200).default('RPA // VERIFIED'), inlineDivider: z.string().max(200).default('OVERDRIVE // FIELD RECORD'), inlineRight: z.string().max(200).default('VESSEL // REGISTERED'), topDecoration: z.string().max(200).default('FULL SPECTRUM OVERDRIVE'), rightDecoration: z.string().max(12000).default(defaultLeftDecoration), leftDecoration: z.string().max(12000).default(defaultLeftDecoration).transform(value => (value === previousLeftDecoration || value === uppercaseLeftDecoration) ? defaultLeftDecoration : value), title: z.string().max(200), subtitle: z.string().max(200), heading: z.string().max(200), body: z.string().max(12000), code: z.string().max(100), footer: z.string().max(200), points: z.string().max(20), traits: z.array(z.enum(traits)).max(5), artwork: z.string().max(12000000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)), imageHorizontal: z.enum(['left', 'center', 'right']).default('center'), imagePosition: z.number().min(0).max(100) });
const bodyWeightSchema = z.union([z.literal(400), z.literal(600), z.literal(700)]);
const lineSpacingSchema = z.number().min(-24).max(40);
export const parameterSchema = z.object({ bodyLineSpacings: z.object({ character: lineSpacingSchema.optional(), objective: lineSpacingSchema.optional(), overdrive: lineSpacingSchema.optional(), vessel: lineSpacingSchema.optional(), open: lineSpacingSchema.optional() }).default({ objective: 2, overdrive: 2 }), bodyWeights: z.object({ character: bodyWeightSchema.optional(), objective: bodyWeightSchema.optional(), overdrive: bodyWeightSchema.optional(), vessel: bodyWeightSchema.optional(), open: bodyWeightSchema.optional() }).default({}), line: z.number().min(0.5).max(5), inset: z.number().min(24).max(65), cross: z.number().min(4).max(22), topLeftContinuation: z.boolean().default(true), crossGap: z.number().min(0).max(24).default(3), vesselTitleInset: z.number().min(0).max(150).default(48), titleInset: z.number().min(0).max(150).default(70), titleGap: z.number().min(0).max(80).default(16), titleOffset: z.number().min(0).max(150).default(0), symbolUprightExtra: z.number().min(0).max(80).default(0), topBarcode: z.boolean().default(true), bottomBarcode: z.boolean().default(true), traitsBarcode: z.boolean().default(true), traitSize: z.number().min(16).max(80).default(40), traitSpacing: z.number().min(0).max(40).default(9), overdriveDecorationWidth: z.number().min(80).max(240).default(110), rightDecorationWidth: z.number().min(80).max(240).default(150), symbolWidth: z.number().min(20).max(120).default(52), symbolHeight: z.number().min(20).max(150).default(76), symbolX: z.number().min(-40).max(80).default(0), symbolY: z.number().min(-80).max(80).default(0), symbolGap: z.number().min(0).max(24).default(6), symbolReserve: z.boolean().default(true), symbolKnockout: z.boolean().default(true), titleSpacing: z.number().min(0).max(12).default(0), titleWeight: z.number().min(400).max(900).default(700), barThickness: z.number().min(1).max(24).default(7), subtitleWeight: z.number().min(400).max(900).default(700), hideFrameAbove: z.boolean().default(true), subtitleSize: z.number().min(10).max(48).default(23), titleSize: z.number().min(24).max(64), bodySize: z.number().min(16).max(44), weight: z.union([z.literal(400), z.literal(600), z.literal(700)]), leading: z.number().min(1).max(1.6), lineSpacing: z.number().min(-24).max(40).default(-6), effectHeadingSize: z.number().min(12).max(64).default(38), effectHeadingGap: z.number().min(-24).max(64).default(6), decorationTextWeight: z.number().min(400).max(700).default(400), decorationTextSize: z.number().min(2).max(10).transform(value => Math.min(6, value)).default(5), leftDecorationWidth: z.number().min(24).max(120).default(42), imageMargin: z.number().min(0).max(40).default(10), objectProtrusion: z.boolean().default(true), objectiveArtShare: z.number().min(20).max(70).default(33), textFrameMargin: z.number().min(0).max(50).default(18), textFrameColor: z.union([z.literal(''), z.literal('background'), color]).default(''), shieldBarcode: z.boolean().default(true), vesselArtShare: z.number().min(30).max(72).default(66), overdriveArtShare: z.number().min(30).max(72).default(55), artShare: z.number().min(30).max(72), barcode: z.boolean() });
export const defaultParameters: z.infer<typeof parameterSchema> = parameterSchema.parse(preset.parameters);
export const designSchema = z.object({ version: z.literal(1), symbolImage: z.string().max(12000000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)).default(''), layout: z.enum(layouts), format: z.enum(['poker', 'bridge', 'tarot', 'a4', 'a5', 'custom']), orientation: z.enum(['portrait', 'landscape']), customWidth: z.number().min(30).max(420), customHeight: z.number().min(30).max(420), customRounded: z.boolean(), mode: z.enum(['color', 'print']), palettes: z.object({ color: paletteSchema, print: paletteSchema }), parameters: parameterSchema, content: z.object({ character: contentSchema, objective: contentSchema, overdrive: contentSchema, vessel: contentSchema.default(preset.content.vessel), open: contentSchema }) });
export type Design = z.infer<typeof designSchema>;
export function newDesign(): Design {
  return designSchema.parse(preset);
}
export function dimensions(d: Design) {
  const f = formats[d.format];
  const a = d.format === 'custom' ? d.customWidth : f.width;
  const b = d.format === 'custom' ? d.customHeight : f.height;
  const [short, long] = [Math.min(a, b), Math.max(a, b)];
  return { width: d.orientation === 'landscape' ? long : short, height: d.orientation === 'landscape' ? short : long, rounded: d.format === 'custom' ? d.customRounded : f.rounded };
}
