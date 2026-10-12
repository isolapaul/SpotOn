import { describe, expect, it } from 'vitest';
import { publicListSpotIds } from './publicListPreview';

describe('publicListSpotIds', () => {
  it('reads a public list and drops malformed ids', () => {
    expect(publicListSpotIds({
      fields: {
        name: { stringValue: 'Sunsets' },
        public: { booleanValue: true },
        spotIds: { arrayValue: { values: [{ stringValue: 'a1' }, { stringValue: '../x' }] } },
      },
    })).toEqual({ name: 'Sunsets', spotIds: ['a1'] });
  });
  it('refuses lists that are not public', () => {
    expect(publicListSpotIds({ fields: { name: { stringValue: 'x' } } })).toBeNull();
    expect(publicListSpotIds(null)).toBeNull();
  });
});
