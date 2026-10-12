import { describe, expect, it } from 'vitest';
import { spotIdFromPath, spotLink, userIdFromPath } from './spotLinks';
import { previewFromDocument } from './spotPreview';

describe('spot links', () => {
  it('builds and reads /spot/<id>', () => {
    expect(spotLink('https://spoton.isolapaul.hu/', 'a b')).toBe('https://spoton.isolapaul.hu/spot/a%20b');
    expect(spotIdFromPath('/spot/a%20b')).toBe('a b');
    for (const p of ['/', '/spot/', '/spot/a/b', '/spot/__x__', null]) expect(spotIdFromPath(p)).toBeNull();
  });
  it('previews approved spots only, with the primary https photo and the rating', () => {
    const doc = (status: string) => ({ fields: {
      status: { stringValue: status }, name: { stringValue: 'Lake' }, description: { stringValue: 'Nice' },
      imageUrls: { arrayValue: { values: [{ stringValue: '/placeholder-spot.jpg' }, { stringValue: 'https://x/a.jpg' }] } },
      primaryImageIndex: { integerValue: '0' },
      reviews: { arrayValue: { values: [{ mapValue: { fields: { rating: { integerValue: '4' } } } }, { mapValue: { fields: { rating: { integerValue: '5' } } } }] } },
    } });
    expect(previewFromDocument('s', doc('approved'))).toEqual({ id: 's', name: 'Lake', description: 'Nice', imageUrl: 'https://x/a.jpg', rating: 4.5 });
    expect(previewFromDocument('s', doc('pending'))).toBeNull();
    expect(previewFromDocument('s', null)).toBeNull();
    // The index counts every stored photo, also the non-https ones.
    const three = { fields: { status: { stringValue: 'approved' }, name: { stringValue: 'L' },
      imageUrls: { arrayValue: { values: [{ stringValue: '/p.jpg' }, { stringValue: 'https://x/a.jpg' }, { stringValue: 'https://x/b.jpg' }] } },
      primaryImageIndex: { integerValue: '2' } } };
    expect(previewFromDocument('s', three)?.imageUrl).toBe('https://x/b.jpg');
  });
});

describe('userIdFromPath', () => {
  it('reads a profile link', () => {
    expect(userIdFromPath('/user/abc123')).toBe('abc123');
    expect(userIdFromPath('/user/abc%20d/')).toBe('abc d');
    expect(userIdFromPath('/user/')).toBeNull();
    expect(userIdFromPath('/user/%E0%A4%A')).toBeNull();
    expect(userIdFromPath('/spot/abc')).toBeNull();
  });
});

describe('spotIdFromPath with a malformed escape', () => {
  it('is no link instead of throwing', () => {
    expect(spotIdFromPath('/spot/%E0%A4%A')).toBeNull();
  });
});
