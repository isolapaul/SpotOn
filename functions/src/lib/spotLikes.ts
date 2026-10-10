/**
 * Spot likes (the feed's thumb): spots/{id}.likedBy (uids, oldest first) and .likeCount, written
 * only by the toggleSpotLike callable (rules). Pure.
 */

/** A spot keeps at most this many likers (the count stays exact; the list drops the oldest). */
export const MAX_LIKED_BY = 5000;

export function toggleSpotLikeIn(
  likedBy: unknown,
  uid: string,
): {likedBy: string[]; likeCount: number; liked: boolean} {
  const current = (Array.isArray(likedBy) ? likedBy : [])
    .filter((x): x is string => typeof x === "string");
  if (current.includes(uid)) {
    const next = current.filter((x) => x !== uid);
    return {likedBy: next, likeCount: next.length, liked: false};
  }
  const next = [...current, uid].slice(-MAX_LIKED_BY);
  return {likedBy: next, likeCount: next.length, liked: true};
}
