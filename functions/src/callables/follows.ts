/**
 * Profiles and follows (item 8):
 * - getProfile: what a visitor may see of a profile (approved spot ids, saved spot ids if the owner
 *   shows them) and where the caller stands (following / requested / follows you).
 * - followUser: follows a public profile at once, or sends a request to a private one.
 * - unfollowUser: unfollows, or cancels the caller's request.
 * - respondFollowRequest: the target accepts or declines a request.
 * - removeFollower: the caller removes someone who follows them.
 * - searchUsers: username prefix search (signed in, 2+ characters, 10 results, 20 calls a minute).
 * - blockUser / unblockUser: a block ends the follows and requests both ways; neither can follow or
 *   open the other's profile, and they do not find each other in the search. The blocked user is
 *   not told (to them the profile looks unavailable).
 * Follows and requests are written only here; the counts on publicProfiles change in the same
 * transaction. Logs only uids and outcomes.
 */
import {
  DocumentData, DocumentReference, DocumentSnapshot, FieldPath, FieldValue, Transaction,
} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {
  canViewProfile, FollowState, followId, isUid, normalizeQuery,
} from "../lib/follows";
import {notifyInbox} from "../lib/inbox";
import {checkRate} from "../lib/rateLimit";

const SEARCH_LIMIT = 10;
/** A private user hears about one requester at most once a day (request/cancel loops). */
const REQUEST_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  return uid;
}

function requireTarget(request: CallableRequest, caller: string | null): string {
  const target: unknown = request.data?.uid;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  if (target === caller) throw new HttpsError("invalid-argument", "Not yourself");
  return target;
}

const followRef = (follower: string, target: string) =>
  db.collection("follows").doc(followId(follower, target));
const requestRef = (requester: string, target: string) =>
  db.collection("followRequests").doc(followId(requester, target));
const profileRef = (uid: string) => db.collection("publicProfiles").doc(uid);
const blockRef = (blocker: string, blocked: string) =>
  db.collection("blocks").doc(followId(blocker, blocked));

/** Whether either of the two blocked the other. */
async function blockedEitherWay(a: string, b: string): Promise<{byA: boolean; byB: boolean}> {
  const [ab, ba] = await db.getAll(blockRef(a, b), blockRef(b, a));
  return {byA: ab.exists, byB: ba.exists};
}

/** Whether each user still has a users doc, read in the transaction (account deletion). */
type Alive = Record<string, boolean>;

async function alive(tx: Transaction, ...uids: string[]): Promise<Alive> {
  const snaps = await Promise.all(uids.map((u) => tx.get(db.collection("users").doc(u))));
  return Object.fromEntries(uids.map((u, i) => [u, snaps[i].exists]));
}

/**
 * Adds `delta` to a public profile counter (merge, so a missing profile is created lazily) of a
 * user who still exists: a deleted account's profile is never brought back by a counter.
 */
type Counter = "followersCount" | "followingCount";

function bump(tx: Transaction, uid: string, field: Counter, delta: number, live: Alive) {
  if (!live[uid]) return;
  tx.set(profileRef(uid), {[field]: FieldValue.increment(delta)}, {merge: true});
}

/** A new follow edge with its counters; both users must exist (callers check `live`). */
function createFollow(tx: Transaction, follower: string, target: string, live: Alive) {
  const createdAt = FieldValue.serverTimestamp();
  tx.create(followRef(follower, target), {follower, target, createdAt});
  bump(tx, target, "followersCount", 1, live);
  bump(tx, follower, "followingCount", 1, live);
}

function deleteFollow(tx: Transaction, follower: string, target: string, live: Alive) {
  tx.delete(followRef(follower, target));
  bump(tx, target, "followersCount", -1, live);
  bump(tx, follower, "followingCount", -1, live);
}

/** Either of the two blocked the other, read in the transaction (so a block cannot race it). */
async function blockedInTx(
  tx: Transaction,
  a: string,
  b: string,
): Promise<{byA: boolean; byB: boolean}> {
  const [ab, ba] = await Promise.all([tx.get(blockRef(a, b)), tx.get(blockRef(b, a))]);
  return {byA: ab.exists, byB: ba.exists};
}

/** followNotices/{requester}_{target}: when the target last heard about a request (server-only). */
const noticeRef = (requester: string, target: string) =>
  db.collection("followNotices").doc(followId(requester, target));

async function usernameOf(uid: string): Promise<string> {
  const name = (await profileRef(uid).get()).get("username");
  return typeof name === "string" ? name : "";
}

