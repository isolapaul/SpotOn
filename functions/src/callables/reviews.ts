/**
 * Reviews and replies:
 * - editReview / deleteReview: the author's own review (reviews are embedded in
 *   spots/{id}.reviews, which clients may only append to). Deleting takes its replies and the
 *   reports about it along; admins delete through reports.
 * - addReply: a reply (a question or an answer) under a review of an approved spot. Checked
 *   here, not in the rules: the review must exist, its author must not have blocked the replier,
 *   and a user posts at most RATE_LIMITS.reply replies an hour (each one notifies). The author
 *   edits or deletes their reply directly (rules).
 * Logs only {uid, spotId, outcome}.
 */
import {DocumentData, FieldValue, Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {followId} from "../lib/follows";
import {isValidSpotId} from "../lib/ids";
import {checkRate} from "../lib/rateLimit";
import {removeReview} from "../lib/removal";
import {reportKey} from "../lib/reportKey";

const MAX_COMMENT = 1000;
export const MAX_REPLY = 500;

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
    const reports = await db.collection("reports")
      .where("key", "==", reportKey("review", spotId, reviewId)).get();
    await Promise.all(reports.docs.map((d) => d.ref.delete()));
    logger.info("deleteReview", {uid, spotId, outcome: "ok"});
    return {deleted: true};
  } catch (error) {
    logger.info("deleteReview", {uid, spotId, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});

export const addReply = onCall(async (request) => {
  const {uid, spotId, reviewId} = input(request);
  const raw = request.data?.text;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text.length > MAX_REPLY) {
    throw new HttpsError("invalid-argument", "A reply of 1-500 characters");
  }
  try {
    const spotRef = db.collection("spots").doc(spotId);
    const replyRef = spotRef.collection("replies").doc();
    await db.runTransaction(async (tx) => {
      // Reading the spot in the transaction orders this against removeReview (which rewrites
      // the spot, then deletes the review's replies): no reply outlives its review.
      const spot = await tx.get(spotRef);
      if (!spot.exists || spot.get("status") !== "approved") {
        throw new HttpsError("not-found", "Spot not found");
      }
      const reviews: DocumentData[] = Array.isArray(spot.get("reviews")) ? spot.get("reviews") : [];
      const review = reviews.find((r) => r?.id === reviewId);
      if (!review) throw new HttpsError("not-found", "Review not found");
      const author = String(review.userId ?? "");
      if (author && author !== uid &&
          (await tx.get(db.collection("blocks").doc(followId(author, uid)))).exists) {
        // To the replier it looks like the review is gone (they are not told about the block).
        throw new HttpsError("not-found", "Review not found");
      }
      const count = await checkRate(tx, uid, "reply");
      count();
      tx.create(replyRef, {reviewId, userId: uid, text, createdAt: FieldValue.serverTimestamp()});
    });
    logger.info("addReply", {uid, spotId, outcome: "ok"});
    return {id: replyRef.id};
  } catch (error) {
    logger.info("addReply", {uid, spotId, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});
