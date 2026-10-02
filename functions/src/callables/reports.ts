/**
 * Reports (Play UGC requirement): anyone signed in reports a spot, a photo, a review, a reply or a
 * profile, with a reason; admins see them in a queue and dismiss them or remove the content (with
 * a reason the author receives). One report per person and thing (the doc id). The reported user
 * never learns who reported. Logs only uids, ids and outcomes.
 */
import {createHash} from "node:crypto";
import {DocumentData, FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAdminRole} from "../lib/admin";
import {db} from "../lib/app";
import {isUid} from "../lib/follows";
import {isValidSpotId} from "../lib/ids";
import {notifyAdminsToReview, notifyInbox} from "../lib/inbox";
import {validReason} from "../lib/moderation";
import {removePhotoWithReason, removeReview, removeSpotWithReason} from "../lib/removal";

export const REPORT_KINDS = ["spot", "photo", "review", "reply", "profile"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_REASONS = ["spam", "offensive", "wrong_place", "dangerous", "privacy", "other"] as const;
const MAX_REPORT_TEXT = 500;
const MAX_TARGET_LENGTH = 2048;

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  return uid;
}

function oneOf<T extends string>(x: unknown, list: readonly T[], what: string): T {
  if (typeof x !== "string" || !list.includes(x as T)) throw new HttpsError("invalid-argument", `Invalid ${what}`);
  return x as T;
}

/** What a report points at; `spotId` is empty for a profile. */
interface Target {
  kind: ReportKind;
  spotId: string;
  /** A photo URL, a review or reply id, or the profile's uid. */
  targetId: string;
}

function readTarget(data: DocumentData | undefined): Target {
  const kind = oneOf(data?.kind, REPORT_KINDS, "kind");
  const targetId = data?.targetId;
  if (typeof targetId !== "string" || !targetId || targetId.length > MAX_TARGET_LENGTH) {
    throw new HttpsError("invalid-argument", "Invalid target");
  }
  if (kind === "profile") {
    if (!isUid(targetId)) throw new HttpsError("invalid-argument", "Invalid target");
    return {kind, spotId: "", targetId};
  }
  if (!isValidSpotId(data?.spotId)) throw new HttpsError("invalid-argument", "Invalid spotId");
  if (kind === "spot" && targetId !== data?.spotId) throw new HttpsError("invalid-argument", "Invalid target");
  return {kind, spotId: data.spotId, targetId};
}

/** Stable per thing: reports of the same thing are grouped, and one person reports it once. */
export function targetKey(t: Target): string {
  return createHash("sha256").update(`${t.kind}|${t.spotId}|${t.targetId}`).digest("hex").slice(0, 32);
}

/** The reported thing's author and a short preview for the admin, or not-found. */
async function describe(t: Target): Promise<{author: string; spotName: string; preview: string}> {
  if (t.kind === "profile") {
    const user = await db.collection("publicProfiles").doc(t.targetId).get();
    if (!user.exists) throw new HttpsError("not-found", "Not found");
    return {author: t.targetId, spotName: "", preview: `${user.get("username") ?? ""}: ${user.get("bio") ?? ""}`};
  }
  const spot = await db.collection("spots").doc(t.spotId).get();
  if (!spot.exists || spot.get("status") !== "approved") throw new HttpsError("not-found", "Not found");
  const spotName = String(spot.get("name") ?? "");
  const creator = String(spot.get("createdBy") ?? "");
  if (t.kind === "spot") return {author: creator, spotName, preview: String(spot.get("description") ?? "")};
  if (t.kind === "photo") {
    const urls: unknown[] = spot.get("imageUrls") ?? [];
    if (!urls.includes(t.targetId)) throw new HttpsError("not-found", "Not found");
    const image = ((spot.get("spotImages") ?? []) as DocumentData[]).find((i) => i?.url === t.targetId);
    return {author: String(image?.addedBy ?? creator), spotName, preview: t.targetId};
  }
  if (t.kind === "review") {
    const review = ((spot.get("reviews") ?? []) as DocumentData[]).find((r) => r?.id === t.targetId);
    if (!review) throw new HttpsError("not-found", "Not found");
    return {author: String(review.userId ?? ""), spotName, preview: String(review.comment ?? "")};
  }
  const reply = await spot.ref.collection("replies").doc(t.targetId).get();
  if (!reply.exists) throw new HttpsError("not-found", "Not found");
  return {author: String(reply.get("userId") ?? ""), spotName, preview: String(reply.get("text") ?? "")};
}