/** Runs a callable body with one log line: {uid, target, outcome}. */
async function logged<T>(
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

const MAX_SHARED_LISTS = 30;

interface SharedList {
  id: string;
  name: string;
  spotIds: string[];
}

function sharedList(id: string, d: DocumentData): SharedList | null {
  if (typeof d.name !== "string" || !d.name.trim()) return null;
  const spotIds = Array.isArray(d.spotIds) ?
    d.spotIds.filter((x: unknown): x is string => typeof x === "string") : [];
  return {id, name: d.name.trim(), spotIds};
}

export const getProfile = onCall(async (request) => {
  const caller = request.auth?.uid ?? null;
  const target: unknown = request.data?.uid;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  return logged("getProfile", caller, target, async () => {
    const isSelf = caller === target;
    if (caller && !isSelf) {
      const blocks = await blockedEitherWay(caller, target);
      if (blocks.byB) throw new HttpsError("not-found", "Profile not found");
      if (blocks.byA) return {canView: false, relation: "none", followsYou: false, blocked: true};
    }
    const refs: DocumentReference[] = [db.collection("users").doc(target)];
    if (caller && !isSelf) {
      refs.push(followRef(caller, target), requestRef(caller, target), followRef(target, caller));
    }
    const [userSnap, following, requested, followsYou] = await db.getAll(...refs);
    if (!userSnap.exists) throw new HttpsError("not-found", "Profile not found");
    const isPrivate = userSnap.get("profilePrivate") === true;
    let relation: FollowState = "none";
    if (following?.exists) relation = "following";
    else if (requested?.exists) relation = "requested";
    const canView = canViewProfile({isPrivate, isSelf, following: relation === "following"});
    const base = {canView, relation, followsYou: followsYou?.exists === true};
    if (!canView) return base;

    const spots = await db.collection("spots").where("createdBy", "==", target)
      .where("status", "==", "approved").select().get();
    const saved = userSnap.get("showSaved") === true || isSelf ?
      (Array.isArray(userSnap.get("savedSpots")) ? userSnap.get("savedSpots") : [])
        .filter((id: unknown): id is string => typeof id === "string") :
      null;
    // The owner's lists marked "show on my profile" (the owner reads all of them directly).
    const lists = isSelf ? [] : (await db.collection("users").doc(target).collection("lists")
      .where("shared", "==", true).limit(MAX_SHARED_LISTS).get()).docs
      .map((d) => sharedList(d.id, d.data()))
      .filter((l): l is SharedList => l !== null);
    return {
      ...base,
      spotIds: spots.docs.map((d) => d.id),
      ...(saved ? {savedSpotIds: saved} : {}),
      ...(lists.length ? {lists} : {}),
    };
  });
});

export const followUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("followUser", uid, target, async () => {
    const state = await db.runTransaction(async (tx): Promise<FollowState | "sent" | "sentQuiet"> => {
      const blocks = await blockedInTx(tx, uid, target);
      if (blocks.byB) throw new HttpsError("not-found", "Profile not found");
      if (blocks.byA) throw new HttpsError("failed-precondition", "UNBLOCK_FIRST");
      const [targetUser, callerUser, follow, pending, notice] = await Promise.all([
        tx.get(db.collection("users").doc(target)),
        tx.get(db.collection("users").doc(uid)),
        tx.get(followRef(uid, target)),
        tx.get(requestRef(uid, target)),
        tx.get(noticeRef(uid, target)),
      ]);
      if (!targetUser.exists || !callerUser.exists) throw new HttpsError("not-found", "Profile not found");
      if (follow.exists) return "following";
      const count = await checkRate(tx, uid, "follow");
      count();
      if (targetUser.get("profilePrivate") === true) {
        if (pending.exists) return "requested";
        const createdAt = FieldValue.serverTimestamp();
        tx.create(requestRef(uid, target), {requester: uid, target, createdAt});
        // Kept when the request is cancelled or declined, so a loop cannot spam the target.
        const last = notice.get("at");
        const now = Date.now();
        if (typeof last === "number" && now - last < REQUEST_NOTICE_COOLDOWN_MS) return "sentQuiet";
        tx.set(noticeRef(uid, target), {requester: uid, target, at: now});
        return "sent";
      }
      if (pending.exists) tx.delete(pending.ref);
      createFollow(tx, uid, target, {[uid]: true, [target]: true});
      return "following";
    });
    if (state === "sent") {
      await notifyInbox({uid: target, type: "follow_request", spotId: "", spotName: "",
        actorUid: uid, actorName: await usernameOf(uid)});
      return {state: "requested"};
    }
    return {state: state === "sentQuiet" ? "requested" : state};
  });
});

