import { describe, expect, it } from 'vitest';
import { liveLikeTap, spotLikeState, type LikeTap } from './spotLikes';

describe('spotLikeState', () => {
  it('reads the stored like and count (older spots have no count)', () => {
    expect(spotLikeState(undefined, false, null)).toEqual({ liked: false, likes: 0 });
    expect(spotLikeState(2, true, null)).toEqual({ liked: true, likes: 2 });
    expect(spotLikeState(-3, false, null)).toEqual({ liked: false, likes: 0 });
  });
  it('applies a tap until the stored state moves', () => {
    expect(spotLikeState(1, false, { liked: true, on: false })).toEqual({ liked: true, likes: 2 });
    // The listener caught up: the stored state and the count already include the like.
    expect(spotLikeState(2, true, { liked: true, on: false })).toEqual({ liked: true, likes: 2 });
    expect(spotLikeState(1, true, { liked: false, on: true })).toEqual({ liked: false, likes: 0 });
  });
  it('never shows a like with a zero count', () => {
    expect(spotLikeState(0, true, null)).toEqual({ liked: true, likes: 1 });
  });
});

describe('liveLikeTap', () => {
  const tap: LikeTap = { spotId: 'a', liked: true, on: false };

  it('keeps a tap until the stored state moves', () => {
    expect(liveLikeTap(tap, 'a', false)).toBe(tap);
    expect(liveLikeTap(tap, 'a', true)).toBeNull();
    expect(liveLikeTap(null, 'a', false)).toBeNull();
  });

  it('never applies a tap to another spot', () => {
    // The details panel stays mounted when it switches spots (a shared link opened over a spot).
    expect(liveLikeTap(tap, 'b', false)).toBeNull();
  });

  it('a spent tap does not come back when the like is undone elsewhere', () => {
    // Like in the details, the listener confirms, then another device removes the like.
    let current: LikeTap | null = tap;
    for (const stored of [false, true, false]) current = liveLikeTap(current, 'a', stored);
    expect(spotLikeState(0, false, current)).toEqual({ liked: false, likes: 0 });
  });
});
