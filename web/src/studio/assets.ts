import defaultOverdriveArtwork from './images/corvette_ambush.jpg?url';
import defaultArtwork from './images/gunship_exploration.jpg?url';
import defaultObjectiveArtwork from './images/minefield_vertical.jpg?url';
import trade from '../../../trade_trait.png?url';
import military from '../../../military_trait.png?url';
import exploration from '../../../exploration_trait.png?url';
import science from '../../../science_trait.png?url';
import diplomacy from '../../../diplomacy_trait.png?url';
import heading from './fonts/Orbitron-Variable.ttf?url';
import regular from '../../../fonts/TitilliumWeb-Regular.ttf?url';
import semibold from '../../../fonts/TitilliumWeb-SemiBold.ttf?url';
import bold from '../../../fonts/TitilliumWeb-Bold.ttf?url';
import { traits } from './model';
export type Assets = { icons: Record<string, string>; css: string; defaultArtwork?: string; defaultObjectiveArtwork?: string; defaultOverdriveArtwork?: string };
export function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Could not read the file.')); r.readAsDataURL(blob); });
}
export async function loadAssets(): Promise<Assets> {
  const urls = [trade, military, exploration, science, diplomacy, heading, regular, bold, semibold, defaultArtwork, defaultObjectiveArtwork, defaultOverdriveArtwork];
  const data = await Promise.all(urls.map(async url => { const response = await fetch(url); if (!response.ok) throw new Error('Could not load local fonts or symbols.'); return dataURL(await response.blob()); }));
  const css = `@font-face{font-family:StudioHeading;src:url('${data[5]}');font-weight:400 900}@font-face{font-family:StudioBody;src:url('${data[6]}');font-weight:400}@font-face{font-family:StudioBody;src:url('${data[7]}');font-weight:700}@font-face{font-family:StudioBody;src:url('${data[8]}');font-weight:600}`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  await Promise.all([document.fonts.load('700 48px StudioHeading'), document.fonts.load('400 30px StudioBody'), document.fonts.load('700 30px StudioBody'), document.fonts.load('600 30px StudioBody')]);
  return { icons: Object.fromEntries(traits.map((t, i) => [t, data[i]])), css, defaultArtwork: data[9], defaultObjectiveArtwork: data[10], defaultOverdriveArtwork: data[11] };
}
