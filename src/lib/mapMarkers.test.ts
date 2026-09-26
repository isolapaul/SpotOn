import { describe, expect, it } from 'vitest';
import { buildMarkerSvg, getMarkerSize, type MarkerStatus } from './mapMarkers';
import * as oracle from './__oracles__/legacy';

const CATEGORY_SAMPLES = [
  'scenic', 'smoke-spot', 'viewpoint', 'hiking', 'random', 'date-spot', 'park', 'part', 'other',
  'unknown', '', 'toString', undefined as unknown as string,
];
const STATUSES: MarkerStatus[] = ['approved', 'pending', 'rejected'];
const SIZES = [24, 32, 48, 64, 80, 58, 29, 38, 96];

describe('buildMarkerSvg (characterisation vs MapView getCategoryIcon html)', () => {
  const cases = CATEGORY_SAMPLES.flatMap((category) =>
    STATUSES.flatMap((status) =>
      [true, false].flatMap((highlighted) => SIZES.map((size) => [category, status, highlighted, size] as const)),
    ),
  );

  it.each(cases)('%s / %s / highlighted=%s / %i: byte-identical', (category, status, highlighted, size) => {
    expect(buildMarkerSvg(category, status, highlighted, size)).toBe(oracle.getCategoryIconSvg(category, status, highlighted, size));
  });
});

describe('getMarkerSize (characterisation)', () => {
  const zooms = [-1, 0, 1, 5, 5.5, 6, 10, 10.25, 11, 13, 14, 14.9, 15, 18, 18.01, 19, 22, 30];
  it.each(zooms.map((z) => [z]))('zoom %d', (zoom) => {
    expect(getMarkerSize(zoom)).toBe(oracle.getMarkerSize(zoom));
  });
});
