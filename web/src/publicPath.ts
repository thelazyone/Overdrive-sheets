/**
 * Resolve URLs for static files copied into `dist/` (e.g. shared `resources/`)
 * so they work with Vite `base` (local `/`, GitHub Pages `/repo/overdrive/`).
 */
export function publicAsset(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  const p = relativePath.replace(/^\//, "");
  return `${base}${p}`;
}
