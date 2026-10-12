// Draws and shares a spot's story card (growth plan §6). Canvas drawing over lib/shareCard's
// layout; the photo loads with CORS, and a photo the canvas may not export falls back to the
// brand background (the card still works).
import type { Spot } from '@/store/useSpotStore';
import { CARD, coverRect, wrapLines } from '@/lib/shareCard';
import { getPreviewImageUrl, PLACEHOLDER_URL, sortSpotImagesByLikes } from '@/lib/spotImages';
import { averageRating } from '@/lib/rating';
import { isNativeApp } from '@/lib/nativeApp';

export interface CardTexts {
  category: string;
  /** "4,6 · 12 reviews", or empty without reviews. */
  rating: string;
  cta: string;
  link: string;
}

const FONT = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, Inter, system-ui, sans-serif';
const BRAND = '#16a064';

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The app mark (the icon's pin and heart), as on the start screen. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 96, size / 96);
  ctx.fillStyle = BRAND;
  roundRect(ctx, 0, 0, 96, 96, 22);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M48 78S26 60 26 41a22 22 0 0 1 44 0c0 19-22 37-22 37z'));
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D('M48 49.5s-9-5.2-9-10.9c0-3 2.2-5.1 4.9-5.1 1.8 0 3.3 1 4.1 2.4.8-1.4 2.3-2.4 4.1-2.4 2.7 0 4.9 2.1 4.9 5.1 0 5.7-9 10.9-9 10.9z'));
  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rating: number) {
  const star = new Path2D('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(x + i * (size + 10), y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = i < Math.round(rating) ? '#ffd166' : 'rgba(255,255,255,.28)';
    ctx.fill(star);
    ctx.restore();
  }
  return x + 5 * (size + 10);
}

async function draw(spot: Spot, texts: CardTexts, withPhoto: boolean): Promise<HTMLCanvasElement> {
  const { width: W, height: H, margin: M } = CARD;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');

  // Background: the photo (cover), else the brand gradient.
  const url = getPreviewImageUrl(spot, sortSpotImagesByLikes(spot.spotImages || [], 'bothRequired'));
  const img = withPhoto && url && url !== PLACEHOLDER_URL ? await loadImage(url) : null;
  if (img) {
    const r = coverRect(img.naturalWidth, img.naturalHeight, W, H);
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a3d27');
    g.addColorStop(1, '#16a064');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Shades for the text: a light one at the top, a deep one at the bottom.
  const top = ctx.createLinearGradient(0, 0, 0, 420);
  top.addColorStop(0, 'rgba(0,0,0,.5)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 420);
  const bottom = ctx.createLinearGradient(0, H * 0.45, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,.88)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);

  // Brand, top left.
  drawMark(ctx, M, M, 88);
  ctx.fillStyle = '#fff';
  ctx.font = `700 52px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('SpotOn', M + 112, M + 46);

  // From the bottom up: link, call to action, rating, name, category.
  ctx.textBaseline = 'alphabetic';
  let y = H - M;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillText(texts.link, M, y);
  y -= 62;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillStyle = '#7ee2b0';
  ctx.fillText(texts.cta, M, y);
  y -= 96;
  if (texts.rating) {
    const after = drawStars(ctx, M, y - 44, 48, averageRating(spot.reviews));
    ctx.font = `600 42px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(texts.rating, after + 12, y);
    y -= 96;
  }
  ctx.font = `800 96px ${FONT}`;
  ctx.fillStyle = '#fff';
  const lines = wrapLines(spot.name, W - 2 * M, 3, (s) => ctx.measureText(s).width);
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], M, y);
    y -= 108;
  }
  y -= 8;
  ctx.font = `600 36px ${FONT}`;
  const chipW = ctx.measureText(texts.category).width + 56;
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  roundRect(ctx, M, y - 52, chipW, 68, 34);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(texts.category, M + 28, y - 6);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Empty card'))), 'image/png');
  });
}

/** The card as a PNG; a photo the canvas may not export (no CORS) is left out. */
export async function renderSpotCard(spot: Spot, texts: CardTexts): Promise<Blob> {
  try {
    return await toBlob(await draw(spot, texts, true));
  } catch {
    return toBlob(await draw(spot, texts, false));
  }
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export type CardShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Shares the card as an image: the native share sheet in the apps (through a cache file), Web
 * Share with files where supported, else a download.
 */
export async function shareSpotCard(spot: Spot, texts: CardTexts, url: string): Promise<CardShareOutcome> {
  const blob = await renderSpotCard(spot, texts);
  const name = `spoton-${spot.id}.png`;
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const written = await Filesystem.writeFile({ path: name, data: await base64Of(blob), directory: Directory.Cache });
    try {
      await Share.share({ title: spot.name, url, files: [written.uri] });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
      throw error;
    }
  }
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: spot.name, url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return 'downloaded';
}
