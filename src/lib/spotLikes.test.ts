import { describe, expect, it } from 'vitest';
import { likersToShow, spotLikeState } from './spotLikes';

describe('spotLikeState', () => {
  it('reads the stored like and count (legacy spots have neither)', () => {
    expect(spotLikeState({}, 'u', null)).toEqual({ liked: false, likes: 0 });
    expect(spotLikeState({ likedBy: ['u', 'v'], likeCount: 2 }, 'u', null)).toEqual({ liked: true, likes: 2 });
    expect(spotLikeState({ likedBy: ['v'] }, 'u', null)).toEqual({ liked: false, likes: 1 });
  });
  it('applies an optimistic tap until the server agrees', () => {
    expect(spotLikeState({ likedBy: ['v'], likeCount: 1 }, 'u', true)).toEqual({ liked: true, likes: 2 });
    expect(spotLikeState({ likedBy: ['u', 'v'], likeCount: 2 }, 'u', true)).toEqual({ liked: true, likes: 2 });
    expect(spotLikeState({ likedBy: ['u'], likeCount: 1 }, 'u', false)).toEqual({ liked: false, likes: 0 });
    expect(spotLikeState({ likedBy: ['u'], likeCount: 1 }, null, null)).toEqual({ liked: false, likes: 1 });
  });
});

describe('likersToShow', () => {
  it('lists the newest first, without blocked people', () => {
    expect(likersToShow(['a', 'b', 'c', 3], new Set(['b']))).toEqual(['c', 'a']);
    expect(likersToShow(undefined, new Set())).toEqual([]);
  });
});
