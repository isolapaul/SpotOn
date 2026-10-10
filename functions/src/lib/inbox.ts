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
  | "photo_rejected"
  | "content_removed"
  | "review_reply"
  | "follow_request"
  | "follow_accepted"
  | "followed_spot"
  | "new_follower";

/** Push texts per inbox kind (lib/i18n keys; the body takes the spot name, then the reason). */
const PUSH: Record<InboxType, {title: TKey; body: TKey}> = {
  spot_approved: {title: "spotApproved", body: "spotApprovedBody"},
  spot_rejected: {title: "spotRejected", body: "spotRejectedBody"},
  spot_removed: {title: "spotRemoved", body: "spotRemovedBody"},
  edit_approved: {title: "editApproved", body: "editApprovedBody"},
  edit_rejected: {title: "editRejected", body: "editRejectedBody"},
  photo_approved: {title: "photoApproved", body: "photoApprovedBody"},
  photo_rejected: {title: "photoRejected", body: "photoRejectedBody"},
  content_removed: {title: "contentRemoved", body: "contentRemovedBody"},
  review_reply: {title: "reviewReply", body: "reviewReplyBody"},
  follow_request: {title: "followRequest", body: "followRequestBody"},
  follow_accepted: {title: "followAccepted", body: "followAcceptedBody"},
  followed_spot: {title: "followedSpot", body: "followedSpotBody"},
  new_follower: {title: "newFollower", body: "newFollowerBody"},
};

const FOLLOW_TYPES: readonly InboxType[] = [
  "follow_request", "follow_accepted", "followed_spot", "new_follower",
];
/** Kinds whose push names the other user first, then the spot. */
const ACTOR_SPOT_TYPES: readonly InboxType[] = ["followed_spot", "review_reply"];

/** Moderation decisions follow the "spot status" setting; follow news "follows" (item 8). */
function settingsKeyOf(type: InboxType): NotificationSettingsKey {
  return FOLLOW_TYPES.includes(type) ? "follows" : "spotApproved";
}

/** Push body parameters: follow news name the other user first (then the spot). */
function pushParams(n: InboxNotice): string[] {
  if (ACTOR_SPOT_TYPES.includes(n.type)) return [n.actorName ?? "", n.spotName];
  if (FOLLOW_TYPES.includes(n.type)) return [n.actorName ?? ""];
  return n.reason ? [n.spotName, n.reason] : [n.spotName];
}

export interface InboxNotice {
  uid: string;
  type: InboxType;
  spotId: string;
  spotName: string;
  reason?: string;
  /** The other user of a follow notice (item 8). */
  actorUid?: string;
  actorName?: string;
}

/**
 * Keeps the newest INBOX_LIMIT items. A count aggregate (one read per 1000 items) and then only
 * the oldest extra items are read; an offset query would bill every skipped item each time.
 */
async function trimInbox(uid: string): Promise<void> {
  const inbox = db.collection("users").doc(uid).collection("inbox");
  const extra = (await inbox.count().get()).data().count - INBOX_LIMIT;
  if (extra <= 0) return;
  const old = await inbox.orderBy("createdAt", "asc").limit(extra).select().get();
  if (old.empty) return;
  const batch = db.batch();
  old.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Tells a spot's owner (or a photo's uploader) about a moderation decision, or a user about follow
 * news (item 8): an inbox item that stays, and a push (unless notifications are off). Never
 * for the deleted-user placeholder.
 * Failures are logged, never thrown: the decision itself has already been written.
 */
export async function notifyInbox(notice: InboxNotice): Promise<void> {
  const {uid, type, spotId, spotName, reason, actorUid, actorName} = notice;
  if (!uid || uid === DELETED_OWNER) return;
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return;
    await db.collection("users").doc(uid).collection("inbox").add({
      type,
      spotId,
      spotName,
      ...(reason ? {reason} : {}),
      ...(actorUid ? {actorUid, actorName: actorName ?? ""} : {}),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await trimInbox(uid);
    await sendNotificationToUser(uid, PUSH[type].title, PUSH[type].body, pushParams(notice),
      {type, spotId, spotName, inbox: "1"}, settingsKeyOf(type));
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
