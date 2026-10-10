/**
 * Spot likes (the feed's thumb): one spotLikes/{spotId}_{uid} doc per like ({spotId, uid,
 * createdAt}), read only by the liker (rules), written only by setSpotLike; spots/{id}.likeCount
 * is the public count. Who liked a spot: getSpotLikers (blocks filtered both ways). Pure.
 */
export function spotLikeId(spotId: string, uid: string): string {
  return `${spotId}_${uid}`;
}

/** What setSpotLike does: nothing when the stored state already matches (idempotent retries). */
export function likeChange(exists: boolean, wanted: boolean): -1 | 0 | 1 {
  if (exists === wanted) return 0;
  return wanted ? 1 : -1;
}

/** Whether a spot write changed nothing but likeCount (the spot triggers have nothing to do). */
export function onlyLikeCountChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!before || !after || before.likeCount === after.likeCount) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.delete("likeCount");
  return [...keys].every((k) => JSON.stringify(before[k]) === JSON.stringify(after[k]));
}
