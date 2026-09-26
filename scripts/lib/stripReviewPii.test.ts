import { describe, expect, it } from 'vitest';
import { PII_REVIEW_KEYS, stripReviews } from './stripReviewPii';

const createdAt = { seconds: 1, nanoseconds: 0 };

function modernReview(id: string) {
  return {
    id,
    userId: `uid-${id}`,
    userName: `name-${id}`,
    userPhoto: '',
    rating: 5,
    comment: `comment-${id}`,
    createdAt,
  };
}

function legacyReview(id: string) {
  return {
    id,
    userId: `uid-${id}`,
    userName: `name-${id}`,
    userEmail: `${id}@example.com`,
    userPhoto: 'https://example.com/p.png',
    rating: 3,
    comment: `comment-${id}`,
    createdAt,
    userSpotsCount: 12,
    customNameColor: 'text-red-500',
    customNameFont: 'font-mono',
  };
}

/** legacyReview(id) without the four keys: every other key, value and the key order unchanged. */
function strippedLegacy(id: string) {
  return {
    id,
    userId: `uid-${id}`,
    userName: `name-${id}`,
    userPhoto: 'https://example.com/p.png',
    rating: 3,
    comment: `comment-${id}`,
    createdAt,
  };
}

describe('stripReviews', () => {
  it('lists exactly the PII / spoofable keys', () => {
    expect([...PII_REVIEW_KEYS]).toEqual(['userEmail', 'userSpotsCount', 'customNameColor', 'customNameFont']);
  });

  it('strips mixed legacy and new reviews, preserving order and every other key', () => {
    const input = [legacyReview('a'), modernReview('b'), legacyReview('c')];
    const result = stripReviews(input);

    expect(result.changed).toBe(true);
    expect(result.strippedCount).toBe(2);
    expect(result.reviews).toEqual([strippedLegacy('a'), modernReview('b'), strippedLegacy('c')]);
    expect((result.reviews as { id: string }[]).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    for (const review of result.reviews as Record<string, unknown>[]) {
      expect(Object.keys(review)).toEqual(['id', 'userId', 'userName', 'userPhoto', 'rating', 'comment', 'createdAt']);
    }
  });

  it('does not mutate the input and keeps untouched elements by identity', () => {
    const legacy = legacyReview('a');
    const modern = modernReview('b');
    const input = [legacy, modern];
    const snapshot = structuredClone(input);

    const result = stripReviews(input);

    expect(input).toEqual(snapshot);
    expect(result.reviews[1]).toBe(modern);
    expect((result.reviews[0] as { createdAt: unknown }).createdAt).toBe(createdAt);
  });

  it('counts a review with only one of the keys', () => {
    const { id, userId, rating } = modernReview('x');
    const result = stripReviews([{ id, userId, userSpotsCount: 0, rating }]);
    expect(result).toEqual({ changed: true, reviews: [{ id, userId, rating }], strippedCount: 1 });
  });

  it('removes keys even when their value is null or undefined', () => {
    const result = stripReviews([{ id: 'n', userEmail: null, customNameFont: undefined }]);
    expect(result).toEqual({ changed: true, reviews: [{ id: 'n' }], strippedCount: 1 });
  });

  it('gives changed:false and an empty list for non-array input (caller skips the doc)', () => {
    for (const input of [undefined, null, 'x', 3, { 0: legacyReview('a') }]) {
      expect(stripReviews(input)).toEqual({ changed: false, reviews: [], strippedCount: 0 });
    }
  });

  it('handles an empty array', () => {
    expect(stripReviews([])).toEqual({ changed: false, reviews: [], strippedCount: 0 });
  });

  it('reports an already clean array as unchanged', () => {
    const input = [modernReview('a'), modernReview('b')];
    const result = stripReviews(input);
    expect(result.changed).toBe(false);
    expect(result.strippedCount).toBe(0);
    expect(result.reviews).toEqual(input);
    expect(result.reviews[0]).toBe(input[0]);
  });

  it('keeps non-object elements as they are, in place', () => {
    const nested = [legacyReview('inner')];
    class Custom {
      userEmail = 'kept@example.com';
    }
    const custom = new Custom();
    const input: unknown[] = [null, 'text', 7, nested, legacyReview('a'), custom, undefined];
    const result = stripReviews(input);

    expect(result.strippedCount).toBe(1);
    expect(result.reviews).toHaveLength(input.length);
    expect(result.reviews[0]).toBeNull();
    expect(result.reviews[1]).toBe('text');
    expect(result.reviews[2]).toBe(7);
    expect(result.reviews[3]).toBe(nested);
    expect(result.reviews[4]).toEqual(strippedLegacy('a'));
    expect(result.reviews[5]).toBe(custom);
    expect(result.reviews[6]).toBeUndefined();
  });

  it('is idempotent', () => {
    const first = stripReviews([legacyReview('a'), modernReview('b')]);
    const second = stripReviews(first.reviews);
    expect(second.changed).toBe(false);
    expect(second.strippedCount).toBe(0);
    expect(second.reviews).toEqual(first.reviews);
  });
});
