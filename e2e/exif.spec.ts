import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { COMPRESSION_PRESETS, type CompressionPreset } from '../src/lib/imageCompression';

// Privacy check: every photo upload path goes through compressImage (src/lib/imageCompression.ts),
// so none of them may keep GPS EXIF. browser-image-compression always returns a canvas re-encode
// (never the original file, even when the re-encode is larger); it copies EXIF back only with
// `preserveExif`, which no preset sets. This spec proves it in a real browser (canvas encoders),
// with the library build the app bundles and the app's presets. It needs no emulator or app page.

const require = createRequire(import.meta.url);
const LIB = require.resolve('browser-image-compression/dist/browser-image-compression.js');

// GPS position in the fake EXIF: 47° 29' 52.44" N, 19° 2' 24.72" E (distinctive rationals).
const LAT: [number, number][] = [[47, 1], [29, 1], [5244, 100]];
const LON: [number, number][] = [[19, 1], [2, 1], [2472, 100]];

/** A little-endian TIFF/EXIF block with IFD0 → GPS IFD (lat/lon with refs), as cameras write it. */
function gpsExifTiff(): number[] {
  const buf = new DataView(new ArrayBuffer(128));
  const u16 = (o: number, v: number) => buf.setUint16(o, v, true);
  const u32 = (o: number, v: number) => buf.setUint32(o, v, true);
  u16(0, 0x4949); u16(2, 42); u32(4, 8); // "II", 42, IFD0 at 8
  u16(8, 1); // IFD0: one entry, GPSInfo pointer → GPS IFD at 26
  u16(10, 0x8825); u16(12, 4); u32(14, 1); u32(18, 26); u32(22, 0);
  u16(26, 4); // GPS IFD: 4 entries, rationals at 80 and 104
  const entry = (i: number, tag: number, type: number, count: number, value: number, ascii?: string) => {
    const o = 28 + i * 12;
    u16(o, tag); u16(o + 2, type); u32(o + 4, count);
    if (ascii) { buf.setUint8(o + 8, ascii.charCodeAt(0)); buf.setUint8(o + 9, 0); } else u32(o + 8, value);
  };
  entry(0, 0x0001, 2, 2, 0, 'N');
  entry(1, 0x0002, 5, 3, 80);
  entry(2, 0x0003, 2, 2, 0, 'E');
  entry(3, 0x0004, 5, 3, 104);
  u32(76, 0); // no next IFD
  [...LAT, ...LON].forEach(([n, d], i) => { u32(80 + i * 8, n); u32(84 + i * 8, d); });
  return [...new Uint8Array(buf.buffer)];
}

/** The latitude seconds rational (5244/100, little-endian) as bytes: present only if GPS data survived. */
const LAT_SECONDS_BYTES = [0x7c, 0x14, 0, 0, 0x64, 0, 0, 0];

interface Input { width: number; height: number; quality: number; paddingBytes: number; noise: number }

interface Result { inSize: number; outSize: number; outType: string; inHasGps: boolean; outHasExif: boolean; outHasGps: boolean }

const INPUTS: Record<string, Input> = {
  // Already heavily compressed: the library's re-encode at quality 1 is larger than the original,
  // so it enters its quality loop (the case where returning the original would keep EXIF).
  'small, heavily compressed original': { width: 640, height: 480, quality: 0.3, paddingBytes: 0, noise: 40 },
  // Padded with a large comment: the re-encode is smaller and under the size limit (early return).
  'small, padded original': { width: 400, height: 300, quality: 0.9, paddingBytes: 200_000, noise: 20 },
  // A phone-sized photo: over every size limit, resized and re-encoded.
  'large photo': { width: 3000, height: 2250, quality: 0.92, paddingBytes: 0, noise: 60 },
};

