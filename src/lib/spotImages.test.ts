import { describe, expect, it } from 'vitest';
import type { SpotImage } from '@/store/useSpotStore';
import {
  MAX_SPOT_IMAGES,
  PLACEHOLDER_URL,
  extForMime,
  getGalleryUrls,
  getHeroImageUrl,
  getLegacyImageUrl,
  getPreviewImageUrl,
  getSpotImages,
  getThumbnailUrl,
  isImageUnoptimized,
  realImageCount,
  sortSpotImagesByLikes,
} from './spotImages';
import * as oracle from './__oracles__/legacy';

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

// ---------------------------------------------------------------------------------------------
// T23 characterisation: URL expressions, like-sorts and the gallery vs the pre-T23 call sites.
// ---------------------------------------------------------------------------------------------
type Millis = { toMillis: () => number };
const ts = (ms: number): Millis => ({ toMillis: () => ms });
const img = (id: string, url: string, likes: number, addedAt?: unknown): SpotImage =>
  ({ id, url, likes, likedBy: [], ...(addedAt === undefined ? {} : { addedAt }) }) as SpotImage;

type SampleSpot = {
  id: string;
  imageUrls?: string[];
  primaryImageIndex?: number;
  spotImages?: SpotImage[];
  imageUrl?: string;
};

const SPOTS: Array<[string, SampleSpot]> = [
  ['empty object', { id: 'e' }],
  ['legacy with only imageUrl', { id: 'l1', imageUrl: '/legacy.jpg' }],
  ['legacy imageUrl and empty imageUrls', { id: 'l2', imageUrls: [], imageUrl: '/legacy.jpg' }],
  ['legacy imageUrl and imageUrls', { id: 'l3', imageUrls: ['/a.jpg'], imageUrl: '/legacy.jpg' }],
  ['imageUrls [placeholder]', { id: 'p1', imageUrls: [PLACEHOLDER_URL] }],
  ['imageUrls [placeholder] + spotImages placeholder', {
    id: 'p2', imageUrls: [PLACEHOLDER_URL], spotImages: [img('i0', PLACEHOLDER_URL, 0, ts(1))],
  }],
  ['imageUrls []', { id: 'z', imageUrls: [] }],
  ['primaryImageIndex in range', { id: 'pi1', imageUrls: ['/a.jpg', '/b.jpg', '/c.jpg'], primaryImageIndex: 2 }],
  ['primaryImageIndex out of range', { id: 'pi2', imageUrls: ['/a.jpg', '/b.jpg'], primaryImageIndex: 5 }],
  ['primaryImageIndex negative', { id: 'pi3', imageUrls: ['/a.jpg', '/b.jpg'], primaryImageIndex: -1 }],
  ['primary entry is an empty string', { id: 'pi4', imageUrls: ['/a.jpg', ''], primaryImageIndex: 1 }],
  ['spotImages only', {
    id: 's1', spotImages: [img('a', '/a.jpg', 1, ts(10)), img('b', '/b.jpg', 3, ts(5)), img('c', '/c.jpg', 2, ts(20))],
  }],
  ['spotImages only + legacy imageUrl', {
    id: 's2', imageUrl: '/legacy.jpg', spotImages: [img('a', '/a.jpg', 0, ts(1))],
  }],
  ['mixed addedAt (Timestamp-like, missing, null, 0, no toMillis)', {
    id: 'm1',
    imageUrls: ['/u1.jpg'],
    spotImages: [
      img('a', '/a.jpg', 1, ts(300)),
      img('b', '/b.jpg', 1),
      img('c', '/c.jpg', 1, null),
      img('d', '/d.jpg', 1, ts(0)),
      img('e', '/e.jpg', 1, { seconds: 5, nanoseconds: 0 }),
      img('f', '/f.jpg', 1, ts(100)),
      img('g', '/g.jpg', 1, ts(200)),
    ],
  }],
  ['equal likes, equal timestamps', {
    id: 'eq', spotImages: [img('a', '/a.jpg', 2, ts(7)), img('b', '/b.jpg', 2, ts(7)), img('c', '/c.jpg', 2, ts(7))],
  }],
  ['placeholder inside spotImages', {
    id: 'ph',
    imageUrls: [PLACEHOLDER_URL, '/a.jpg'],
    spotImages: [img('p', PLACEHOLDER_URL, 9, ts(999)), img('a', '/a.jpg', 1, ts(1))],
  }],
  ['duplicate urls across both arrays and within', {
    id: 'dup',
    imageUrls: ['/a.jpg', '/x.jpg', '/a.jpg', PLACEHOLDER_URL, '/y.jpg', '/x.jpg'],
    primaryImageIndex: 1,
    spotImages: [
      img('1', '/a.jpg', 0, ts(1)),
      img('2', '/b.jpg', 4, ts(2)),
      img('3', '/b.jpg', 4, ts(3)),
      img('4', '/y.jpg', 1),
    ],
  }],
  ['legacy imageUrls only (materialised by getSpotImages)', {
    id: 'lg', imageUrls: ['/a.jpg', '/b.jpg', PLACEHOLDER_URL], primaryImageIndex: 1,
  }],
];

