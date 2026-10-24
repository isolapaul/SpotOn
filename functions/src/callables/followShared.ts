/**
 * Shared helpers of the follow, profile and block callables (follows.ts, people.ts, blocks.ts):
 * argument checks, document refs, block checks, follow edges with their publicProfiles counters,
 * and the one log line per call.
 */
import {FieldValue, Transaction} from "firebase-admin/firestore";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {followId, isUid} from "../lib/follows";

export function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  return uid;
}

export function requireTarget(request: CallableRequest, caller: string | null): string {
  const target: unknown = request.data?.uid;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  if (target === caller) throw new HttpsError("invalid-argument", "Not yourself");
  return target;
}

export const followRef = (follower: string, target: string) =>
  db.collection("follows").doc(followId(follower, target));
export const requestRef = (requester: string, target: string) =>
  db.collection("followRequests").doc(followId(requester, target));
export const profileRef = (uid: string) => db.collection("publicProfiles").doc(uid);
export const blockRef = (blocker: string, blocked: string) =>
  db.collection("blocks").doc(followId(blocker, blocked));

/** Whether either of the two blocked the other. */
export async function blockedEitherWay(
  a: string,
  b: string,
): Promise<{byA: boolean; byB: boolean}> {
  const [ab, ba] = await db.getAll(blockRef(a, b), blockRef(b, a));
  return {byA: ab.exists, byB: ba.exists};
}

/** Whether each user still has a users doc, read in the transaction (account deletion). */
export type Alive = Record<string, boolean>;

export async function alive(tx: Transaction, ...uids: string[]): Promise<Alive> {
  const snaps = await Promise.all(uids.map((u) => tx.get(db.collection("users").doc(u))));
  return Object.fromEntries(uids.map((u, i) => [u, snaps[i].exists]));
}

/**
 * Adds `delta` to a public profile counter (merge, so a missing profile is created lazily) of a
 * user who still exists: a deleted account's profile is never brought back by a counter.
 */
type Counter = "followersCount" | "followingCount";

export function bump(tx: Transaction, uid: string, field: Counter, delta: number, live: Alive) {
  if (!live[uid]) return;
  tx.set(profileRef(uid), {[field]: FieldValue.increment(delta)}, {merge: true});
}

/** A new follow edge with its counters; both users must exist (callers check `live`). */
export function createFollow(tx: Transaction, follower: string, target: string, live: Alive) {
  const createdAt = FieldValue.serverTimestamp();
  tx.create(followRef(follower, target), {follower, target, createdAt});
  bump(tx, target, "followersCount", 1, live);
  bump(tx, follower, "followingCount", 1, live);
}

export function deleteFollow(tx: Transaction, follower: string, target: string, live: Alive) {
  tx.delete(followRef(follower, target));
  bump(tx, target, "followersCount", -1, live);
  bump(tx, follower, "followingCount", -1, live);
}

/** Either of the two blocked the other, read in the transaction (so a block cannot race it). */
export async function blockedInTx(
  tx: Transaction,
  a: string,
  b: string,
): Promise<{byA: boolean; byB: boolean}> {
  const [ab, ba] = await Promise.all([tx.get(blockRef(a, b)), tx.get(blockRef(b, a))]);
  return {byA: ab.exists, byB: ba.exists};
}

/** Runs a callable body with one log line: {uid, target, outcome}. */
export async function logged<T>(
  name: string,
  uid: string | null,
  target: string | null,
  body: () => Promise<T>,
) {
  try {
    const result = await body();
    logger.info(name, {uid, target, outcome: "ok"});
    return result;
  } catch (error) {
    logger.info(name, {uid, target, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
}
