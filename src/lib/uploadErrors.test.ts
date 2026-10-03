import { describe, expect, it } from 'vitest';
import { MAX_PENDING_PHOTOS_ERROR, MAX_SPOT_IMAGES_ERROR, PHOTO_RATE_LIMIT_ERROR, uploadErrorKey } from './uploadErrors';
import { TIMEOUT } from './withTimeout';

describe('uploadErrorKey', () => {
  it('timeouts', () => {
    expect(uploadErrorKey(new Error(TIMEOUT), 'reviewError')).toBe('uploadTimeout');
    expect(uploadErrorKey({ code: 'functions/deadline-exceeded' }, 'reviewError')).toBe('uploadTimeout');
  });

  it('the image limit', () => {
    expect(uploadErrorKey(new Error(MAX_SPOT_IMAGES_ERROR), 'spotPhotoAddError')).toBe('maxSpotImages');
    expect(uploadErrorKey(new Error(MAX_PENDING_PHOTOS_ERROR), 'spotPhotoAddError')).toBe('maxPendingPhotos');
  });

  it('the photo submission rate limit', () => {
    expect(uploadErrorKey(new Error(PHOTO_RATE_LIMIT_ERROR), 'spotPhotoAddError')).toBe('rateLimited');
  });

  it('anything else falls back', () => {
    for (const error of [new Error('x'), { code: 'permission-denied' }, null, undefined, 'oops']) {
      expect(uploadErrorKey(error, 'spotUploadFailed')).toBe('spotUploadFailed');
    }
  });
});
