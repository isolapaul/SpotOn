import { describe, expect, it } from 'vitest';
import type { Review } from '@/store/useSpotStore';
import { averageRating } from './rating';

const reviews = (ratings: number[]): Review[] =>
  ratings.map((rating, i) => ({ id: `r${i}`, userId: `u${i}`, userName: 'x', rating, comment: '' }) as unknown as Review);

// The values the pre-T23 call sites (profile, details, info window, Explore) computed.
const SAMPLES: Array<[string, Review[] | undefined, number]> = [
  ['undefined', undefined, 0],
  ['[]', [], 0],
  ['[5]', reviews([5]), 5],
  ['[1,2]', reviews([1, 2]), 1.5],
  ['[4,5,5]', reviews([4, 5, 5]), 14 / 3],
  ['[1,1,1,2,2,2,3]', reviews([1, 1, 1, 2, 2, 2, 3]), 12 / 7],
  ['[3,4,4,5,5,5,1,2,2]', reviews([3, 4, 4, 5, 5, 5, 1, 2, 2]), 31 / 9],
];

describe('averageRating', () => {
  it.each(SAMPLES)('%s', (_name, list, expected) => {
    expect(averageRating(list)).toBe(expected);
  });

  it('returns 0 without reviews and the mean otherwise', () => {
    expect(averageRating(undefined)).toBe(0);
    expect(averageRating([])).toBe(0);
    expect(averageRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }])).toBe(14 / 3);
  });
});
