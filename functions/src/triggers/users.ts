/**
 * Firestore triggers on users/{userId}: spot favorited (liked).
 */
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {sendNotificationToUser} from "../lib/notify";

// ========================================
// TRIGGER 3: Spot Favorited (Liked)
// ========================================
export const onSpotFavorited = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const beforeSpots = before.savedSpots || [];
    const afterSpots = after.savedSpots || [];

    // Check if a new spot was added to favorites
    if (afterSpots.length > beforeSpots.length) {
      const newSpotId = afterSpots.find((id: string) => !beforeSpots.includes(id));

      if (newSpotId) {
        const favoriterId = event.params.userId;

        // Get spot details
        const spotDoc = await db.collection("spots").doc(newSpotId).get();

        if (!spotDoc.exists) return;

        const spotData = spotDoc.data();
        if (!spotData) return;

        const creatorId = spotData.createdBy;
        const spotName = spotData.name;

        // Don't notify if user favorited their own spot
        if (creatorId === favoriterId) {
          logger.info(`User ${favoriterId} favorited their own spot, skipping notification`);
          return;
        }

        logger.info(`Spot ${newSpotId} favorited, notifying owner ${creatorId}`);

        // "new_like" is the type the client's notification store and icon switch know.
        await sendNotificationToUser(
          creatorId,
          "newLike",
          "newLikeBody",
          [spotName],
          {
            type: "new_like",
            spotId: newSpotId,
            spotName: spotName,
          },
          "spotReviewed",
        );
      }
    }
  },
);
