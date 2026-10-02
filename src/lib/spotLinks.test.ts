import { describe, expect, it } from 'vitest';
import { spotIdFromPath, spotLink } from './spotLinks';
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
  });
});
