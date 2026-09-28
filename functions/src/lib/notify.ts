/**
 * Push notification helpers. Never logs tokens or payloads, only uids and counts.
 */
import {FieldValue} from "firebase-admin/firestore";
import {MulticastMessage} from "firebase-admin/messaging";
import {defineString} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {db, messaging} from "./app";
import {TKey, TParam, translate} from "./i18n";
import {selectTokensToPrune} from "./tokens";

const APP_URL = defineString("APP_URL", {
  description: "Public base URL of the web app (notification click link)",
});

export type NotificationSettingsKey = "spotApproved" | "spotReviewed" | "newPendingSpot";

export async function sendNotificationToUser(
  userId: string,
  titleKey: TKey,
  bodyKey: TKey,
  bodyParams: ReadonlyArray<TParam> = [],
  data: Record<string, string> = {},
  settingsKey?: NotificationSettingsKey,
): Promise<void> {
  try {
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

    // Check per-notification settings
    if (settingsKey && userData.notificationSettings) {
      const settingValue = userData.notificationSettings[settingsKey];
      if (settingValue === false) {
        logger.info(`Notification ${settingsKey} disabled for user ${userId}`);
        return;
      }
    }

    // Check if user has FCM tokens
    const tokens: string[] = userData.fcmTokens || [];
    if (tokens.length === 0) {
      logger.info(`No FCM tokens for user ${userId}`);
      return;
    }

    // Get user's preferred language (translate() falls back to en)
    const userLanguage = userData.language || "en";
    const title = translate(titleKey, userLanguage);
    const body = translate(bodyKey, userLanguage, bodyParams);

    // FCM requires an HTTPS link; the emulator value (http://localhost:3000) is omitted.
    const appUrl = APP_URL.value();
    const message: MulticastMessage = {
      tokens: tokens,
      notification: {
        title: title,
        body: body,
      },
      data: data,
      webpush: {
        ...(appUrl.startsWith("https://") ? {fcmOptions: {link: appUrl}} : {}),
        notification: {
          requireInteraction: false,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    // Prune only tokens FCM reports as dead.
    const toPrune = selectTokensToPrune(tokens, response.responses);
    if (toPrune.length > 0) {
      await db
        .collection("users")
        .doc(userId)
        .update({
          fcmTokens: FieldValue.arrayRemove(...toPrune),
        });
    }

    const errorCodes = [
      ...new Set(
        response.responses
          .filter((r) => !r.success)
          .map((r) => r.error?.code ?? "unknown"),
      ),
    ];
    logger.info("Notification sent", {
      userId,
      sent: response.successCount,
      failed: response.failureCount,
      pruned: toPrune.length,
      errorCodes,
    });
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
  }
}

export async function sendNotificationToAdmins(
  titleKey: TKey,
  bodyKey: TKey,
  bodyParams: ReadonlyArray<TParam> = [],
  data: Record<string, string> = {},
  settingsKey?: NotificationSettingsKey,
): Promise<void> {
  try {
    // An admin is anyone with an admins/{uid} doc (legacy docs without `role` included).
    const adminsSnapshot = await db.collection("admins").get();

    if (adminsSnapshot.empty) {
      logger.info("No admins found");
      return;
    }

    await Promise.allSettled(
      adminsSnapshot.docs.map((adminDoc) =>
        sendNotificationToUser(adminDoc.id, titleKey, bodyKey, bodyParams, data, settingsKey),
      ),
    );
    logger.info("Sent notifications to admins", {adminCount: adminsSnapshot.size});
  } catch (error) {
    logger.error("Error sending notification to admins:", error);
  }
}
