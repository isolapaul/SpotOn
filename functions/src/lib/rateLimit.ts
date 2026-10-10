/**
 * Per-user rate limits in rateLimits/{uid} (server-only): one fixed window per action, e.g.
 * `{search: {windowStart, count}}`. Used inside the caller's transaction.
 */
import {Transaction} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {db} from "./app";
import {nextRateWindow} from "./follows";

export const RATE_LIMITS = {
  search: {windowMs: 60_000, max: 20},
  // Followers / following lists (getFollowList).
  followList: {windowMs: 60_000, max: 30},
  follow: {windowMs: 60 * 60_000, max: 60},
  report: {windowMs: 60 * 60_000, max: 20},
  reply: {windowMs: 60 * 60_000, max: 30},
  // Photo submissions for review: each call pings the admins.
  photo: {windowMs: 60 * 60_000, max: 20},
} as const;

export type RateAction = keyof typeof RATE_LIMITS;

/**
 * Reads `uid`'s window for `action` in the transaction and throws resource-exhausted
 * (`${ACTION}_RATE_LIMIT`) when it is used up. Returns the write that counts this call: run it
 * after the transaction's other reads (Firestore wants every read before the first write).
 */
export async function checkRate(
  tx: Transaction,
  uid: string,
  action: RateAction,
): Promise<() => void> {
  const ref = db.collection("rateLimits").doc(uid);
  const {windowMs, max} = RATE_LIMITS[action];
  const next = nextRateWindow((await tx.get(ref)).get(action), Date.now(), windowMs, max);
  if (!next) throw new HttpsError("resource-exhausted", `${action.toUpperCase()}_RATE_LIMIT`);
  return () => {
    tx.set(ref, {[action]: next}, {merge: true});
  };
}
