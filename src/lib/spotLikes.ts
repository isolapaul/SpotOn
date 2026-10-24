// Spot likes (the feed's thumb): the public spots.likeCount and the user's own liked set. Pure.

/**
 * Whether the user likes the spot and the count shown, with an optimistic tap applied: `tap` is
 * the state the user asked for and `on` the stored state it was made against; once the stored
 * state changes (the listener caught up, or another device changed it) the tap no longer applies.
 */
export function spotLikeState(
  likeCount: unknown,
  stored: boolean,
  tap: { liked: boolean; on: boolean } | null,
): { liked: boolean; likes: number } {
  const base = typeof likeCount === 'number' && likeCount > 0 ? Math.floor(likeCount) : 0;
  const liked = tap && tap.on === stored ? tap.liked : stored;
  return { liked, likes: Math.max(liked ? 1 : 0, base + (liked === stored ? 0 : liked ? 1 : -1)) };
}

/** An optimistic tap: the state asked for on a spot (`liked`) and the stored state it was made against (`on`). */
export interface LikeTap {
  spotId: string;
  liked: boolean;
  on: boolean;
}

/**
 * The tap still to apply, or null once it is spent: the stored state moved (the listener caught up,
 * or another device changed it) or the hook now shows another spot. A spent tap must be dropped,
 * not kept: the stored state may later return to `on` (the like undone elsewhere), and a kept tap
 * would then show the old like again.
 */
export function liveLikeTap(tap: LikeTap | null, spotId: string, stored: boolean): LikeTap | null {
  return tap && tap.spotId === spotId && tap.on === stored ? tap : null;
}
