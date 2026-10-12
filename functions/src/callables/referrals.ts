/**
 * Referral program (growth plan §2):
 * - claimReferral {code}: the caller names who invited them (the inviter's username, or their
 *   invite link). Once per account, within 7 days of signing up (Firebase Auth's creation time,
 *   which the client cannot change), never yourself, not across a block. Writes
 *   referrals/{caller} {referrer, invitee, createdAt, spotApproved:false} and users.referredBy,
 *   recomputes both users' XP and tells the inviter (inbox + push).
 * Logs only {uid, outcome}.
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {auth, db} from "../lib/app";
import {canClaimReferral, normalizeInviteCode} from "../lib/referrals";
import {followId} from "../lib/follows";
import {syncUserLevel} from "../lib/userLevel";
import {notifyInbox} from "../lib/inbox";

export const claimReferral = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const code = normalizeInviteCode(request.data?.code);
  if (!code) throw new HttpsError("invalid-argument", "INVITE_CODE_INVALID");
  let outcome = "error";
  try {
    const created = Date.parse((await auth.getUser(uid)).metadata.creationTime);
    if (!canClaimReferral(created, Date.now())) {
      throw new HttpsError("failed-precondition", "INVITE_TOO_LATE");
    }
    const owner = (await db.collection("usernames").doc(code).get()).get("uid");
    if (typeof owner !== "string" || !owner) {
      throw new HttpsError("not-found", "INVITE_CODE_UNKNOWN");
    }
    if (owner === uid) throw new HttpsError("invalid-argument", "INVITE_SELF");

    const referralRef = db.collection("referrals").doc(uid);
    const userRef = db.collection("users").doc(uid);
    const inviterRef = db.collection("users").doc(owner);
    const blocks = db.collection("blocks");
    await db.runTransaction(async (tx) => {
      const [existing, me, inviter, ab, ba] = await Promise.all([
        tx.get(referralRef), tx.get(userRef), tx.get(inviterRef),
        tx.get(blocks.doc(followId(uid, owner))), tx.get(blocks.doc(followId(owner, uid))),
      ]);
      if (existing.exists || me.get("referredBy")) {
        throw new HttpsError("already-exists", "INVITE_ALREADY_CLAIMED");
      }
      if (!me.exists || !inviter.exists) {
        throw new HttpsError("not-found", "INVITE_CODE_UNKNOWN");
      }
      // A block either way answers like an unknown code (it must not reveal the block).
      if (ab.exists || ba.exists) throw new HttpsError("not-found", "INVITE_CODE_UNKNOWN");
      // The inviter must not have been invited by the caller (no swapping invites back and forth).
      const back = await tx.get(db.collection("referrals").doc(owner));
      if (back.exists && back.get("referrer") === uid) {
        throw new HttpsError("invalid-argument", "INVITE_SELF");
      }
      tx.create(referralRef, {
        referrer: owner, invitee: uid, createdAt: FieldValue.serverTimestamp(), spotApproved: false,
      });
      tx.update(userRef, {referredBy: owner});
    });
    outcome = "claimed";
    await Promise.all([syncUserLevel(owner), syncUserLevel(uid)]);
    const name = (await db.collection("publicProfiles").doc(uid).get()).get("username");
    await notifyInbox({
      uid: owner, type: "invite_joined", spotId: "", spotName: "", actorUid: uid,
      actorName: typeof name === "string" ? name : "",
    });
    return {referrer: code};
  } catch (error) {
    outcome = error instanceof HttpsError ? error.message : "error";
    throw error;
  } finally {
    logger.info("claimReferral", {uid, outcome});
  }
});
