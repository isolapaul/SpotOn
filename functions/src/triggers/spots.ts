/**
 * Firestore triggers on spots/{spotId}: approval, new review, new pending spot.
 */
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import "../lib/app";
import {sendNotificationToAdmins, sendNotificationToUser} from "../lib/notify";

// ========================================
// TRIGGER 1: Spot Approved
// ========================================
export const onSpotApproved = onDocumentUpdated(
  "spots/{spotId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Check if status changed from pending to approved
    if (before.status === "pending" && after.status === "approved") {
      const spotId = event.params.spotId;
      const creatorId = after.createdBy;
      const spotName = after.name;

      logger.info(`Spot ${spotId} approved, notifying user ${creatorId}`);

      await sendNotificationToUser(
        creatorId,
        "spotApproved",
        "spotApprovedBody",
        [spotName],
        {
          type: "spot_approved",
          spotId: spotId,
          spotName: spotName,
        },
        "spotApproved",
      );
    }
  },
);

// ========================================
// TRIGGER 2: New Review Added
// ========================================
export const onReviewAdded = onDocumentUpdated(
  "spots/{spotId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const beforeReviews = before.reviews || [];
    const afterReviews = after.reviews || [];

    // Check if a new review was added
    if (afterReviews.length > beforeReviews.length) {
      const spotId = event.params.spotId;
      const creatorId = after.createdBy;
      const spotName = after.name;
      const newReview = afterReviews[afterReviews.length - 1];

      // Don't notify if user reviewed their own spot
      if (newReview.userId === creatorId) {
        logger.info(`User ${creatorId} reviewed their own spot, skipping notification`);
        return;
      }

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
  },
);

// ========================================
// TRIGGER 4: New Pending Spot (Admin Alert)
// ========================================
export const onNewPendingSpot = onDocumentCreated(
  "spots/{spotId}",
  async (event) => {
    const spotData = event.data?.data();

    if (!spotData) return;

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
