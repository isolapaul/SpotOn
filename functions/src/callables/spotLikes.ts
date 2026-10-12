/**
 * Spot likes:
 * - setSpotLike {spotId, liked}: sets the caller's like of an approved spot to the given state
 *   (idempotent: a retry or a stale tap never flips it back); likeCount moves in the same
 *   transaction. At most 120 changes an hour.
 * - getSpotLikers {spotId}: who liked an approved spot, newest first (at most 200), without people
 *   either side blocked.
 * Logs only {uid, spotId, outcome}.
 */
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {isUid} from "../lib/follows";
import {checkRate} from "../lib/rateLimit";
import {likeChange, spotLikeId} from "../lib/spotLikes";
import {listedPeople} from "../lib/followLists";

const LIKERS_MAX = 200;
const LIKERS_READ = 1000;

function outcome(error: unknown): string {
  return error instanceof HttpsError ? error.code : "error";
}

export const setSpotLike = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const spotId: unknown = request.data?.spotId;
  const liked: unknown = request.data?.liked;
  if (!isValidSpotId(spotId) || typeof liked !== "boolean") {
    throw new HttpsError("invalid-argument", "Invalid spotId or liked");
  }
  try {
    const spotRef = db.collection("spots").doc(spotId);
    const likeRef = db.collection("spotLikes").doc(spotLikeId(spotId, uid));
    const result = await db.runTransaction(async (tx) => {
      const [spot, like, user] = await Promise.all([
        tx.get(spotRef), tx.get(likeRef), tx.get(db.collection("users").doc(uid)),
      ]);
      // Only approved spots; anything else answers like a missing id (T30). A user whose account
      // is being deleted leaves no like behind.
      if (!spot.exists || spot.get("status") !== "approved" || !user.exists) {
        throw new HttpsError("not-found", "Spot not found");
      }
      const delta = likeChange(like.exists, liked);
      if (delta === 0) return {liked, changed: false};
      const count = await checkRate(tx, uid, "like");
      count();
      if (delta > 0) tx.create(likeRef, {spotId, uid, createdAt: FieldValue.serverTimestamp()});
      else tx.delete(likeRef);
      tx.update(spotRef, {likeCount: FieldValue.increment(delta)});
      return {liked, changed: true};
    });
    const done = liked ? "liked" : "unliked";
    logger.info("setSpotLike", {uid, spotId, outcome: result.changed ? done : "same"});
    return {liked: result.liked};
  } catch (error) {
    logger.info("setSpotLike", {uid, spotId, outcome: outcome(error)});
    throw error;
  }
});

export const getSpotLikers = onCall(async (request) => {
  const caller = request.auth?.uid;
  if (!caller) throw new HttpsError("unauthenticated", "User must be authenticated");
  const spotId: unknown = request.data?.spotId;
  if (!isValidSpotId(spotId)) throw new HttpsError("invalid-argument", "Invalid spotId");
  try {
    await db.runTransaction(async (tx) => {
      (await checkRate(tx, caller, "followList"))();
    });
    const spot = await db.collection("spots").doc(spotId).get();
    if (!spot.exists || spot.get("status") !== "approved") {
      throw new HttpsError("not-found", "Spot not found");
    }
    const blocks = db.collection("blocks");
    const [likes, blockedByMe, blockedMe] = await Promise.all([
      db.collection("spotLikes").where("spotId", "==", spotId).limit(LIKERS_READ).get(),
      blocks.where("blocker", "==", caller).select("blocked").get(),
      blocks.where("blocked", "==", caller).select("blocker").get(),
    ]);
    const hidden = new Set<string>([
      ...blockedByMe.docs.map((d) => String(d.get("blocked"))),
      ...blockedMe.docs.map((d) => String(d.get("blocker"))),
    ]);
    const at = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);
    const uids = likes.docs
      .map((d) => ({uid: d.get("uid"), at: at(d.get("createdAt"))}))
      .filter((e): e is {uid: string; at: number} => isUid(e.uid) && !hidden.has(e.uid))
      .sort((a, b) => b.at - a.at)
      .slice(0, LIKERS_MAX)
      .map((e) => e.uid);
    const refs = uids.map((u) => db.collection("publicProfiles").doc(u));
    const profiles = refs.length ? await db.getAll(...refs) : [];
    const people = listedPeople(
      profiles.map((p) => ({id: p.id, exists: p.exists, data: p.data()})),
    );
    logger.info("getSpotLikers", {uid: caller, spotId, count: people.length, outcome: "ok"});
    return {people};
  } catch (error) {
    logger.info("getSpotLikers", {uid: caller, spotId, outcome: outcome(error)});
    throw error;
  }
});
