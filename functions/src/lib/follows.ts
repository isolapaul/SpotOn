/**
 * Follows (item 8): follows/{follower}_{target} and followRequests/{requester}_{target}, written
 * only by the follow callables (and deleteAccount). publicProfiles/{uid}.followersCount and
 * .followingCount are kept in the same transactions. Pure helpers here.
 */

/** A Firebase uid we accept from callers (never a path). */
export function isUid(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && x.length <= 128 && !x.includes("/") &&
    x !== "." && x !== "..";
}

export function followId(follower: string, target: string): string {
  return `${follower}_${target}`;
}

/** Where the caller stands with someone. */
export type FollowState = "none" | "requested" | "following";

/** Profile page visibility: public profiles for everyone, private ones for accepted followers. */
export function canViewProfile(
  o: {isPrivate: boolean; isSelf: boolean; following: boolean},
): boolean {
  return o.isSelf || !o.isPrivate || o.following;
}

export const BIO_MAX = 150;

/** Rate limit (people search): at most `max` calls per `windowMs`; returns the new counter. */
export function nextRateWindow(
  stored: {windowStart?: unknown; count?: unknown} | undefined,
  now: number,
  windowMs: number,
  max: number,
): {windowStart: number; count: number} | null {
  const start = typeof stored?.windowStart === "number" ? stored.windowStart : null;
  const count = typeof stored?.count === "number" ? stored.count : 0;
  if (start === null || now - start >= windowMs) return {windowStart: now, count: 1};
  return count >= max ? null : {windowStart: start, count: count + 1};
}

/** A search query: lowercase username characters, 2-20 long, else null. */
export function normalizeQuery(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const q = x.trim().toLowerCase().replace(/^@/, "");
  return /^[a-z0-9_]{2,20}$/.test(q) ? q : null;
}
