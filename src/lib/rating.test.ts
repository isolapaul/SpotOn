import { describe, expect, it } from 'vitest';
import type { Review } from '@/store/useSpotStore';
import { averageRating } from './rating';
import {
  detailsAverageRating,
  discoveryGetAverageRating,
  infoWindowAverageRating,
  profileAvgRating,
} from './__oracles__/legacy';

const reviews = (ratings: number[]): Review[] =>
  ratings.map((rating, i) => ({ id: `r${i}`, userId: `u${i}`, userName: 'x', rating, comment: '' }) as unknown as Review);

const SAMPLES: Array<[string, Review[] | undefined]> = [
  ['undefined', undefined],
  ['[]', []],
  ['[5]', reviews([5])],
  ['[1,2]', reviews([1, 2])],
  ['[4,5,5]', reviews([4, 5, 5])],
  ['[1,1,1,2,2,2,3]', reviews([1, 1, 1, 2, 2, 2, 3])],
  ['[3,4,4,5,5,5,1,2,2]', reviews([3, 4, 4, 5, 5, 5, 1, 2, 2])],
];

const ORACLES = [
  ['ProfilePanel avgRating', profileAvgRating],
  ['SpotDetailsPanel averageRating', detailsAverageRating],
  ['SpotInfoWindow averageRating', infoWindowAverageRating],
  ['DiscoveryPanel getAverageRating', discoveryGetAverageRating],
] as const;

describe('averageRating (characterisation)', () => {
  for (const [site, oracle] of ORACLES) {
    it.each(SAMPLES)(`${site}: %s`, (_name, list) => {
      expect(averageRating(list)).toBe(oracle({ reviews: list }));
    });
  }

  it('returns 0 without reviews and the mean otherwise', () => {
    expect(averageRating(undefined)).toBe(0);
    expect(averageRating([])).toBe(0);
    expect(averageRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }])).toBe(14 / 3);
  });
});
