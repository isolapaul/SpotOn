import { describe, expect, it } from 'vitest';
import { withCartoKey } from './mapTiles';

const CARTO = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

describe('withCartoKey', () => {
  it('appends the key to CARTO tile URLs', () => {
    expect(withCartoKey(CARTO, 'abc123')).toBe(`${CARTO}?key=abc123`);
  });

  it('encodes the key and keeps an existing query', () => {
    expect(withCartoKey(`${CARTO}?x=1`, 'a b&c')).toBe(`${CARTO}?x=1&key=a%20b%26c`);
  });

  it('leaves the URL alone without a key or for other providers', () => {
    expect(withCartoKey(CARTO, undefined)).toBe(CARTO);
    expect(withCartoKey(CARTO, '  ')).toBe(CARTO);
    const osm = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    expect(withCartoKey(osm, 'abc123')).toBe(osm);
  });
});
