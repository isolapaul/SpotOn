/**
 * SpotOn - Firebase Cloud Functions v2
 * Push Notifications Backend
 */

import * as functions from "firebase-functions/v2";
import {setGlobalOptions} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Set global region to Europe (Frankfurt) for lower latency to Hungary
setGlobalOptions({region: "europe-west3"});

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ========================================
// TRANSLATIONS DICTIONARY
// ========================================
const translations = {
  spotApproved: {
    hu: "Jóváhagyták a helyedet! 🥳",
    en: "Your spot has been approved! 🥳",
    de: "Ihr Ort wurde genehmigt! 🥳",
  },
  spotApprovedBody: {
    hu: (spotName: string) => `"${spotName}" mostantól látható a térképen`,
    en: (spotName: string) => `"${spotName}" is now visible on the map`,
    de: (spotName: string) => `"${spotName}" ist jetzt auf der Karte sichtbar`,
  },
  newReview: {
    hu: "Új értékelés érkezett! ⭐",
    en: "New review received! ⭐",
    de: "Neue Bewertung erhalten! ⭐",
  },
  newReviewBody: {
    hu: (spotName: string, rating: number) =>
      `"${spotName}" ${rating} csillagot kapott`,
    en: (spotName: string, rating: number) =>
      `"${spotName}" received ${rating} stars`,
    de: (spotName: string, rating: number) =>
      `"${spotName}" hat ${rating} Sterne erhalten`,
  },
  newLike: {
    hu: "Valaki kedvelte a helyedet ❤️",
    en: "Someone liked your spot ❤️",
    de: "Jemandem gefällt Ihr Ort ❤️",
  },
  newLikeBody: {
    hu: (spotName: string) => `"${spotName}" kedvencek közé került`,
    en: (spotName: string) => `"${spotName}" was added to favorites`,
    de: (spotName: string) => `"${spotName}" wurde zu Favoriten hinzugefügt`,
  },
  newPendingSpot: {
    hu: "Új hely vár jóváhagyásra 🛡️",
    en: "New spot awaiting approval 🛡️",
    de: "Neuer Ort wartet auf Genehmigung 🛡️",
  },
  newPendingSpotBody: {
    hu: (spotName: string, userName: string) =>
      `"${spotName}" feltöltve: ${userName}`,
    en: (spotName: string, userName: string) =>
      `"${spotName}" uploaded by ${userName}`,
    de: (spotName: string, userName: string) =>
      `"${spotName}" hochgeladen von ${userName}`,
  },
};

// ========================================
// HELPER: Send Notification to User
// ========================================
async function sendNotificationToUser(
  userId: string,
  titleKey: keyof typeof translations,
  bodyKey: keyof typeof translations,
  bodyParams?: any[],
  data?: Record<string, string>
) {
  try {
    // Get user document
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn(`User ${userId} does not exist`);
      return;
    }

    const userData = userDoc.data();
    if (!userData) return;

    // Check if notifications are enabled
    if (userData.notificationsEnabled === false) {
      logger.info(`Notifications disabled for user ${userId}`);
      return;
    }

    // Check if user has FCM tokens
    const tokens = userData.fcmTokens || [];
    if (tokens.length === 0) {
      logger.info(`No FCM tokens for user ${userId}`);
      return;
    }

    // Get user's preferred language
    const userLanguage = userData.language || "en";

    // Get translated strings
    const titleTranslations = translations[titleKey];
    const bodyTranslations = translations[bodyKey];

    const title = String(
      titleTranslations[userLanguage as keyof typeof titleTranslations] ||
      titleTranslations.en
    );

    let body: string;
    if (typeof bodyTranslations === "object" && bodyTranslations[userLanguage as keyof typeof bodyTranslations]) {
      const bodyTemplate = bodyTranslations[userLanguage as keyof typeof bodyTranslations];
      if (typeof bodyTemplate === "function" && bodyParams) {
        body = (bodyTemplate as any)(...bodyParams);
      } else {
        body = String(bodyTemplate);
      }
    } else {
      body = String(bodyTranslations.en);
    }

    // Prepare message
    const message: admin.messaging.MulticastMessage = {
      tokens: tokens,
      notification: {
        title: title,
        body: body,
      },
      data: data || {},
      webpush: {
        fcmOptions: {
          link: "https://spoton-app.web.app", // Change to your production URL
        },
        notification: {
          requireInteraction: false,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        },
      },
    };

    // Send notification
    const response = await messaging.sendEachForMulticast(message);
    logger.info(
      `Successfully sent ${response.successCount}/${tokens.length} messages to user ${userId}`
    );

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          logger.warn(`Failed to send to token ${tokens[idx]}:`, resp.error);
          failedTokens.push(tokens[idx]);
        }
      });

      // Remove invalid tokens from user document
      if (failedTokens.length > 0) {
        await db
          .collection("users")
          .doc(userId)
          .update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens),
          });
        logger.info(`Removed ${failedTokens.length} invalid tokens from user ${userId}`);
      }
    }
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
  }
}

// ========================================
// HELPER: Send Notification to All Admins
// ========================================
async function sendNotificationToAdmins(
  titleKey: keyof typeof translations,
  bodyKey: keyof typeof translations,
  bodyParams?: any[],
  data?: Record<string, string>
) {
  try {
    // Get all admin users from admins collection
    const adminsSnapshot = await db.collection("admins").get();

    if (adminsSnapshot.empty) {
      logger.info("No admins found");
      return;
    }

    // Send notification to each admin
    const promises = adminsSnapshot.docs.map(async (adminDoc: any) => {
      const adminEmail = adminDoc.data().email;

      // Find user by email
      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", adminEmail)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userId = usersSnapshot.docs[0].id;
        await sendNotificationToUser(userId, titleKey, bodyKey, bodyParams, data);
      }
    });

    await Promise.all(promises);
    logger.info(`Sent notifications to ${adminsSnapshot.size} admins`);
  } catch (error) {
    logger.error("Error sending notification to admins:", error);
  }
}

// ========================================
// TRIGGER 1: Spot Approved
// ========================================
export const onSpotApproved = functions.firestore.onDocumentUpdated(
  "spots/{spotId}",
  async (event: any) => {
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
        }
      );
    }
  }
);

// ========================================
// TRIGGER 2: New Review Added
// ========================================
export const onReviewAdded = functions.firestore.onDocumentUpdated(
  "spots/{spotId}",
  async (event: any) => {
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
        }
      );
    }
  }
);

// ========================================
// TRIGGER 3: Spot Favorited (Liked)
// ========================================
export const onSpotFavorited = functions.firestore.onDocumentUpdated(
  "users/{userId}",
  async (event: any) => {
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

        await sendNotificationToUser(
          creatorId,
          "newLike",
          "newLikeBody",
          [spotName],
          {
            type: "spot_favorited",
            spotId: newSpotId,
            spotName: spotName,
          }
        );
      }
    }
  }
);

// ========================================
// TRIGGER 4: New Pending Spot (Admin Alert)
// ========================================
export const onNewPendingSpot = functions.firestore.onDocumentCreated(
  "spots/{spotId}",
  async (event: any) => {
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
        }
      );
    }
  }
);
