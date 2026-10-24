/**
 * Follows (item 8):
 * - followUser: follows a public profile at once, or sends a request to a private one.
 * - unfollowUser: unfollows, or cancels the caller's request.
 * - respondFollowRequest: the target accepts or declines a request.
 * - removeFollower: the caller removes someone who follows them.
 * Follows and requests are written only here and in blocks.ts; the counts on publicProfiles change
 * in the same transaction. Logs only uids and outcomes. Profiles and search: people.ts.
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {db} from "../lib/app";
import {FollowState, followId} from "../lib/follows";
import {notifyInbox} from "../lib/inbox";
import {checkRate} from "../lib/rateLimit";
import {
  alive, blockedInTx, createFollow, deleteFollow, followRef, logged, profileRef, requestRef,
  requireTarget, requireUid,
} from "./followShared";

/** A user hears about one requester or new follower at most once a day (request/cancel loops). */
const REQUEST_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** followNotices/{requester}_{target}: when the target last heard about a request (server-only). */
const noticeRef = (requester: string, target: string) =>
  db.collection("followNotices").doc(followId(requester, target));

async function usernameOf(uid: string): Promise<string> {
  const name = (await profileRef(uid).get()).get("username");
  return typeof name === "string" ? name : "";
}

/** followUser's transaction result: "sent"/"followed" also notify the target. */
type FollowOutcome = FollowState | "sent" | "sentQuiet" | "followed";

export const followUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("followUser", uid, target, async () => {
    const state = await db.runTransaction(async (tx): Promise<FollowOutcome> => {
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
      // The target hears about a new follower once a day per pair (follow/unfollow loops).
      const last = notice.get("at");
      const now = Date.now();
      if (typeof last === "number" && now - last < REQUEST_NOTICE_COOLDOWN_MS) return "following";
      tx.set(noticeRef(uid, target), {requester: uid, target, at: now});
      return "followed";
    });
    if (state === "sent" || state === "followed") {
      await notifyInbox({uid: target, type: state === "sent" ? "follow_request" : "new_follower",
        spotId: "", spotName: "", actorUid: uid, actorName: await usernameOf(uid)});
      return {state: state === "sent" ? "requested" : "following"};
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