export const unfollowUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("unfollowUser", uid, target, async () => {
    await db.runTransaction(async (tx) => {
      const [follow, pending, live] = await Promise.all([
        tx.get(followRef(uid, target)), tx.get(requestRef(uid, target)), alive(tx, uid, target),
      ]);
      if (follow.exists) deleteFollow(tx, uid, target, live);
      if (pending.exists) tx.delete(pending.ref);
    });
    return {state: "none"};
  });
});

export const respondFollowRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const requester = requireTarget(request, uid);
  const accept = request.data?.accept === true;
  return logged("respondFollowRequest", uid, requester, async () => {
    const accepted = await db.runTransaction(async (tx) => {
      const [pending, follow, blocks, live] = await Promise.all([
        tx.get(requestRef(requester, uid)), tx.get(followRef(requester, uid)),
        blockedInTx(tx, uid, requester), alive(tx, uid, requester),
      ]);
      if (!pending.exists) throw new HttpsError("not-found", "Request not found");
      tx.delete(pending.ref);
      // A requester whose account is being deleted gets no edge (nobody would clean it up).
      if (!accept || follow.exists || blocks.byA || blocks.byB || !live[requester] || !live[uid]) {
        return false;
      }
      createFollow(tx, requester, uid, live);
      return true;
    });
    if (accepted) {
      await notifyInbox({uid: requester, type: "follow_accepted", spotId: "", spotName: "",
        actorUid: uid, actorName: await usernameOf(uid)});
    }
    return {accepted};
  });
});

export const removeFollower = onCall(async (request) => {
  const uid = requireUid(request);
  const follower = requireTarget(request, uid);
  return logged("removeFollower", uid, follower, async () => {
    await db.runTransaction(async (tx) => {
      const [follow, live] = await Promise.all([
        tx.get(followRef(follower, uid)), alive(tx, follower, uid),
      ]);
      if (follow.exists) deleteFollow(tx, follower, uid, live);
    });
    return {removed: true};
  });
});

export const searchUsers = onCall(async (request) => {
  const uid = requireUid(request);
  const q = normalizeQuery(request.data?.q);
  if (!q) throw new HttpsError("invalid-argument", "At least 2 characters of a-z, 0-9 or _");
  return logged("searchUsers", uid, null, async () => {
    await db.runTransaction(async (tx) => {
      (await checkRate(tx, uid, "search"))();
    });
    const names = await db.collection("usernames").orderBy(FieldPath.documentId())
      .startAt(q).endAt(q + "\uf8ff").limit(SEARCH_LIMIT).get();
    const found = names.docs.map((d) => d.get("uid")).filter(isUid).filter((u) => u !== uid);
    const blocked = new Set((await Promise.all(found.map(async (u) => {
      const b = await blockedEitherWay(uid, u);
      return b.byA || b.byB ? u : null;
    }))).filter((u): u is string => u !== null));
    const uids = found.filter((u) => !blocked.has(u));
    if (!uids.length) return {results: []};
    const profiles = await db.getAll(...uids.map(profileRef));
    return {
      results: profiles.filter((p) => p.exists).map((p) => ({
        uid: p.id,
        username: String(p.get("username") ?? ""),
        profilePictureURL: typeof p.get("profilePictureURL") === "string" ?
          p.get("profilePictureURL") : null,
        level: typeof p.get("level") === "number" ? p.get("level") : null,
        isPrivate: p.get("isPrivate") === true,
      })),
    };
  });
});

/** Deletes a follow edge with its counters, if it still exists. */
function dropFollow(
  tx: Transaction,
  follow: DocumentSnapshot,
  follower: string,
  target: string,
  live: Alive,
) {
  if (follow.exists) deleteFollow(tx, follower, target, live);
}

export const blockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("blockUser", uid, target, async () => {
    await db.runTransaction(async (tx) => {
      const [ab, ba, reqAb, reqBa, block, live] = await Promise.all([
        tx.get(followRef(uid, target)), tx.get(followRef(target, uid)),
        tx.get(requestRef(uid, target)), tx.get(requestRef(target, uid)),
        tx.get(blockRef(uid, target)), alive(tx, uid, target),
      ]);
      dropFollow(tx, ab, uid, target, live);
      dropFollow(tx, ba, target, uid, live);
      if (reqAb.exists) tx.delete(reqAb.ref);
      if (reqBa.exists) tx.delete(reqBa.ref);
      if (!block.exists) {
        const createdAt = FieldValue.serverTimestamp();
        tx.create(blockRef(uid, target), {blocker: uid, blocked: target, createdAt});
      }
    });
    return {blocked: true};
  });
});

export const unblockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("unblockUser", uid, target, async () => {
    await blockRef(uid, target).delete();
    return {blocked: false};
  });
});
