import { describe, expect, it } from 'vitest';
import type { SpotImage } from '@/store/useSpotStore';
import { MAX_SPOT_IMAGES, PLACEHOLDER_URL, extForMime, getSpotImages, realImageCount } from './spotImages';

describe('constants', () => {
  it('match the server (T10) and D12', () => {
    expect(PLACEHOLDER_URL).toBe('/placeholder-spot.jpg');
    expect(MAX_SPOT_IMAGES).toBe(20);
  });
});

describe('getSpotImages', () => {
  it('materialises legacy imageUrls with ${spotId}_${index} ids, including a placeholder at index 0', () => {
    expect(getSpotImages({ id: 's1', imageUrls: [PLACEHOLDER_URL, '/a.jpg'] })).toEqual([
      { id: 's1_0', url: PLACEHOLDER_URL, likes: 0, likedBy: [] },
      { id: 's1_1', url: '/a.jpg', likes: 0, likedBy: [] },
    ]);
  });

  it('materialises when spotImages is an empty array', () => {
    expect(getSpotImages({ id: 's2', imageUrls: ['/a.jpg'], spotImages: [] })).toEqual([
      { id: 's2_0', url: '/a.jpg', likes: 0, likedBy: [] },
    ]);
  });

  it('returns [] when there are no images at all', () => {
    expect(getSpotImages({ id: 's3' } as never)).toEqual([]);
    expect(getSpotImages({ id: 's3', imageUrls: [] })).toEqual([]);
  });

  it('passes spotImages through unchanged when present', () => {
    const spotImages = [
      { id: 'x', url: '/b.jpg', addedBy: 'u', addedAt: {} as SpotImage['addedAt'], likes: 2, likedBy: ['a', 'b'] },
    ];
    const result = getSpotImages({ id: 's4', imageUrls: ['/other.jpg'], spotImages });
    expect(result).toBe(spotImages);
  });
});

describe('realImageCount', () => {
  it.each([
    [[PLACEHOLDER_URL], 0],
    [[], 0],
    [['/a.jpg'], 1],
    [[PLACEHOLDER_URL, '/a.jpg'], 2],
    [['/a.jpg', '/b.jpg', '/c.jpg'], 3],
  ])('%j → %i', (imageUrls, expected) => {
    expect(realImageCount({ imageUrls })).toBe(expected);
  });

  it('treats a missing imageUrls (e.g. legacy singular imageUrl only) as 0', () => {
    expect(realImageCount({} as never)).toBe(0);
  });
});

describe('extForMime', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('%s → %s', (mime, ext) => {
    expect(extForMime(mime)).toBe(ext);
  });

  it.each(['image/gif', 'image/jpg', 'image/heic', 'image/svg+xml', 'IMAGE/JPEG', '', 'application/octet-stream'])(
    'rejects %j',
    (mime) => {
      expect(extForMime(mime)).toBeNull();
    },
  );
});
