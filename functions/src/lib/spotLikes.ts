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

/** Server counters on a spot: a write of only these leaves the spot triggers nothing to do. */
export const SPOT_COUNTERS = ["likeCount", "viewCount", "visitCount"] as const;

/** Whether a spot write changed some counters (SPOT_COUNTERS) and nothing else. */
export function onlyCountersChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!before || !after) return false;
  const counters: readonly string[] = SPOT_COUNTERS;
  if (counters.every((k) => before[k] === after[k])) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of counters) keys.delete(k);
  return [...keys].every((k) => JSON.stringify(before[k]) === JSON.stringify(after[k]));
}
