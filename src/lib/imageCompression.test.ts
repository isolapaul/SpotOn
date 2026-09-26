import { beforeEach, describe, expect, it, vi } from 'vitest';

const libMock = vi.hoisted(() => vi.fn(async (file: File) => file));
vi.mock('browser-image-compression', () => ({ default: libMock }));

import { COMPRESSION_PRESETS, compressImage } from './imageCompression';
import * as oracle from './__oracles__/legacy';

describe('COMPRESSION_PRESETS (characterisation: options per call site)', () => {
  it.each([
    ['spot', oracle.IMAGE_COMPRESSION_OPTIONS],
    ['profileStore', oracle.compressProfileImageOptions],
    ['settingsProfilePicture', oracle.settingsProfilePictureOptions],
    ['settingsBanner', oracle.settingsBannerOptions],
    ['feedback', oracle.feedbackOptions],
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
    expect(options).toEqual(oracle.IMAGE_COMPRESSION_OPTIONS);
    expect(options).not.toBe(COMPRESSION_PRESETS.spot);
    expect('fileType' in options).toBe(false);
  });

  it('adds fileType for the JPEG retry, as the stores did', async () => {
    await compressImage(file, 'profileStore', 'image/jpeg');
    const [, options] = libMock.mock.calls[0] as unknown as [File, object];
    expect(options).toEqual({ ...oracle.compressProfileImageOptions, fileType: 'image/jpeg' });
  });

  it('returns the library result', async () => {
    const out = new File(['y'], 'b.jpg', { type: 'image/jpeg' });
    libMock.mockResolvedValueOnce(out);
    await expect(compressImage(file, 'feedback')).resolves.toBe(out);
  });
});
