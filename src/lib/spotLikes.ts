// Spot likes (the feed's thumb): spots.likedBy / likeCount, server-written. Pure.

/** Whether `uid` likes the spot and the count, with an optimistic tap (null = none) applied. */
export function spotLikeState(
  spot: { likedBy?: unknown; likeCount?: unknown },
  uid: string | null,
  optimistic: boolean | null,
): { liked: boolean; likes: number } {
  const likedBy = Array.isArray(spot.likedBy) ? spot.likedBy.filter((x): x is string => typeof x === 'string') : [];
  const base = typeof spot.likeCount === 'number' && spot.likeCount >= 0 ? spot.likeCount : likedBy.length;
  const stored = !!uid && likedBy.includes(uid);
  const liked = optimistic ?? stored;
  return { liked, likes: Math.max(0, base + (liked === stored ? 0 : liked ? 1 : -1)) };
}

/** The likers to list, newest first, without people the viewer blocked. */
export function likersToShow(likedBy: unknown, hidden: ReadonlySet<string>): string[] {
  const ids = Array.isArray(likedBy) ? likedBy.filter((x): x is string => typeof x === 'string') : [];
  return [...ids].reverse().filter((id) => !hidden.has(id));
}
