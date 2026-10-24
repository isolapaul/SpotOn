import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const libMock = vi.hoisted(() => vi.fn(async (file: File) => file));
vi.mock('browser-image-compression', () => ({ default: libMock }));

import { COMPRESSION_PRESETS, compressImage } from './imageCompression';
/** Spot photos since v2.3.1: near the original (until then 1280 px / 0.3 MB). */
const SPOT_OPTIONS = { maxSizeMB: 4.5, maxWidthOrHeight: 2560, initialQuality: 0.92, useWebWorker: false };
/** The options each call site passed before T23 moved them here (useWebWorker: false since T14). */
const PROFILE_STORE_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false };
const SETTINGS_PROFILE_PICTURE_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: false };
const SETTINGS_BANNER_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false };
const FEEDBACK_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: false };

describe('COMPRESSION_PRESETS (characterisation: options per call site)', () => {
  it.each([
    ['spot', SPOT_OPTIONS],
    ['profileStore', PROFILE_STORE_OPTIONS],
    ['settingsProfilePicture', SETTINGS_PROFILE_PICTURE_OPTIONS],
    ['settingsBanner', SETTINGS_BANNER_OPTIONS],
    ['feedback', FEEDBACK_OPTIONS],
  ] as const)('%s', (preset, expected) => {
    expect(COMPRESSION_PRESETS[preset]).toEqual(expected);
    expect(Object.keys(COMPRESSION_PRESETS[preset])).toEqual(Object.keys(expected));
  });
});

describe('compressImage', () => {
  beforeEach(() => libMock.mockClear());

  const file = new File(['x'], 'a.png', { type: 'image/png' });

  it('passes a copy of the preset options', async () => {
    await compressImage(file, 'spot');
    expect(libMock).toHaveBeenCalledTimes(1);
    const [passedFile, options] = libMock.mock.calls[0] as unknown as [File, object];
    expect(passedFile).toBe(file);
    expect(options).toEqual(SPOT_OPTIONS);
    expect(options).not.toBe(COMPRESSION_PRESETS.spot);
    expect('fileType' in options).toBe(false);
  });

  it('adds fileType for the JPEG retry, as the stores did', async () => {
    await compressImage(file, 'profileStore', 'image/jpeg');
    const [, options] = libMock.mock.calls[0] as unknown as [File, object];
    expect(options).toEqual({ ...PROFILE_STORE_OPTIONS, fileType: 'image/jpeg' });
  });

  it('returns the library result', async () => {
    const out = new File(['y'], 'b.jpg', { type: 'image/jpeg' });
    libMock.mockResolvedValueOnce(out);
    await expect(compressImage(file, 'feedback')).resolves.toBe(out);
  });
});

/** The Storage rules' upload limit in bytes (`request.resource.size < N * 1024 * 1024`). */
function storageRuleLimit(): number {
  const match = /request\.resource\.size < (\d+) \* 1024 \* 1024/.exec(readFileSync('storage.rules', 'utf8'));
  if (!match) throw new Error('size limit not found in storage.rules');
  return Number(match[1]) * 1024 * 1024;
}

describe('presets and the Storage rules', () => {
  it('keep every Storage upload under the rules limit', () => {
    for (const preset of ['spot', 'profileStore'] as const) {
      expect(COMPRESSION_PRESETS[preset].maxSizeMB * 1024 * 1024).toBeLessThan(storageRuleLimit());
    }
  });
  it('keep spot photos sharp on a full phone screen', () => {
    expect(COMPRESSION_PRESETS.spot.maxWidthOrHeight).toBeGreaterThanOrEqual(2048);
    expect(COMPRESSION_PRESETS.spot.initialQuality).toBeGreaterThanOrEqual(0.9);
  });
});
