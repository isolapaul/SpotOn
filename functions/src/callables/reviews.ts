/**
 * Editing and deleting one's own review (reviews are embedded in spots/{id}.reviews, which clients
 * may only append to). The author changes the rating and the comment, or deletes the review with
 * its replies; admins delete through reports. Logs only {uid, spotId, outcome}.
 */
import {DocumentData, Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {removeReview} from "../lib/removal";

const MAX_COMMENT = 1000;

function input(request: CallableRequest): {uid: string; spotId: string; reviewId: string} {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const {spotId, reviewId} = request.data ?? {};
  if (!isValidSpotId(spotId) || typeof reviewId !== "string" || !reviewId || reviewId.length > 200) {
    throw new HttpsError("invalid-argument", "Invalid review");
  }
  return {uid, spotId, reviewId};
}

export const editReview = onCall(async (request) => {
  const {uid, spotId, reviewId} = input(request);
  const rating = request.data?.rating;
  const comment = request.data?.comment;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof comment !== "string" || comment.length > MAX_COMMENT) {
    throw new HttpsError("invalid-argument", "Rating 1-5 and a comment up to 1000 characters");
  }
  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection("spots").doc(spotId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
      const reviews: DocumentData[] = Array.isArray(snap.get("reviews")) ? snap.get("reviews") : [];
      const i = reviews.findIndex((r) => r?.id === reviewId);
      if (i < 0) throw new HttpsError("not-found", "Review not found");
      if (reviews[i].userId !== uid) throw new HttpsError("permission-denied", "Not your review");
      const next = [...reviews];
      next[i] = {...reviews[i], rating, comment: comment.trim(), editedAt: Timestamp.now()};
      tx.update(ref, {reviews: next});
    });
    logger.info("editReview", {uid, spotId, outcome: "ok"});
    return {edited: true};
  } catch (error) {
    logger.info("editReview", {uid, spotId, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});

export const deleteReview = onCall(async (request) => {
  const {uid, spotId, reviewId} = input(request);
  try {
    await removeReview(spotId, reviewId, {uid, isAdmin: false});
    logger.info("deleteReview", {uid, spotId, outcome: "ok"});
    return {deleted: true};
  } catch (error) {
    logger.info("deleteReview", {uid, spotId, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});
