/**
 * Push notification helpers. FCM targets each device by its Firebase Installation ID (FID,
 * users/{uid}.fcmFids, registered by the app since v2.1.0). Devices that have not opened v2.1.0
 * yet still have only their old registration token in fcmTokens: those are sent to as well, through
 * the deprecated token API, until the device registers its FID (the app then removes its token, so
 * no device gets a push twice). Never logs FIDs, tokens or payloads, only uids and counts.
 */
import {FieldValue} from "firebase-admin/firestore";
import {BaseMessage, BatchResponse} from "firebase-admin/messaging";
import {defineString} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {db, messaging} from "./app";
import {TKey, TParam, translate} from "./i18n";
import {registrationList, selectTokensToPrune} from "./tokens";
import {pushLink} from "./inboxLinks";

const APP_URL = defineString("APP_URL", {
  description: "Public base URL of the web app (notification click link)",
});

export type NotificationSettingsKey = "spotApproved" | "spotReviewed" | "newPendingSpot" | "follows";

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

    const fids = registrationList(userData.fcmFids);
    // Devices from before v2.1.0 until they open the app once (transition; see the header).
    const tokens = registrationList(userData.fcmTokens);
    if (fids.length === 0 && tokens.length === 0) {
      logger.info(`No FCM registrations for user ${userId}`);
      return;
    }

    // Get user's preferred language (translate() falls back to en)
    const userLanguage = userData.language || "en";
    const title = translate(titleKey, userLanguage);
    const body = translate(bodyKey, userLanguage, bodyParams);

    // FCM requires an HTTPS link; the emulator value (http://localhost:3000) is omitted. A notice's
    // own path (data.link: its spot or the other user's profile) opens right there.
    const link = pushLink(APP_URL.value(), data.link);
    const base: BaseMessage = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      webpush: {
        ...(link ? {fcmOptions: {link}} : {}),
        notification: {
          requireInteraction: false,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        },
      },
    };

    const responses: BatchResponse[] = [];
    // Prune only registrations FCM reports as dead.
    const prune: Record<string, FieldValue> = {};
    let pruned = 0;
    if (fids.length > 0) {
      const response = await messaging.sendEachForMulticast({...base, fids});
      responses.push(response);
      const dead = selectTokensToPrune(fids, response.responses);
      if (dead.length > 0) prune.fcmFids = FieldValue.arrayRemove(...dead);
      pruned += dead.length;
    }
    if (tokens.length > 0) {
      // The deprecated token API, on purpose: legacy devices only (see the header).
      const response = await messaging.sendEachForMulticast({...base, tokens});
      responses.push(response);
      const dead = selectTokensToPrune(tokens, response.responses);
      if (dead.length > 0) prune.fcmTokens = FieldValue.arrayRemove(...dead);
      pruned += dead.length;
    }
    if (pruned > 0) {
      await db.collection("users").doc(userId).update(prune);
    }

    const results = responses.flatMap((r) => r.responses);
    const errorCodes = [
      ...new Set(
        results
          .filter((r) => !r.success)
          .map((r) => r.error?.code ?? "unknown"),
      ),
    ];
    logger.info("Notification sent", {
      userId,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      legacyTokens: tokens.length,
      pruned,
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
