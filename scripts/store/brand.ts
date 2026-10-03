// The SpotOn mark (heart pin, 96-unit grid, as in LoadingScreen/InstallGate) and the store graphics
// built from it. Rendered to PNG by scripts/store/capture.spec.ts.

const BRAND = '#16A064';
const SURFACE = '#0E1013';
const PIN = 'M48 78S26 60 26 41a22 22 0 0 1 44 0c0 19-22 37-22 37z';
const HEART =
  'M48 49.5s-9-5.2-9-10.9c0-3 2.2-5.1 4.9-5.1 1.8 0 3.3 1 4.1 2.4.8-1.4 2.3-2.4 4.1-2.4 2.7 0 4.9 2.1 4.9 5.1 0 5.7-9 10.9-9 10.9z';

/** The white mark, scaled around the grid centre (1 = as in the app tile). */
function mark(scale: number): string {
  return `<g transform="translate(48 48) scale(${scale}) translate(-48 -48)">
    <path d="${PIN}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
    <path d="${HEART}" fill="#fff"/></g>`;
}

const page = (w: number, h: number, body: string) =>
  `<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${body}</body></html>`;

/**
 * Full-bleed square icon: the Play listing icon (Google applies the rounded mask) and the manifest's
 * maskable icons (`safe` keeps the mark inside the 80 % safe circle).
 */
export function squareIcon(size: number, safe: boolean): string {
  return page(size, size, `<svg width="${size}" height="${size}" viewBox="0 0 96 96">
    <rect width="96" height="96" fill="${BRAND}"/>${mark(safe ? 0.82 : 1)}</svg>`);
}

/** The 1024×500 Play feature graphic: the app tile, the name and the tagline on the app background. */
export function featureGraphic(tagline: string): string {
  return page(1024, 500, `<div style="width:1024px;height:500px;background:${SURFACE};display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:22px;font-family:Inter,'Noto Sans',system-ui,sans-serif">
    <svg width="132" height="132" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${BRAND}"/>${mark(1)}</svg>
    <div style="color:#F4F5F7;font-size:64px;font-weight:700;letter-spacing:-1px;line-height:1">SpotOn</div>
    <div style="color:rgb(235 238 245 / 0.68);font-size:28px;line-height:1.2">${tagline}</div></div>`);
}