async function compressInBrowser(
  page: import('@playwright/test').Page,
  input: Input,
  options: Record<string, unknown>,
): Promise<Result> {
  return page.evaluate(async ({ input, options, tiff, latSeconds }) => {
    const find = (hay: Uint8Array, needle: number[]) => {
      outer: for (let i = 0; i + needle.length <= hay.length; i++) {
        for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
        return true;
      }
      return false;
    };
    const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

    // A noisy gradient photo stand-in, encoded as JPEG by the browser.
    const canvas = document.createElement('canvas');
    canvas.width = input.width; canvas.height = input.height;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(input.width, input.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4, x = p % input.width, y = Math.floor(p / input.width);
      const n = () => (Math.random() - 0.5) * input.noise;
      img.data[i] = (x * 255) / input.width + n();
      img.data[i + 1] = (y * 255) / input.height + n();
      img.data[i + 2] = 128 + n();
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const base = new Uint8Array(await (await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', input.quality))).arrayBuffer());

    // SOI, APP1 "Exif" with the GPS IFD, optional COM padding, then the rest of the browser's JPEG.
    const app1Len = 2 + EXIF_HEADER.length + tiff.length;
    const app1 = [0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...EXIF_HEADER, ...tiff];
    const parts: BlobPart[] = [base.slice(0, 2), new Uint8Array(app1)];
    for (let left = input.paddingBytes; left > 0;) {
      const len = Math.min(left, 65_000);
      const com = new Uint8Array(len + 4);
      com.set([0xff, 0xfe, (len + 2) >> 8, (len + 2) & 0xff]);
      parts.push(com);
      left -= len;
    }
    parts.push(base.slice(2));
    const file = new File(parts, 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    const inBytes = new Uint8Array(await file.arrayBuffer());

    const lib = (globalThis as unknown as { imageCompression: (f: File, o: object) => Promise<Blob> }).imageCompression;
    const out = await lib(file, options);
    const outBytes = new Uint8Array(await out.arrayBuffer());
    return {
      inSize: file.size,
      outSize: out.size,
      outType: out.type,
      inHasGps: find(inBytes, latSeconds),
      outHasExif: find(outBytes, EXIF_HEADER),
      outHasGps: find(outBytes, latSeconds),
    };
  }, { input, options, tiff: gpsExifTiff(), latSeconds: LAT_SECONDS_BYTES });
}

test.describe('uploads strip GPS EXIF (browser-image-compression, app presets)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent('<!doctype html><title>exif</title>');
    await page.addScriptTag({ path: LIB });
  });

  for (const [name, input] of Object.entries(INPUTS)) {
    for (const preset of Object.keys(COMPRESSION_PRESETS) as CompressionPreset[]) {
      test(`${name}, preset ${preset}`, async ({ page }) => {
        const r = await compressInBrowser(page, input, { ...COMPRESSION_PRESETS[preset] });
        test.info().annotations.push({ type: 'sizes', description: `${r.inSize} → ${r.outSize} bytes, ${r.outType}` });
        expect(r.inHasGps).toBe(true);
        expect(r.outType).toBe('image/jpeg');
        expect(r.outHasExif).toBe(false);
        expect(r.outHasGps).toBe(false);
      });
    }
  }

  test('the JPEG retry (fileType forced) strips it too', async ({ page }) => {
    const r = await compressInBrowser(page, INPUTS['small, heavily compressed original'], { ...COMPRESSION_PRESETS.spot, fileType: 'image/jpeg' });
    expect(r.inHasGps).toBe(true);
    expect(r.outHasExif).toBe(false);
    expect(r.outHasGps).toBe(false);
  });

  // Control: the detector does see GPS data that survives (the library's opt-in preserveExif).
  test('control: preserveExif would keep it', async ({ page }) => {
    const r = await compressInBrowser(page, INPUTS['small, heavily compressed original'], { ...COMPRESSION_PRESETS.spot, preserveExif: true });
    expect(r.outHasExif).toBe(true);
    expect(r.outHasGps).toBe(true);
  });
});
