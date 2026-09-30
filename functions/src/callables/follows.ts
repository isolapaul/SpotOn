/**
 * Profiles and follows (item 8):
 * - getProfile: what a visitor may see of a profile (approved spot ids, saved spot ids if the owner
 *   shows them) and where the caller stands (following / requested / follows you).
 * - followUser: follows a public profile at once, or sends a request to a private one.
 * - unfollowUser: unfollows, or cancels the caller's request.
 * - respondFollowRequest: the target accepts or declines a request.
 * - removeFollower: the caller removes someone who follows them.
 * - searchUsers: username prefix search (signed in, 2+ characters, 10 results, 20 calls a minute).
 * Follows and requests are written only here; the counts on publicProfiles change in the same
 * transaction. Logs only uids and outcomes.
 */
import {DocumentReference, FieldPath, FieldValue, Transaction} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {
  canViewProfile, FollowState, followId, isUid, nextRateWindow, normalizeQuery,
} from "../lib/follows";
import {notifyInbox} from "../lib/inbox";

const SEARCH_LIMIT = 10;
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 20;
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

/** Adds `delta` to a public profile counter (merge, so a missing profile is created lazily). */
type Counter = "followersCount" | "followingCount";

function bump(tx: Transaction, uid: string, field: Counter, delta: number) {
  tx.set(profileRef(uid), {[field]: FieldValue.increment(delta)}, {merge: true});
}

function createFollow(tx: Transaction, follower: string, target: string) {
  const createdAt = FieldValue.serverTimestamp();
  tx.create(followRef(follower, target), {follower, target, createdAt});
  bump(tx, target, "followersCount", 1);
  bump(tx, follower, "followingCount", 1);
}

function deleteFollow(tx: Transaction, follower: string, target: string) {
  tx.delete(followRef(follower, target));
  bump(tx, target, "followersCount", -1);
  bump(tx, follower, "followingCount", -1);
}

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

export const getProfile = onCall(async (request) => {
  const caller = request.auth?.uid ?? null;
  const target: unknown = request.data?.uid;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  return logged("getProfile", caller, target, async () => {
    const isSelf = caller === target;
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
    return {...base, spotIds: spots.docs.map((d) => d.id), ...(saved ? {savedSpotIds: saved} : {})};
  });
});

export const followUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("followUser", uid, target, async () => {
    const limitRef = db.collection("rateLimits").doc(uid);
    const state = await db.runTransaction(async (tx): Promise<FollowState | "sent" | "sentQuiet"> => {
      const [targetUser, follow, pending, limits] = await Promise.all([
        tx.get(db.collection("users").doc(target)),
        tx.get(followRef(uid, target)),
        tx.get(requestRef(uid, target)),
        tx.get(limitRef),
      ]);
      if (!targetUser.exists) throw new HttpsError("not-found", "Profile not found");
      if (follow.exists) return "following";
      if (targetUser.get("profilePrivate") === true) {
        if (pending.exists) return "requested";
        const createdAt = FieldValue.serverTimestamp();
        tx.create(requestRef(uid, target), {requester: uid, target, createdAt});
        // Kept when the request is cancelled or declined, so a loop cannot spam the target.
        const last = limits.get(`requestNotified.${target}`);
        const now = Date.now();
        if (typeof last === "number" && now - last < REQUEST_NOTICE_COOLDOWN_MS) return "sentQuiet";
        tx.set(limitRef, {requestNotified: {[target]: now}}, {merge: true});
        return "sent";
      }
      if (pending.exists) tx.delete(pending.ref);
      createFollow(tx, uid, target);
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
      const [follow, pending] = await Promise.all([
        tx.get(followRef(uid, target)), tx.get(requestRef(uid, target)),
      ]);
      if (follow.exists) deleteFollow(tx, uid, target);
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
      const [pending, follow] = await Promise.all([
        tx.get(requestRef(requester, uid)), tx.get(followRef(requester, uid)),
      ]);
      if (!pending.exists) throw new HttpsError("not-found", "Request not found");
      tx.delete(pending.ref);
      if (!accept || follow.exists) return false;
      createFollow(tx, requester, uid);
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
      const follow = await tx.get(followRef(follower, uid));
      if (follow.exists) deleteFollow(tx, follower, uid);
    });
    return {removed: true};
  });
});

export const searchUsers = onCall(async (request) => {
  const uid = requireUid(request);
  const q = normalizeQuery(request.data?.q);
  if (!q) throw new HttpsError("invalid-argument", "At least 2 characters of a-z, 0-9 or _");
  return logged("searchUsers", uid, null, async () => {
    const limitRef = db.collection("rateLimits").doc(uid);
    await db.runTransaction(async (tx) => {
      const stored = (await tx.get(limitRef)).get("search");
      const next = nextRateWindow(stored, Date.now(), SEARCH_WINDOW_MS, SEARCH_MAX_PER_WINDOW);
      if (!next) throw new HttpsError("resource-exhausted", "SEARCH_RATE_LIMIT");
      tx.set(limitRef, {search: next}, {merge: true});
    });
    const names = await db.collection("usernames").orderBy(FieldPath.documentId())
      .startAt(q).endAt(q + "\uf8ff").limit(SEARCH_LIMIT).get();
    const uids = names.docs.map((d) => d.get("uid")).filter(isUid);
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
