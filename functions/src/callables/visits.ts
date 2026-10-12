/**
 * markVisited {spotId, position: {lat, lng}, accuracy} (growth plan §4): "I was here" on an
 * approved spot, when the device's position is within VISIT_RADIUS_M of it. Once per person and
 * spot: users/{uid}/visits/{spotId} {spotId, spotName, visitedAt} (owner-only; where someone has
 * been is private), and spotStats/{spotId}.visitCount for the public count. 30 an hour.
 * Logs only {uid, spotId, outcome}.
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {checkRate} from "../lib/rateLimit";
import {closeEnough, parsePosition} from "../lib/visits";

export const markVisited = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const spotId: unknown = request.data?.spotId;
  const position = parsePosition(request.data?.position);
  if (!isValidSpotId(spotId) || !position) {
    throw new HttpsError("invalid-argument", "Invalid spotId or position");
  }
  let outcome = "error";
  try {
    const visitRef = db.collection("users").doc(uid).collection("visits").doc(spotId);
    const result = await db.runTransaction(async (tx) => {
      const [spot, visit, user] = await Promise.all([
        tx.get(db.collection("spots").doc(spotId)), tx.get(visitRef),
        tx.get(db.collection("users").doc(uid)),
      ]);
      if (!spot.exists || spot.get("status") !== "approved" || !user.exists) {
        throw new HttpsError("not-found", "Spot not found");
      }
      if (visit.exists) return "already";
      const at = parsePosition(spot.get("location"));
      if (!at || !closeEnough(at, position, request.data?.accuracy)) {
        throw new HttpsError("failed-precondition", "VISIT_TOO_FAR");
      }
      const count = await checkRate(tx, uid, "visit");
      count();
      tx.create(visitRef, {
        spotId, spotName: String(spot.get("name") ?? ""), visitedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("spotStats").doc(spotId),
        {visitCount: FieldValue.increment(1), dirty: true}, {merge: true});
      return "visited";
    });
    outcome = result;
    return {visited: true, already: result === "already"};
  } catch (error) {
    outcome = error instanceof HttpsError ? error.message : "error";
    throw error;
  } finally {
    logger.info("markVisited", {uid, spotId, outcome});
  }
});
