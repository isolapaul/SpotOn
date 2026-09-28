import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';
import { discoveryCalculateDistance } from './__oracles__/legacy';

// [lat1, lng1, lat2, lng2]
const SAMPLES: Array<[string, [number, number, number, number]]> = [
  ['equal points', [47.4979, 19.0402, 47.4979, 19.0402]],
  ['origin to itself', [0, 0, 0, 0]],
  ['Budapest → Vienna', [47.4979, 19.0402, 48.2082, 16.3738]],
  ['Vienna → Budapest', [48.2082, 16.3738, 47.4979, 19.0402]],
  ['antipodes (0,0)↔(0,180)', [0, 0, 0, 180]],
  ['antipodes (pole to pole)', [90, 0, -90, 0]],
  ['antipodes Budapest', [47.4979, 19.0402, -47.4979, -160.9598]],
  ['negative lat/lng', [-33.8688, 151.2093, -22.9068, -43.1729]],
  ['negative lat/lng (small)', [-1.5, -2.25, -1.4999, -2.2501]],
  ['lng wrap +180 → -180', [10, 179.9, 10, -179.9]],
  ['lng wrap -180 → +180', [-10, -179.99, -10, 179.99]],
  ['exactly ±180', [0, 180, 0, -180]],
  ['across the equator', [1e-9, 0, -1e-9, 0]],
  ['long distance', [64.1466, -21.9426, -41.2865, 174.7762]],
];

describe('haversineKm (characterisation vs DiscoveryPanel.calculateDistance)', () => {
  it.each(SAMPLES)('%s: bit-identical', (_name, [lat1, lng1, lat2, lng2]) => {
    expect(haversineKm(lat1, lng1, lat2, lng2)).toBe(discoveryCalculateDistance(lat1, lng1, lat2, lng2));
  });

  it('sanity: equal points are 0 km, Budapest–Vienna ≈ 214 km', () => {
    expect(haversineKm(47.4979, 19.0402, 47.4979, 19.0402)).toBe(0);
    expect(haversineKm(47.4979, 19.0402, 48.2082, 16.3738)).toBeCloseTo(214.5, 0);
  });
});
