/**
 * Firestore triggers on spots/{spotId}: one update trigger (approval, new review, resubmission:
 * one function run per spot write instead of three) and the new pending spot alert.
 */
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {DocumentData} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {followId} from "../lib/follows";
import {sendNotificationToAdmins, sendNotificationToUser} from "../lib/notify";
import {notifyAdminsToReview, notifyInbox} from "../lib/inbox";
import {notifyFollowersOfSpot} from "../lib/followNews";

/** pending → approved: the owner (inbox + push) and their followers hear about it. */
async function onApproved(spotId: string, after: DocumentData): Promise<void> {
  const creatorId = after.createdBy;
  const spotName = String(after.name ?? "");
  logger.info(`Spot ${spotId} approved, notifying user ${creatorId}`);
  await notifyInbox({uid: creatorId, type: "spot_approved", spotId, spotName});
  await notifyFollowersOfSpot(creatorId, spotId, spotName);
}

/** A review appended: its owner hears about it (not their own, not from someone they blocked). */
async function onReviewAdded(spotId: string, after: DocumentData): Promise<void> {
  const reviews = (after.reviews ?? []) as DocumentData[];
  const newReview = reviews[reviews.length - 1];
  const creatorId = String(after.createdBy ?? "");
  const reviewer = String(newReview?.userId ?? "");
  if (!newReview || !creatorId || reviewer === creatorId) return;
  if ((await db.collection("blocks").doc(followId(creatorId, reviewer)).get()).exists) {
    logger.info(`Review on spot ${spotId} by a user its owner blocked, no notification`);
    return;
  }
  const spotName = after.name;
  logger.info(`New review on spot ${spotId}, notifying owner ${creatorId}`);
  await sendNotificationToUser(
    creatorId,
    "newReview",
    "newReviewBody",
    [spotName, newReview.rating],
    {
      type: "new_review",
      spotId: spotId,
      spotName: spotName,
      rating: String(newReview.rating),
      reviewerName: newReview.userName,
    },
    "spotReviewed",
  );
}

/** rejected → pending (item 4): the admins review it again. */
async function onResubmitted(spotId: string, after: DocumentData): Promise<void> {
  logger.info(`Spot ${spotId} resubmitted, notifying admins`);
  await notifyAdminsToReview("spotResubmitted", "spotResubmittedBody",
    [String(after.name ?? ""), String(after.createdByName ?? "Anonymous")],
    {type: "new_pending_spot", spotId});
}

export const onSpotUpdated = onDocumentUpdated("spots/{spotId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const spotId = event.params.spotId;
  if (before.status === "pending" && after.status === "approved") await onApproved(spotId, after);
  if (before.status === "rejected" && after.status === "pending") await onResubmitted(spotId, after);
  if ((after.reviews ?? []).length > (before.reviews ?? []).length) {
    await onReviewAdded(spotId, after);
  }
});

// New spot: a pending one alerts the admins, an admin's (approved) one its followers.
export const onNewPendingSpot = onDocumentCreated(
  "spots/{spotId}",
  async (event) => {
    const spotData = event.data?.data();

    if (!spotData) return;

    // An admin's spot is created approved: its followers hear about it (item 8).
    if (spotData.status === "approved") {
      await notifyFollowersOfSpot(spotData.createdBy, event.params.spotId,
        String(spotData.name ?? ""));
    }

    // Only notify admins if status is pending
    if (spotData.status === "pending") {
      const spotId = event.params.spotId;
      const spotName = spotData.name;
      const creatorName = spotData.createdByName || "Anonymous";

      logger.info(`New pending spot ${spotId}, notifying admins`);

      await sendNotificationToAdmins(
        "newPendingSpot",
        "newPendingSpotBody",
        [spotName, creatorName],
        {
          type: "new_pending_spot",
          spotId: spotId,
          spotName: spotName,
          creatorName: creatorName,
        },
        "newPendingSpot",
      );
    }
  },
);
