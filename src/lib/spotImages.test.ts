import { describe, expect, it } from 'vitest';
import type { SpotImage } from '@/store/useSpotStore';
import {
  MAX_SPOT_IMAGES,
  PLACEHOLDER_URL,
  photoLimitKey,
  imageFallbacks,
  extForMime,
  getGalleryUrls,
  getHeroImageUrl,
  getLegacyImageUrl,
  getPreviewImageUrl,
  getSpotImages,
  getThumbnailUrl,
  isImageUnoptimized,
  realImageCount,
  removeImage,
  sortSpotImagesByLikes,
} from './spotImages';

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

describe('removeImage', () => {
  const img = (url: string, likes = 0) => ({ id: `id-${url}`, url, likes, likedBy: [] as string[] });

  it('removing an image after the primary keeps the index', () => {
    expect(removeImage({ imageUrls: ['/a', '/b', '/c'], spotImages: [img('/a'), img('/b'), img('/c')], primaryImageIndex: 1 }, '/c'))
      .toEqual({ imageUrls: ['/a', '/b'], spotImages: [img('/a'), img('/b')], primaryImageIndex: 1 });
  });

  it('removing an image before the primary shifts the index to the same image (BUG-27)', () => {
    expect(removeImage({ imageUrls: ['/a', '/b', '/c'], spotImages: [img('/a'), img('/b'), img('/c')], primaryImageIndex: 2 }, '/a'))
      .toEqual({ imageUrls: ['/b', '/c'], spotImages: [img('/b'), img('/c')], primaryImageIndex: 1 });
  });

  it('removing the primary itself keeps the index, clamped to the last entry', () => {
    expect(removeImage({ imageUrls: ['/a', '/b', '/c'], primaryImageIndex: 1 }, '/b').primaryImageIndex).toBe(1);
    expect(removeImage({ imageUrls: ['/a', '/b', '/c'], primaryImageIndex: 2 }, '/c').primaryImageIndex).toBe(1);
  });

  it('removes every duplicate and shifts by the duplicates before the primary', () => {
    expect(removeImage({ imageUrls: ['/a', '/x', '/a', '/b', '/a'], spotImages: [img('/a'), img('/x'), img('/a', 3)], primaryImageIndex: 3 }, '/a'))
      .toEqual({ imageUrls: ['/x', '/b'], spotImages: [img('/x')], primaryImageIndex: 1 });
  });

  it('removing the last image leaves the placeholder at index 0', () => {
    expect(removeImage({ imageUrls: ['/a'], spotImages: [img('/a')], primaryImageIndex: 0 }, '/a'))
      .toEqual({ imageUrls: [PLACEHOLDER_URL], spotImages: [], primaryImageIndex: 0 });
    expect(removeImage({ imageUrls: ['/a', '/a'], primaryImageIndex: 1 }, '/a'))
      .toEqual({ imageUrls: [PLACEHOLDER_URL], spotImages: [], primaryImageIndex: 0 });
  });

  it('legacy spot (only imageUrls, no primaryImageIndex) → spotImages []', () => {
    expect(removeImage({ imageUrls: [PLACEHOLDER_URL, '/a', '/b'] }, '/a'))
      .toEqual({ imageUrls: [PLACEHOLDER_URL, '/b'], spotImages: [], primaryImageIndex: 0 });
    expect(removeImage({ imageUrls: [PLACEHOLDER_URL, '/a', '/b'], primaryImageIndex: 2 }, '/a'))
      .toEqual({ imageUrls: [PLACEHOLDER_URL, '/b'], spotImages: [], primaryImageIndex: 1 });
  });

  it('an image only in spotImages is removed there; imageUrls and the index are unchanged', () => {
    expect(removeImage({ imageUrls: ['/a', '/b'], spotImages: [img('/a'), img('/b'), img('/s')], primaryImageIndex: 1 }, '/s'))
      .toEqual({ imageUrls: ['/a', '/b'], spotImages: [img('/a'), img('/b')], primaryImageIndex: 1 });
  });

  it('keeps entries (and their likes) that are not removed, and never mutates the input', () => {
    const spot = { imageUrls: ['/a', '/b'], spotImages: [img('/a', 5), img('/b', 2)], primaryImageIndex: 0 };
    const copy = structuredClone(spot);
    const result = removeImage(spot, '/b');
    expect(result.spotImages).toEqual([img('/a', 5)]);
    expect(result.spotImages[0]).toBe(spot.spotImages[0]);
    expect(spot).toEqual(copy);
  });

  it('a missing imageUrls (legacy singular imageUrl only) → placeholder', () => {
    expect(removeImage({}, '/a')).toEqual({ imageUrls: [PLACEHOLDER_URL], spotImages: [], primaryImageIndex: 0 });
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
// URL expressions, like-sorts and the gallery. The expected values are the pre-T23 call sites'
// results (characterised in T23), legacy quirks included.
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

type Expected = {
  /** getThumbnailUrl */
  thumb: string;
  /** isImageUnoptimized */
  unoptimized: boolean;
  /** ids of sortSpotImagesByLikes(getSpotImages(spot), 'missingAsZero') */
  details: string[];
  /** getHeroImageUrl with that order */
  hero: string;
  /** getGalleryUrls with that order */
  gallery: string[];
  /** ids of sortSpotImagesByLikes(spot.spotImages || [], 'bothRequired') */
  info: string[];
  /** getPreviewImageUrl with that order */
  preview: string;
};

const P = PLACEHOLDER_URL;

const SPOTS: Array<[string, SampleSpot, Expected]> = [
  ['empty object', { id: 'e' }, {
    thumb: P, unoptimized: true, details: [], hero: P, gallery: [], info: [], preview: P,
  }],
  ['legacy with only imageUrl', { id: 'l1', imageUrl: '/legacy.jpg' }, {
    thumb: '/legacy.jpg', unoptimized: false, details: [], hero: P, gallery: [], info: [], preview: '/legacy.jpg',
  }],
  ['legacy imageUrl and empty imageUrls', { id: 'l2', imageUrls: [], imageUrl: '/legacy.jpg' }, {
    thumb: '/legacy.jpg', unoptimized: false, details: [], hero: P, gallery: [], info: [], preview: '/legacy.jpg',
  }],
  ['legacy imageUrl and imageUrls', { id: 'l3', imageUrls: ['/a.jpg'], imageUrl: '/legacy.jpg' }, {
    thumb: '/a.jpg', unoptimized: false, details: ['l3_0'], hero: '/a.jpg', gallery: ['/a.jpg'], info: [], preview: '/a.jpg',
  }],
  ['imageUrls [placeholder]', { id: 'p1', imageUrls: [P] }, {
    thumb: P, unoptimized: false, details: [], hero: P, gallery: [], info: [], preview: P,
  }],
  ['imageUrls [placeholder] + spotImages placeholder', {
    id: 'p2', imageUrls: [P], spotImages: [img('i0', P, 0, ts(1))],
  }, {
    thumb: P, unoptimized: false, details: [], hero: P, gallery: [], info: [], preview: P,
  }],
  ['imageUrls []', { id: 'z', imageUrls: [] }, {
    thumb: P, unoptimized: false, details: [], hero: P, gallery: [], info: [], preview: P,
  }],
  ['primaryImageIndex in range', { id: 'pi1', imageUrls: ['/a.jpg', '/b.jpg', '/c.jpg'], primaryImageIndex: 2 }, {
    thumb: '/c.jpg', unoptimized: false, details: ['pi1_0', 'pi1_1', 'pi1_2'], hero: '/c.jpg',
    gallery: ['/a.jpg', '/b.jpg', '/c.jpg'], info: [], preview: '/c.jpg',
  }],
  ['primaryImageIndex out of range', { id: 'pi2', imageUrls: ['/a.jpg', '/b.jpg'], primaryImageIndex: 5 }, {
    thumb: '/a.jpg', unoptimized: false, details: ['pi2_0', 'pi2_1'], hero: '/a.jpg', gallery: ['/a.jpg', '/b.jpg'], info: [], preview: '/a.jpg',
  }],
  ['primaryImageIndex negative', { id: 'pi3', imageUrls: ['/a.jpg', '/b.jpg'], primaryImageIndex: -1 }, {
    thumb: '/a.jpg', unoptimized: false, details: ['pi3_0', 'pi3_1'], hero: '/a.jpg', gallery: ['/a.jpg', '/b.jpg'], info: [], preview: '/a.jpg',
  }],
  ['primary entry is an empty string', { id: 'pi4', imageUrls: ['/a.jpg', ''], primaryImageIndex: 1 }, {
    thumb: '/a.jpg', unoptimized: false, details: ['pi4_0', 'pi4_1'], hero: '/a.jpg', gallery: ['/a.jpg', ''], info: [], preview: '/a.jpg',
  }],
  ['spotImages only', {
    id: 's1', spotImages: [img('a', '/a.jpg', 1, ts(10)), img('b', '/b.jpg', 3, ts(5)), img('c', '/c.jpg', 2, ts(20))],
  }, {
    thumb: P, unoptimized: true, details: ['b', 'c', 'a'], hero: '/b.jpg', gallery: ['/b.jpg', '/c.jpg', '/a.jpg'],
    info: ['b', 'c', 'a'], preview: '/b.jpg',
  }],
  ['spotImages only + legacy imageUrl', {
    id: 's2', imageUrl: '/legacy.jpg', spotImages: [img('a', '/a.jpg', 0, ts(1))],
  }, {
    thumb: '/legacy.jpg', unoptimized: false, details: ['a'], hero: '/a.jpg', gallery: ['/a.jpg'], info: ['a'], preview: '/a.jpg',
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
  }, {
    thumb: '/u1.jpg', unoptimized: false, details: ['a', 'g', 'f', 'b', 'c', 'd', 'e'], hero: '/u1.jpg',
    gallery: ['/a.jpg', '/g.jpg', '/f.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg', '/u1.jpg'],
    info: ['a', 'b', 'c', 'd', 'e', 'g', 'f'], preview: '/a.jpg',
  }],
  ['equal likes, equal timestamps', {
    id: 'eq', spotImages: [img('a', '/a.jpg', 2, ts(7)), img('b', '/b.jpg', 2, ts(7)), img('c', '/c.jpg', 2, ts(7))],
  }, {
    thumb: P, unoptimized: true, details: ['a', 'b', 'c'], hero: '/a.jpg', gallery: ['/a.jpg', '/b.jpg', '/c.jpg'],
    info: ['a', 'b', 'c'], preview: '/a.jpg',
  }],
  ['placeholder inside spotImages', {
    id: 'ph',
    imageUrls: [P, '/a.jpg'],
    spotImages: [img('p', P, 9, ts(999)), img('a', '/a.jpg', 1, ts(1))],
  }, {
    thumb: P, unoptimized: false, details: ['a'], hero: P, gallery: ['/a.jpg'], info: ['a'], preview: '/a.jpg',
  }],
  ['duplicate urls across both arrays and within', {
    id: 'dup',
    imageUrls: ['/a.jpg', '/x.jpg', '/a.jpg', P, '/y.jpg', '/x.jpg'],
    primaryImageIndex: 1,
    spotImages: [
      img('1', '/a.jpg', 0, ts(1)),
      img('2', '/b.jpg', 4, ts(2)),
      img('3', '/b.jpg', 4, ts(3)),
      img('4', '/y.jpg', 1),
    ],
  }, {
    thumb: '/x.jpg', unoptimized: false, details: ['3', '2', '4', '1'], hero: '/x.jpg',
    gallery: ['/b.jpg', '/y.jpg', '/a.jpg', '/x.jpg'], info: ['3', '2', '4', '1'], preview: '/b.jpg',
  }],
  ['legacy imageUrls only (materialised by getSpotImages)', {
    id: 'lg', imageUrls: ['/a.jpg', '/b.jpg', P], primaryImageIndex: 1,
  }, {
    thumb: '/b.jpg', unoptimized: false, details: ['lg_0', 'lg_1'], hero: '/b.jpg', gallery: ['/a.jpg', '/b.jpg'], info: [], preview: '/b.jpg',
  }],
];

describe('image URL helpers', () => {
  it.each(SPOTS)('getThumbnailUrl: %s', (_name, spot, expected) => {
    expect(getThumbnailUrl(spot)).toBe(expected.thumb);
  });

  it.each(SPOTS)('isImageUnoptimized: %s', (_name, spot, expected) => {
    expect(isImageUnoptimized(spot)).toBe(expected.unoptimized);
  });

  it.each(SPOTS)('details sort + hero + gallery: %s', (_name, spot, expected) => {
    const input = getSpotImages(spot);
    const before = [...input];
    const sorted = sortSpotImagesByLikes(input, 'missingAsZero');

    expect(sorted.map((image) => image.id)).toEqual(expected.details);
    sorted.forEach((image) => expect(input).toContain(image));
    expect(input).toEqual(before);
    input.forEach((image, i) => expect(image).toBe(before[i]));

    expect(getHeroImageUrl(spot, sorted)).toBe(expected.hero);
    expect(getGalleryUrls(spot, sorted)).toEqual(expected.gallery);
    expect(getGalleryUrls(spot)).toEqual(expected.gallery);
  });

  it.each(SPOTS)('info window sort + preview: %s', (_name, spot, expected) => {
    const input = spot.spotImages || [];
    const before = [...input];
    const sorted = sortSpotImagesByLikes(input, 'bothRequired');

    expect(sorted.map((image) => image.id)).toEqual(expected.info);
    sorted.forEach((image) => expect(input).toContain(image));
    expect(input).toEqual(before);
    expect(getPreviewImageUrl(spot, sorted)).toBe(expected.preview);
  });

  // 'bothRequired' is not transitive for mixed timestamps, so the result depends on the input
  // order: every permutation must sort exactly like Array.prototype.sort with the documented comparator.
  const permutations = <T,>(items: T[]): T[][] =>
    items.length <= 1 ? [items] : items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
  const MIXED = [img('a', '/a.jpg', 1, ts(300)), img('b', '/b.jpg', 1), img('c', '/c.jpg', 1, null), img('d', '/d.jpg', 2, ts(5)), img('e', '/e.jpg', 1, ts(100))];
  const millis = (image: SpotImage) => (image.addedAt as Millis | null | undefined)?.toMillis?.();
  const bothRequired = (a: SpotImage, b: SpotImage) => {
    if (b.likes !== a.likes) return b.likes - a.likes;
    const aMillis = millis(a);
    const bMillis = millis(b);
    return aMillis && bMillis ? bMillis - aMillis : 0;
  };

  it('both tie-breaks hold for every input order of mixed timestamps', () => {
    for (const order of permutations(MIXED)) {
      expect(sortSpotImagesByLikes(order, 'bothRequired').map((i) => i.id)).toEqual(
        [...order].sort(bothRequired).map((i) => i.id),
      );
      // 'missingAsZero' is a total order: most likes, then newest, untimed last in input order.
      const untimed = order.filter((i) => i.id === 'b' || i.id === 'c').map((i) => i.id);
      expect(sortSpotImagesByLikes(order, 'missingAsZero').map((i) => i.id)).toEqual(['d', 'a', 'e', ...untimed]);
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

describe('imageFallbacks', () => {
  it('ends with the legacy imageUrl when spotImages point elsewhere', () => {
    const spot = { id: 's', spotImages: [{ id: 'a', url: 'broken', likes: 0, likedBy: [] }], imageUrl: 'legacy' } as never;
    expect(imageFallbacks(spot, [{ url: 'broken' }])).toEqual(['broken', 'legacy']);
  });
  it('never lists the placeholder or a duplicate', () => {
    const spot = { id: 's', imageUrls: ['a', 'b'], primaryImageIndex: 1 } as never;
    expect(imageFallbacks(spot, [])).toEqual(['a', 'b']);
    expect(imageFallbacks({ id: 's', imageUrls: [PLACEHOLDER_URL] } as never, [])).toEqual([]);
  });
});

describe('photoLimitKey', () => {
  const spot = (status: 'pending' | 'approved', n: number) =>
    ({ createdBy: 'o', status, imageUrls: Array.from({ length: n }, (_, i) => `u${i}`) });
  it('the 20-photo limit applies to everyone', () => {
    expect(photoLimitKey(spot('approved', 18), 'a', true, 3)).toBe('maxSpotImages');
    expect(photoLimitKey(spot('approved', 18), 'a', true, 2)).toBeNull();
  });
  it('photos waiting for approval: at most 5 at once', () => {
    expect(photoLimitKey(spot('approved', 0), 'x', false, 6)).toBe('maxPendingPhotos');
    expect(photoLimitKey(spot('approved', 0), 'o', false, 6)).toBe('maxPendingPhotos');
    expect(photoLimitKey(spot('approved', 0), 'x', false, 5)).toBeNull();
    expect(photoLimitKey(spot('pending', 0), 'o', false, 6)).toBeNull();
  });
});
