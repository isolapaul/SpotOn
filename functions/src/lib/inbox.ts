/**
 * The in-app inbox (item 4): users/{uid}/inbox/{id}, written only here, read by its owner. The
 * notification centre shows it (translated on the device from `type` and the fields), so a
 * moderation reason stays readable after the push, on every device. At most INBOX_LIMIT items.
 */
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "./app";
import {NotificationSettingsKey, sendNotificationToAdmins, sendNotificationToUser} from "./notify";
import {TKey} from "./i18n";
import {DELETED_OWNER} from "./accountDeletion";

export const INBOX_LIMIT = 50;

/** The inbox item kinds (the client's `InboxType`, lib/inbox.ts). */
export type InboxType =
  | "spot_approved"
  | "spot_rejected"
  | "spot_removed"
  | "edit_approved"
  | "edit_rejected"
  | "photo_approved"
  | "photo_rejected";

/** Push texts per inbox kind (lib/i18n keys; the body takes the spot name, then the reason). */
const PUSH: Record<InboxType, {title: TKey; body: TKey}> = {
  spot_approved: {title: "spotApproved", body: "spotApprovedBody"},
  spot_rejected: {title: "spotRejected", body: "spotRejectedBody"},
  spot_removed: {title: "spotRemoved", body: "spotRemovedBody"},
  edit_approved: {title: "editApproved", body: "editApprovedBody"},
  edit_rejected: {title: "editRejected", body: "editRejectedBody"},
  photo_approved: {title: "photoApproved", body: "photoApprovedBody"},
  photo_rejected: {title: "photoRejected", body: "photoRejectedBody"},
};

/** Moderation decisions follow the "spot status" notification setting. */
const SETTINGS_KEY: NotificationSettingsKey = "spotApproved";

export interface InboxNotice {
  uid: string;
  type: InboxType;
  spotId: string;
  spotName: string;
  reason?: string;
}

/** Keeps the newest INBOX_LIMIT items. */
async function trimInbox(uid: string): Promise<void> {
  const old = await db.collection("users").doc(uid).collection("inbox")
    .orderBy("createdAt", "desc").offset(INBOX_LIMIT).select().get();
  if (old.empty) return;
  const batch = db.batch();
  old.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Tells a spot's owner (or a photo's uploader) about a moderation decision: an inbox item that
 * stays, and a push (unless notifications are off). Never for the deleted-user placeholder.
 * Failures are logged, never thrown: the decision itself has already been written.
 */
export async function notifyInbox(notice: InboxNotice): Promise<void> {
  const {uid, type, spotId, spotName, reason} = notice;
  if (!uid || uid === DELETED_OWNER) return;
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return;
    await db.collection("users").doc(uid).collection("inbox").add({
      type,
      spotId,
      spotName,
      ...(reason ? {reason} : {}),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await trimInbox(uid);
    const params = reason ? [spotName, reason] : [spotName];
    await sendNotificationToUser(uid, PUSH[type].title, PUSH[type].body, params,
      {type, spotId, spotName, inbox: "1"}, SETTINGS_KEY);
  } catch (error) {
    logger.error("notifyInbox failed", {uid, type, spotId, error: String(error)});
  }
}

/** Tells the admins that something waits for review (push only; the queues are in the app). */
export async function notifyAdminsToReview(
  title: TKey,
  body: TKey,
  params: string[],
  data: Record<string, string>,
): Promise<void> {
  await sendNotificationToAdmins(title, body, params, data, "newPendingSpot");
}
