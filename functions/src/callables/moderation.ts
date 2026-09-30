/**
 * Moderation callables (item 4), admins only; every "no" needs a reason (1–500 characters):
 * - rejectSpot: a pending spot becomes rejected, with the reason on it (owner and admins read it).
 * - removeSpot: deletes a spot with its photos, pending edit and photo submissions.
 * - reviewSpotEdit: applies or rejects an owner's proposed edit of an approved spot.
 * - reviewPhotoSubmission: adds or rejects a photo waiting for approval.
 * The owner or uploader hears about every decision (inbox + push). Logs only ids and outcomes.
 */
import {DocumentData, Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAdminRole} from "../lib/admin";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {notifyInbox} from "../lib/inbox";
import {BUILT_IN_CATEGORIES, planEditApply, readProposal, validReason} from "../lib/moderation";
import {currentImages, planAddImages, uniqueIdFactory} from "../lib/spotImages";
import {deleteSpotImageFiles} from "../lib/storageFiles";

async function requireAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  if ((await getAdminRole(uid)) === null) throw new HttpsError("permission-denied", "Admins only");
  return uid;
}

function requireSpotId(x: unknown): string {
  if (!isValidSpotId(x)) throw new HttpsError("invalid-argument", "Invalid spotId");
  return x;
}

function requireReason(x: unknown): string {
  const reason = validReason(x);
  if (!reason) throw new HttpsError("invalid-argument", "A reason of 1-500 characters is required");
  return reason;
}

function outcomeOf(error: unknown): string {
  return error instanceof HttpsError ? error.code : "error";
}

/** Every photo URL a spot refers to (imageUrls and spotImages). */
function spotPhotoUrls(spot: DocumentData): string[] {
  const urls = Array.isArray(spot.imageUrls) ? spot.imageUrls : [];
  const images = Array.isArray(spot.spotImages) ? spot.spotImages.map((i) => i?.url) : [];
  return [...urls, ...images].filter((u): u is string => typeof u === "string");
}

/** Built-in categories, or one an admin created (categories/{id}, item 7). */
async function isKnownCategory(id: string): Promise<boolean> {
  if (BUILT_IN_CATEGORIES.includes(id)) return true;
  return id.length > 0 && id.length <= 100 && !id.includes("/") &&
    (await db.collection("categories").doc(id).get()).exists;
}

/** Runs a callable body with one log line: {uid, id, outcome}. */
async function logged<T>(
  name: string,
  uid: string,
  id: string,
  body: () => Promise<T>,
): Promise<T> {
  try {
    const result = await body();
    logger.info(name, {uid, id, outcome: "ok"});
    return result;
  } catch (error) {
    logger.info(name, {uid, id, outcome: outcomeOf(error)});
    throw error;
  }
}

export const rejectSpot = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireSpotId(request.data?.spotId);
  const reason = requireReason(request.data?.reason);
  return logged("rejectSpot", uid, spotId, async () => {
    const spotRef = db.collection("spots").doc(spotId);
    const spot = await db.runTransaction(async (tx) => {
      const snap = await tx.get(spotRef);
      if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
      const data = snap.data() as DocumentData;
      if (data.status !== "pending") throw new HttpsError("failed-precondition", "Only pending spots");
      tx.update(spotRef, {status: "rejected", rejection: {reason, at: Timestamp.now()}});
      return data;
    });
    await notifyInbox({uid: spot.createdBy, type: "spot_rejected", spotId, spotName: spot.name, reason});
    return {rejected: true};
  });
});

export const removeSpot = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireSpotId(request.data?.spotId);
  const reason = requireReason(request.data?.reason);
  return logged("removeSpot", uid, spotId, async () => {
    const spotRef = db.collection("spots").doc(spotId);
    const snap = await spotRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
    const spot = snap.data() as DocumentData;
    const submissions = await db.collection("photoSubmissions").where("spotId", "==", spotId).get();

    const batch = db.batch();
    batch.delete(spotRef);
    batch.delete(db.collection("spotEdits").doc(spotId));
    submissions.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    await deleteSpotImageFiles([
      ...spotPhotoUrls(spot),
      ...submissions.docs.map((doc) => doc.get("url")).filter((u): u is string => typeof u === "string"),
    ]);
    if (spot.createdBy !== uid) {
      await notifyInbox({uid: spot.createdBy, type: "spot_removed", spotId, spotName: spot.name, reason});
    }
    return {removed: true};
  });
});

