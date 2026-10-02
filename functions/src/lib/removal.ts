/**
 * Removing content as an admin, always with a reason (item 4; reports reuse it): a whole spot, one
 * photo of a spot, one review. Each is read and changed in one transaction, the files go after it,
 * and the author hears about it (inbox + push).
 */
import {DocumentData, FieldValue, WriteBatch} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {db} from "./app";
import {notifyInbox} from "./inbox";
import {planEditApply} from "./moderation";
import {deleteSpotImageFiles, PhotoFile} from "./storageFiles";

/** Every photo of a spot with who may own its file (its uploader, else the spot's creator). */
export function spotPhotoFiles(spot: DocumentData): PhotoFile[] {
  const creator = typeof spot.createdBy === "string" ? spot.createdBy : "";
  const images: DocumentData[] = Array.isArray(spot.spotImages) ? spot.spotImages : [];
  const addedBy = new Map(images.map((i) => [i?.url, typeof i?.addedBy === "string" ? i.addedBy : ""]));
  const urls = new Set<string>([
    ...(Array.isArray(spot.imageUrls) ? spot.imageUrls : []),
    ...images.map((i) => i?.url),
  ].filter((u): u is string => typeof u === "string"));
  return [...urls].map((url) => ({url, owners: [addedBy.get(url) ?? "", creator]}));
}

/** Deletes a spot with its pending edit, photo submissions, visits, replies and files. */
export async function removeSpotWithReason(adminUid: string, spotId: string, reason: string) {
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
  await deleteSpotChildren(spotId);
  await deleteSpotImageFiles([
    ...spotPhotoFiles(spot),
    ...submissions
      .filter((s) => typeof s.url === "string")
      .map((s) => ({url: s.url as string, owners: [String(s.uploader ?? "")]})),
  ]);
  if (spot.createdBy !== adminUid) {
    await notifyInbox({uid: spot.createdBy, type: "spot_removed", spotId, spotName: spot.name, reason});
  }
}

/**
 * A deleted spot's replies, visits, reports and admin-notice cooldown (they are no use without
 * it), and its id in everyone's lists (it would count towards a list's limit, shown nowhere).
 */
export async function deleteSpotChildren(spotId: string): Promise<void> {
  const [replies, visits, reports, lists] = await Promise.all([
    db.collection("spots").doc(spotId).collection("replies").get(),
    db.collection("visits").where("spotId", "==", spotId).get(),
    db.collection("reports").where("spotId", "==", spotId).get(),
    db.collectionGroup("lists").where("spotIds", "array-contains", spotId).select().get(),
  ]);
  const writes: ((batch: WriteBatch) => void)[] = [
    ...[...replies.docs, ...visits.docs, ...reports.docs].map((d) => (b: WriteBatch) => {
      b.delete(d.ref);
    }),
    ...lists.docs.map((d) => (b: WriteBatch) => {
      b.update(d.ref, {spotIds: FieldValue.arrayRemove(spotId)});
    }),
    (b) => {
      b.delete(db.collection("adminNotices").doc(`edit_${spotId}`));
    },
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((write) => write(batch));
    await batch.commit();
  }
}

/** Removes one photo from a spot (admin), tells its uploader. */
export async function removePhotoWithReason(spotId: string, url: string, reason: string) {
  const spotRef = db.collection("spots").doc(spotId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(spotRef);
    if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
    const spot = snap.data() as DocumentData;
    const plan = planEditApply(spot, {removeImageUrls: [url]});
    if (!plan.removedUrls.length) throw new HttpsError("not-found", "Photo not found");
    tx.update(spotRef, plan.update);
    const file = spotPhotoFiles(spot).find((f) => f.url === url);
    return {spot, file};
  });
  if (result.file) await deleteSpotImageFiles([result.file]);
  const uploader = result.file?.owners.find((o) => o) ?? "";
  await notifyInbox({uid: uploader, type: "content_removed", spotId, spotName: String(result.spot.name ?? ""), reason});
}

/** Removes one review from a spot (its author or an admin); an admin's removal tells the author. */
export async function removeReview(
  spotId: string,
  reviewId: string,
  by: {uid: string; isAdmin: boolean},
  reason?: string,
) {
  const spotRef = db.collection("spots").doc(spotId);
  const removed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(spotRef);
    if (!snap.exists) throw new HttpsError("not-found", "Spot not found");
    const reviews: DocumentData[] = Array.isArray(snap.get("reviews")) ? snap.get("reviews") : [];
    const review = reviews.find((r) => r?.id === reviewId);
    if (!review) throw new HttpsError("not-found", "Review not found");
    if (review.userId !== by.uid && !by.isAdmin) throw new HttpsError("permission-denied", "Not your review");
    tx.update(spotRef, {reviews: reviews.filter((r) => r?.id !== reviewId)});
    return {review, spotName: String(snap.get("name") ?? "")};
  });
  // Its replies go too.
  const replies = await spotRef.collection("replies").where("reviewId", "==", reviewId).get();
  await Promise.all(replies.docs.map((d) => d.ref.delete()));
  if (reason && removed.review.userId !== by.uid) {
    await notifyInbox({uid: String(removed.review.userId), type: "content_removed", spotId,
      spotName: removed.spotName, reason});
  }
}
