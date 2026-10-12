import { describe, expect, it } from 'vitest';
import { compactCount, mostPopularIds, popularity } from './popularity';
import type { Review } from '@/store/useSpotStore';

const r = {} as Review;

describe('popularity', () => {
  it('weighs views, likes, reviews and visits', () => {
    expect(popularity({})).toBe(0);
    expect(popularity({ viewCount: 7, likeCount: 2, visitCount: 1, reviews: [r, r] })).toBe(7 + 10 + 10 + 20);
    expect(popularity({ viewCount: -3, likeCount: Number.NaN })).toBe(0);
  });
  it('picks the most popular ids', () => {
    const spots = [{ id: 'a', viewCount: 1 }, { id: 'b', viewCount: 50 }, { id: 'c', likeCount: 3 }];
    expect([...mostPopularIds(spots, 2)]).toEqual(['b', 'c']);
  });
  it('shortens big counts', () => {
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1234)).toBe('1.2k');
    expect(compactCount(12_900)).toBe('12k');
  });
});