describe('image URL helpers (characterisation)', () => {
  it.each(SPOTS)('getThumbnailUrl: %s', (_name, spot) => {
    expect(getThumbnailUrl(spot)).toBe(oracle.thumbnailSrc(spot));
  });

  it.each(SPOTS)('isImageUnoptimized: %s', (_name, spot) => {
    expect(isImageUnoptimized(spot)).toBe(oracle.unoptimizedProp(spot));
  });

  it.each(SPOTS)('details sort + hero + gallery: %s', (_name, spot) => {
    const input = getSpotImages(spot);
    const before = [...input];
    const oldSorted = oracle.detailsSortedSpotImages([...input]);
    const newSorted = sortSpotImagesByLikes(input, 'missingAsZero');

    expect(newSorted).toEqual(oldSorted);
    newSorted.forEach((image, i) => expect(image).toBe(oldSorted[i]));
    expect(input).toEqual(before);
    input.forEach((image, i) => expect(image).toBe(before[i]));

    expect(getHeroImageUrl(spot, newSorted)).toBe(oracle.detailsHeroImageUrl(spot, oldSorted));
    expect(getGalleryUrls(spot, newSorted)).toEqual(oracle.detailsAllGalleryImages(spot, oldSorted));
    expect(getGalleryUrls(spot)).toEqual(oracle.detailsAllGalleryImages(spot, oldSorted));
  });

  it.each(SPOTS)('info window sort + preview: %s', (_name, spot) => {
    const input = spot.spotImages || [];
    const before = [...input];
    const oldSorted = oracle.infoWindowSortedSpotImages(spot);
    const newSorted = sortSpotImagesByLikes(input, 'bothRequired');

    expect(newSorted).toEqual(oldSorted);
    newSorted.forEach((image, i) => expect(image).toBe(oldSorted[i]));
    expect(input).toEqual(before);
    expect(getPreviewImageUrl(spot, newSorted)).toBe(oracle.infoWindowPreviewImageUrl(spot, oldSorted));
  });

  // 'bothRequired' is not transitive for mixed timestamps, so the result depends on the input
  // order: feed every permutation to both implementations.
  const permutations = <T,>(items: T[]): T[][] =>
    items.length <= 1 ? [items] : items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
  const MIXED = [img('a', '/a.jpg', 1, ts(300)), img('b', '/b.jpg', 1), img('c', '/c.jpg', 1, null), img('d', '/d.jpg', 2, ts(5)), img('e', '/e.jpg', 1, ts(100))];

  it('both tie-breaks match their oracle for every input order of mixed timestamps', () => {
    for (const order of permutations(MIXED)) {
      const spot = { id: 'perm', spotImages: order };
      expect(sortSpotImagesByLikes(order, 'bothRequired').map((i) => i.id)).toEqual(
        oracle.infoWindowSortedSpotImages(spot).map((i) => i.id),
      );
      expect(sortSpotImagesByLikes(order, 'missingAsZero').map((i) => i.id)).toEqual(
        oracle.detailsSortedSpotImages([...order]).map((i) => i.id),
      );
    }
  });

  it('documents the tie-breaks: missing timestamps are oldest vs. kept in input order', () => {
    const order = [img('none', '/n.jpg', 0), img('old', '/o.jpg', 0, ts(1)), img('new', '/w.jpg', 0, ts(2))];
    expect(sortSpotImagesByLikes(order, 'missingAsZero').map((i) => i.id)).toEqual(['new', 'old', 'none']);
    expect(sortSpotImagesByLikes(order, 'bothRequired').map((i) => i.id)).toEqual(['none', 'new', 'old']);
  });

  it('hero has no legacy imageUrl fallback; thumbnail and preview do', () => {
    const spot = { imageUrl: '/legacy.jpg' };
    expect(getHeroImageUrl(spot, [])).toBe(PLACEHOLDER_URL);
    expect(getThumbnailUrl(spot)).toBe('/legacy.jpg');
    expect(getPreviewImageUrl(spot, [])).toBe('/legacy.jpg');
    expect(getLegacyImageUrl(spot)).toBe('/legacy.jpg');
    expect(getLegacyImageUrl({})).toBeUndefined();
  });

  it('preview prefers the most-liked image, hero the primary image', () => {
    const spot = { id: 'h', imageUrls: ['/a.jpg', '/b.jpg'], primaryImageIndex: 1, spotImages: [img('a', '/a.jpg', 5, ts(1))] };
    const sorted = sortSpotImagesByLikes(getSpotImages(spot), 'missingAsZero');
    expect(getHeroImageUrl(spot, sorted)).toBe('/b.jpg');
    expect(getPreviewImageUrl(spot, sorted)).toBe('/a.jpg');
  });
});
