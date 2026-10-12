import { describe, expect, it } from 'vitest';
import { spotLikeState } from './spotLikes';

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
