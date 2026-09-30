/**
 * Moderation callables (item 4), admins only; every "no" needs a reason (1–500 characters):
 * - approveSpot: a pending spot becomes approved (onSpotApproved then tells the owner).
 * - rejectSpot: a pending spot becomes rejected, with the reason on it (owner and admins read it).
 * - removeSpot: deletes a spot with its photos, pending edit and photo submissions.
 * - reviewSpotEdit: applies or rejects an owner's proposed edit of an approved spot; the admin
 *   passes the proposal's createdAt, so an edit changed or withdrawn meanwhile is never applied
 *   unseen.
 * - reviewPhotoSubmission: adds or rejects a photo waiting for approval.
 * Every decision is read, checked and written in one transaction. The owner or uploader hears about
 * it (inbox + push). Logs only ids and outcomes.
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
import {deleteSpotImageFiles, PhotoFile} from "../lib/storageFiles";

async function requireAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  if ((await getAdminRole(uid)) === null) throw new HttpsError("permission-denied", "Admins only");
  return uid;
}

function requireId(x: unknown, what: string): string {
  if (!isValidSpotId(x)) throw new HttpsError("invalid-argument", `Invalid ${what}`);
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

/** Every photo of a spot with who may own its file (its uploader, else the spot's creator). */
function spotPhotoFiles(spot: DocumentData): PhotoFile[] {
  const creator = typeof spot.createdBy === "string" ? spot.createdBy : "";
  const images: DocumentData[] = Array.isArray(spot.spotImages) ? spot.spotImages : [];
  const addedBy = new Map(images.map((i) => [i?.url, typeof i?.addedBy === "string" ? i.addedBy : ""]));
  const urls = new Set<string>([
    ...(Array.isArray(spot.imageUrls) ? spot.imageUrls : []),
    ...images.map((i) => i?.url),
  ].filter((u): u is string => typeof u === "string"));
  return [...urls].map((url) => ({url, owners: [addedBy.get(url) ?? "", creator]}));
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

/** Reads a spot in a transaction and requires it to be pending. */
async function pendingSpot(
  tx: FirebaseFirestore.Transaction,
  spotId: string,
): Promise<DocumentData> {
  const snap = await tx.get(db.collection("spots").doc(spotId));
  if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
  const data = snap.data() as DocumentData;
  if (data.status !== "pending") throw new HttpsError("failed-precondition", "Only pending spots");
  return data;
}

export const approveSpot = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireId(request.data?.spotId, "spotId");
  return logged("approveSpot", uid, spotId, async () => {
    await db.runTransaction(async (tx) => {
      await pendingSpot(tx, spotId);
      tx.update(db.collection("spots").doc(spotId), {status: "approved"});
    });
    return {approved: true};
  });
});

export const rejectSpot = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireId(request.data?.spotId, "spotId");
  const reason = requireReason(request.data?.reason);
  return logged("rejectSpot", uid, spotId, async () => {
    const spot = await db.runTransaction(async (tx) => {
      const data = await pendingSpot(tx, spotId);
      tx.update(db.collection("spots").doc(spotId), {
        status: "rejected",
        rejection: {reason, at: Timestamp.now()},
      });
      return data;
    });
    await notifyInbox({uid: spot.createdBy, type: "spot_rejected", spotId, spotName: spot.name, reason});
    return {rejected: true};
  });
});

export const removeSpot = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireId(request.data?.spotId, "spotId");
  const reason = requireReason(request.data?.reason);
  return logged("removeSpot", uid, spotId, async () => {
    const spotRef = db.collection("spots").doc(spotId);
    const submissionsQuery = db.collection("photoSubmissions").where("spotId", "==", spotId);
    const {spot, submissions} = await db.runTransaction(async (tx) => {
      const snap = await tx.get(spotRef);
      if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
      const subs = await tx.get(submissionsQuery);
      tx.delete(spotRef);
      tx.delete(db.collection("spotEdits").doc(spotId));
      subs.docs.forEach((doc) => tx.delete(doc.ref));
      return {spot: snap.data() as DocumentData, submissions: subs.docs.map((d) => d.data())};
    });

    await deleteSpotImageFiles([
      ...spotPhotoFiles(spot),
      ...submissions
        .filter((s) => typeof s.url === "string")
        .map((s) => ({url: s.url as string, owners: [String(s.uploader ?? "")]})),
    ]);
    if (spot.createdBy !== uid) {
      await notifyInbox({uid: spot.createdBy, type: "spot_removed", spotId, spotName: spot.name, reason});
    }
    return {removed: true};
  });
});

/**
 * The proposal's createdAt the admin reviewed, in whole ms (required: nothing is applied unseen).
 * Floored because the web SDK's toMillis() keeps the microseconds as a fraction.
 */
function requireSeenAt(x: unknown): number {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw new HttpsError("invalid-argument", "The reviewed version (seenAt) is required");
  }
  return Math.floor(x);
}

