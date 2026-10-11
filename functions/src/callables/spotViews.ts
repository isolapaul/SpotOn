/**
 * recordSpotView {spotId} (growth plan §3): a signed-in person opened an approved spot's details.
 * Counts once per person, spot and UTC day (viewMarks/{spotId}_{uid}); the owner's own views do
 * not count. Adds to spotStats/{spotId}.viewCount (marked dirty for the daily roll-up onto the
 * spot) and to the owner's week (ownerStats/{owner}). Logs nothing per view (too frequent).
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {dayKey} from "../lib/telemetry";
import {nextWeekViews, viewCounts, viewMarkId} from "../lib/spotStats";

export const recordSpotView = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const spotId: unknown = request.data?.spotId;
  if (!isValidSpotId(spotId)) throw new HttpsError("invalid-argument", "Invalid spotId");
  const now = Date.now();
  const counted = await db.runTransaction(async (tx) => {
    const markRef = db.collection("viewMarks").doc(viewMarkId(spotId, uid));
    const [spot, mark] = await Promise.all([tx.get(db.collection("spots").doc(spotId)), tx.get(markRef)]);
    const owner = spot.get("createdBy");
    if (!spot.exists || spot.get("status") !== "approved" || owner === uid) return false;
    if (!viewCounts(mark.get("day"), now)) return false;
    const ownerRef = typeof owner === "string" && owner ? db.collection("ownerStats").doc(owner) : null;
    const ownerSnap = ownerRef ? await tx.get(ownerRef) : null;
    tx.set(markRef, {spotId, uid, day: dayKey(now)});
    tx.set(db.collection("spotStats").doc(spotId),
      {viewCount: FieldValue.increment(1), dirty: true}, {merge: true});
    if (ownerRef) tx.set(ownerRef, nextWeekViews(ownerSnap?.data(), now));
    return true;
  });
  return {counted};
});
