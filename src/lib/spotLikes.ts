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