export const reviewSpotEdit = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const spotId = requireId(request.data?.spotId, "spotId");
  const approve = request.data?.approve === true;
  const reason = approve ? undefined : requireReason(request.data?.reason);
  const seenAt = requireSeenAt(request.data?.seenAt);
  return logged("reviewSpotEdit", uid, spotId, async () => {
    const editRef = db.collection("spotEdits").doc(spotId);
    const spotRef = db.collection("spots").doc(spotId);

    // Only a custom category needs a lookup; it is re-checked below against the reviewed proposal.
    const peek = (await editRef.get()).get("proposed.category");
    const customCategory = typeof peek === "string" && !BUILT_IN_CATEGORIES.includes(peek) &&
      (await isKnownCategory(peek)) ? peek : null;
    const isCategory = (id: string) => BUILT_IN_CATEGORIES.includes(id) || id === customCategory;

    const result = await db.runTransaction(async (tx) => {
      const [editSnap, spotSnap] = await Promise.all([tx.get(editRef), tx.get(spotRef)]);
      const createdAt = editSnap.get("createdAt") as Timestamp | undefined;
      const version = createdAt ? Math.floor(createdAt.toMillis()) : null;
      if (!editSnap.exists || editSnap.get("status") !== "pending" || version !== seenAt) {
        throw new HttpsError("failed-precondition", "The proposal changed or is gone; reload");
      }
      const ownerId = editSnap.get("ownerId") as string;
      if (!spotSnap.exists) {
        tx.delete(editRef);
        const spotName = String(editSnap.get("spotName") ?? "");
        return {ownerId, spotName, removed: [] as PhotoFile[], applied: false, spotGone: true};
      }
      const spot = spotSnap.data() as DocumentData;
      if (!approve) {
        tx.update(editRef, {status: "rejected", rejection: {reason, at: Timestamp.now()}});
        return {ownerId, spotName: String(spot.name ?? ""), removed: [] as PhotoFile[], applied: false, spotGone: false};
      }
      const proposal = readProposal(editSnap.get("proposed"), isCategory);
      const plan = planEditApply(spot, proposal);
      if (Object.keys(plan.update).length) tx.update(spotRef, plan.update);
      tx.delete(editRef);
      const removed = spotPhotoFiles(spot).filter((f) => plan.removedUrls.includes(f.url));
      return {ownerId, spotName: String(proposal.name ?? spot.name ?? ""), removed, applied: true, spotGone: false};
    });

    await deleteSpotImageFiles(result.removed);
    // A spot deleted meanwhile: its proposal is dropped; the owner heard about the removal.
    if (result.spotGone) return {applied: false};
    await notifyInbox({
      uid: result.ownerId,
      type: approve ? "edit_approved" : "edit_rejected",
      spotId,
      spotName: result.spotName,
      ...(approve ? {} : {reason}),
    });
    return {applied: result.applied};
  });
});

export const reviewPhotoSubmission = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const submissionId = requireId(request.data?.submissionId, "submissionId");
  const approve = request.data?.approve === true;
  const reason = approve ? undefined : requireReason(request.data?.reason);
  return logged("reviewPhotoSubmission", uid, submissionId, async () => {
    const subRef = db.collection("photoSubmissions").doc(submissionId);
    const outcome = await db.runTransaction(async (tx) => {
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists) throw new HttpsError("not-found", "Submission not found");
      type Submission = {spotId: string; uploader: string; url: string};
      const {spotId, uploader, url} = subSnap.data() as Submission;
      const spotRef = db.collection("spots").doc(spotId);
      const spotSnap = await tx.get(spotRef);
      tx.delete(subRef);
      const spot = spotSnap.data() as DocumentData | undefined;
      const base = {spotId, uploader, url, spotName: String(spot?.name ?? "")};
      if (!approve || !spot) return {...base, added: false, spotGone: !spot};

      const existing: unknown[] = Array.isArray(spot.imageUrls) ? spot.imageUrls : [];
      if (existing.includes(url)) return {...base, added: true, spotGone: false};
      const now = Timestamp.now();
      const used = new Set(currentImages(spot, spotId, now).map((image) => image?.id));
      let plan;
      try {
        plan = planAddImages(spot, spotId, [url], uploader, now, uniqueIdFactory(used));
      } catch {
        throw new HttpsError("resource-exhausted", "MAX_SPOT_IMAGES");
      }
      tx.update(spotRef, {...plan});
      return {...base, added: true, spotGone: false};
    });

    if (!outcome.added) {
      await deleteSpotImageFiles([{url: outcome.url, owners: [outcome.uploader]}]);
    }
    if (outcome.spotGone) throw new HttpsError("not-found", "Spot not found");
    await notifyInbox({
      uid: outcome.uploader,
      type: approve ? "photo_approved" : "photo_rejected",
      spotId: outcome.spotId,
      spotName: outcome.spotName,
      ...(approve ? {} : {reason}),
    });
    return {added: outcome.added};
  });
});