export const reportContent = onCall(async (request) => {
  const uid = requireUid(request);
  const target = readTarget(request.data);
  const reason = oneOf(request.data?.reason, REPORT_REASONS, "reason");
  const rawText = request.data?.text;
  const text = typeof rawText === "string" ? rawText.trim().slice(0, MAX_REPORT_TEXT) : "";
  const key = targetKey(target);
  try {
    const info = await describe(target);
    if (info.author === uid) throw new HttpsError("invalid-argument", "Not your own content");
    const ref = db.collection("reports").doc(`${uid}_${key}`);
    const created = await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return false;
      tx.create(ref, {
        ...target, key, reporter: uid, author: info.author, reason, text,
        spotName: info.spotName, preview: info.preview.slice(0, 500),
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (created) {
      await notifyAdminsToReview("newReport", "newReportBody", [info.spotName || info.preview.split(":")[0]],
        {type: "new_report", spotId: target.spotId});
    }
    logger.info("reportContent", {uid, kind: target.kind, outcome: created ? "created" : "duplicate"});
    return {reported: true};
  } catch (error) {
    logger.info("reportContent", {uid, kind: target.kind, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});

/** All open reports of one thing (the group an admin decides on). */
async function reportsOf(key: string) {
  return db.collection("reports").where("key", "==", key).get();
}

export const resolveReport = onCall(async (request) => {
  const uid = requireUid(request);
  if ((await getAdminRole(uid)) === null) throw new HttpsError("permission-denied", "Admins only");
  const key = request.data?.key;
  if (typeof key !== "string" || !/^[a-f0-9]{32}$/.test(key)) throw new HttpsError("invalid-argument", "Invalid key");
  const remove = request.data?.action === "remove";
  const reason = remove ? validReason(request.data?.reason) : null;
  if (remove && !reason) throw new HttpsError("invalid-argument", "A reason of 1-500 characters is required");
  try {
    const group = await reportsOf(key);
    if (group.empty) throw new HttpsError("not-found", "Report not found");
    const t = readTarget(group.docs[0].data());
    if (remove && reason) {
      if (t.kind === "spot") await removeSpotWithReason(uid, t.spotId, reason);
      else if (t.kind === "photo") await removePhotoWithReason(t.spotId, t.targetId, reason);
      else if (t.kind === "review") await removeReview(t.spotId, t.targetId, {uid, isAdmin: true}, reason);
      else if (t.kind === "reply") await removeReplyAsAdmin(t.spotId, t.targetId, reason);
      else await clearBio(t.targetId, reason);
    }
    const left = await reportsOf(key);
    await Promise.all(left.docs.map((d) => d.ref.delete()));
    logger.info("resolveReport", {uid, kind: t.kind, outcome: remove ? "removed" : "dismissed"});
    return {resolved: true};
  } catch (error) {
    logger.info("resolveReport", {uid, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});

async function removeReplyAsAdmin(spotId: string, replyId: string, reason: string) {
  const spotRef = db.collection("spots").doc(spotId);
  const [spot, reply] = await Promise.all([spotRef.get(), spotRef.collection("replies").doc(replyId).get()]);
  if (!reply.exists) throw new HttpsError("not-found", "Reply not found");
  await reply.ref.delete();
  await notifyInbox({uid: String(reply.get("userId") ?? ""), type: "content_removed", spotId,
    spotName: String(spot.get("name") ?? ""), reason});
}

/** A reported profile: the bio is what users wrote there (the username is checked at claim). */
async function clearBio(target: string, reason: string) {
  const user = db.collection("users").doc(target);
  if (!(await user.get()).exists) throw new HttpsError("not-found", "Profile not found");
  await user.update({bio: FieldValue.delete()});
  await notifyInbox({uid: target, type: "content_removed", spotId: "", spotName: "Bio", reason});
}
