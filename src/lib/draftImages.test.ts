import { describe, expect, it } from 'vitest';
import { checkDraftImages, primaryAfterRemoval } from './draftImages';
import { MAX_SPOT_IMAGES, MAX_UPLOAD_BYTES } from './constants';

const file = (bytes: number, name = 'a.jpg') => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

describe('checkDraftImages', () => {
  it('accepts files within the size and count limits', () => {
    const picked = [file(10), file(MAX_UPLOAD_BYTES)];
    expect(checkDraftImages(0, picked)).toEqual({ accepted: picked, error: null });
  });

  it('drops only the files over the size limit', () => {
    const small = file(10);
    expect(checkDraftImages(0, [small, file(MAX_UPLOAD_BYTES + 1)])).toEqual({ accepted: [small], error: 'imageTooLarge' });
  });

  it('refuses the whole pick when it would exceed the image limit', () => {
    expect(checkDraftImages(MAX_SPOT_IMAGES - 1, [file(1), file(1)])).toEqual({ accepted: [], error: 'maxSpotImages' });
    expect(checkDraftImages(MAX_SPOT_IMAGES - 1, [file(1)]).error).toBeNull();
  });
});

describe('primaryAfterRemoval', () => {
  it('falls back to the first image when the primary is removed', () => {
    expect(primaryAfterRemoval(2, 2)).toBe(0);
  });
  it('shifts down when an earlier image is removed', () => {
    expect(primaryAfterRemoval(2, 0)).toBe(1);
  });
  it('stays when a later image is removed', () => {
    expect(primaryAfterRemoval(1, 3)).toBe(1);
  });
});