export const reviewSpotEdit = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireSpotId(request.data?.spotId);
  const approve = request.data?.approve === true;
  const reason = approve ? undefined : requireReason(request.data?.reason);
  return logged("reviewSpotEdit", uid, spotId, async () => {
    const editRef = db.collection("spotEdits").doc(spotId);
    const spotRef = db.collection("spots").doc(spotId);
    const [editSnap, spotSnap] = await Promise.all([editRef.get(), spotRef.get()]);
    if (!editSnap.exists || editSnap.get("status") !== "pending") {
      throw new HttpsError("not-found", "No pending edit");
    }
    if (!spotSnap.exists) {
      await editRef.delete();
      throw new HttpsError("not-found", "Spot not found");
    }
    const spotName = spotSnap.get("name") as string;
    const ownerId = editSnap.get("ownerId") as string;

    if (!approve) {
      await editRef.update({status: "rejected", rejection: {reason, at: Timestamp.now()}});
      await notifyInbox({uid: ownerId, type: "edit_rejected", spotId, spotName, reason});
      return {applied: false};
    }

    const rawCategory = editSnap.get("proposed.category");
    const known = typeof rawCategory === "string" && (await isKnownCategory(rawCategory));
    const proposal = readProposal(editSnap.get("proposed"), (id) => id === rawCategory && known);
    const removedUrls = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(spotRef);
      if (!fresh.exists) throw new HttpsError("not-found", "Spot not found");
      const plan = planEditApply(fresh.data() as DocumentData, proposal);
      if (Object.keys(plan.update).length) tx.update(spotRef, plan.update);
      tx.delete(editRef);
      return plan.removedUrls;
    });
    await deleteSpotImageFiles(removedUrls);
    await notifyInbox({uid: ownerId, type: "edit_approved", spotId, spotName: proposal.name ?? spotName});
    return {applied: true};
  });
});

export const reviewPhotoSubmission = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const submissionId: unknown = request.data?.submissionId;
  if (typeof submissionId !== "string" || !isValidSpotId(submissionId)) {
    throw new HttpsError("invalid-argument", "Invalid submissionId");
  }
  const approve = request.data?.approve === true;
  const reason = approve ? undefined : requireReason(request.data?.reason);
  return logged("reviewPhotoSubmission", uid, submissionId, async () => {
    const subRef = db.collection("photoSubmissions").doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) throw new HttpsError("not-found", "Submission not found");
    const {spotId, uploader, url} =
      subSnap.data() as {spotId: string; uploader: string; url: string};
    const spotRef = db.collection("spots").doc(spotId);

    if (!approve) {
      const spotName = (await spotRef.get()).get("name") ?? "";
      await subRef.delete();
      await deleteSpotImageFiles([url]);
      await notifyInbox({uid: uploader, type: "photo_rejected", spotId, spotName, reason});
      return {added: false};
    }

    const spotName = await db.runTransaction(async (tx) => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists) {
        tx.delete(subRef);
        return null;
      }
      const spot = spotSnap.data() as DocumentData;
      const now = Timestamp.now();
      const used = new Set(currentImages(spot, spotId, now).map((image) => image?.id));
      let plan;
      try {
        plan = planAddImages(spot, spotId, [url], uploader, now, uniqueIdFactory(used));
      } catch {
        throw new HttpsError("resource-exhausted", "MAX_SPOT_IMAGES");
      }
      tx.update(spotRef, {...plan});
      tx.delete(subRef);
      return spot.name as string;
    });
    if (spotName === null) {
      await deleteSpotImageFiles([url]);
      throw new HttpsError("not-found", "Spot not found");
    }
    await notifyInbox({uid: uploader, type: "photo_approved", spotId, spotName});
    return {added: true};
  });
});
