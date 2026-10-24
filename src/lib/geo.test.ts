import { describe, expect, it } from 'vitest';
import { formatDistance, haversineKm } from './geo';

// [lat1, lng1, lat2, lng2], km (the values of the pre-T23 DiscoveryPanel.calculateDistance)
const SAMPLES: Array<[string, [number, number, number, number], number]> = [
  ['equal points', [47.4979, 19.0402, 47.4979, 19.0402], 0],
  ['origin to itself', [0, 0, 0, 0], 0],
  ['Budapest → Vienna', [47.4979, 19.0402, 48.2082, 16.3738], 214.04428171108447],
  ['Vienna → Budapest', [48.2082, 16.3738, 47.4979, 19.0402], 214.04428171108447],
  ['antipodes (0,0)↔(0,180)', [0, 0, 0, 180], 20015.086796020572],
  ['antipodes (pole to pole)', [90, 0, -90, 0], 20015.086796020572],
  ['antipodes Budapest', [47.4979, 19.0402, -47.4979, -160.9598], 20015.086796020572],
  ['negative lat/lng', [-33.8688, 151.2093, -22.9068, -43.1729], 13521.033220889633],
  ['negative lat/lng (small)', [-1.5, -2.25, -1.4999, -2.2501], 0.01572264340305789],
  ['lng wrap +180 → -180', [10, 179.9, 10, -179.9], 21.901124835754715],
  ['lng wrap -180 → +180', [-10, -179.99, -10, 179.99], 2.1901125167642497],
  ['exactly ±180', [0, 180, 0, -180], 1.5604449514735574e-12],
  ['across the equator', [1e-9, 0, -1e-9, 0], 2.2238985328911746e-7],
  ['long distance', [64.1466, -21.9426, -41.2865, 174.7762], 17254.83221978623],
];

describe('haversineKm', () => {
  it.each(SAMPLES)('%s', (_name, [lat1, lng1, lat2, lng2], km) => {
    expect(haversineKm(lat1, lng1, lat2, lng2)).toBe(km);
  });

  it('sanity: equal points are 0 km, Budapest–Vienna ≈ 214 km', () => {
    expect(haversineKm(47.4979, 19.0402, 47.4979, 19.0402)).toBe(0);
    expect(haversineKm(47.4979, 19.0402, 48.2082, 16.3738)).toBeCloseTo(214.5, 0);
  });
});

describe('formatDistance', () => {
  it('metres under a kilometre, rounded to 10 m (never 0 m)', () => {
    expect(formatDistance(0.346, 'hu')).toBe('350 m');
    expect(formatDistance(0.001, 'en')).toBe('10 m');
  });

  it('one decimal under 10 km, with the language decimal separator', () => {
    expect(formatDistance(1.24, 'hu')).toBe('1,2 km');
    expect(formatDistance(1.24, 'de')).toBe('1,2 km');
    expect(formatDistance(1.24, 'en')).toBe('1.2 km');
    expect(formatDistance(9.96, 'en')).toBe('10 km');
  });

  it('whole kilometres from 10 km', () => {
    expect(formatDistance(12.4, 'hu')).toBe('12 km');
  });
});
