/**
 * toggleSpotLike: the signed-in user likes or unlikes an approved spot (the feed's thumb and
 * double tap). One transaction keeps likedBy and likeCount together; at most 120 an hour.
 * Logs only {uid, spotId, outcome}.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {checkRate} from "../lib/rateLimit";
import {toggleSpotLikeIn} from "../lib/spotLikes";

export const toggleSpotLike = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const spotId: unknown = request.data?.spotId;
  if (!isValidSpotId(spotId)) throw new HttpsError("invalid-argument", "Invalid spotId");
  try {
    const ref = db.collection("spots").doc(spotId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // Only approved spots are likeable; anything else answers like a missing id (T30).
      if (!snap.exists || snap.get("status") !== "approved") {
        throw new HttpsError("not-found", "Spot not found");
      }
      const count = await checkRate(tx, uid, "like");
      const next = toggleSpotLikeIn(snap.get("likedBy"), uid);
      count();
      tx.update(ref, {likedBy: next.likedBy, likeCount: next.likeCount});
      return {liked: next.liked, likeCount: next.likeCount};
    });
    logger.info("toggleSpotLike", {uid, spotId, outcome: result.liked ? "liked" : "unliked"});
    return result;
  } catch (error) {
    logger.info("toggleSpotLike", {uid, spotId,
      outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});
