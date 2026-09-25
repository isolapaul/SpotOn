/**
 * Highlight callables (T10): highlightSpot (same export name, input and success shape as before)
 * and unhighlightSpot. They unify the client-side level system (users.highlightedSpots) and the
 * Valentine callable (questRewards.valentine2026): the source of truth for "active" is the
 * spots/{id}.highlighted[] entry by the caller with expiresAt > now. All writes are computed inside
 * a transaction and use the existing field shapes. The legacy activeHighlights[] is read only
 * (unhighlightSpot may remove entries from it).
 * Error messages are the exact English strings the client shows via error.message.
 * Logs only {uid, spotId, outcome}.
 */
import {DocumentReference} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {
  CandidateSpot,
  computeAllowance,
  highlightCandidateIds,
  planHighlight,
  planUnhighlight,
} from "../lib/highlights";

function requireUid(request: CallableRequest, message: string): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", message);
  }
  return uid;
}

function requireSpotId(request: CallableRequest): string {
  const spotId: unknown = request.data?.spotId;
  if (!isValidSpotId(spotId)) {
    throw new HttpsError("invalid-argument", "Spot ID is required");
  }
  return spotId;
}

function outcomeOf(error: unknown): string {
  return error instanceof HttpsError ? error.code : "error";
}

export const highlightSpot = onCall(async (request: CallableRequest) => {
  const uid = requireUid(request, "User must be authenticated to highlight a spot");
  let spotId: string | null = null;
  try {
    spotId = requireSpotId(request);
    const targetId = spotId;

    // Live count, all statuses (D8); outside the transaction.
    const spotsCount = (await db.collection("spots").where("createdBy", "==", uid).count().get())
      .data().count;

    const userRef = db.collection("users").doc(uid);
    const spotRef = db.collection("spots").doc(targetId);

    const expiresAt = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError("not-found", "User not found");
      }
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists) {
        throw new HttpsError("not-found", "Spot not found");
      }
      const user = userSnap.data() ?? {};
      const spot = spotSnap.data() ?? {};

      const candidateIds = highlightCandidateIds(user, targetId);
      const candidateRefs: DocumentReference[] =
        candidateIds.map((id) => db.collection("spots").doc(id));
      const candidateSnaps = candidateRefs.length ? await tx.getAll(...candidateRefs) : [];
      const candidateSpots: CandidateSpot[] = candidateSnaps.map((snap) => ({
        id: snap.id,
        data: snap.exists ? snap.data() : undefined,
      }));

      const result = planHighlight({
        uid,
        spotId: targetId,
        spot,
        candidateSpots,
        allowance: computeAllowance(spotsCount, user.questRewards),
        now: new Date(),
      });
      if ("error" in result) {
        throw new HttpsError(result.error.code, result.error.message);
      }

      tx.update(spotRef, result.plan.spotUpdate);
      tx.update(userRef, result.plan.userUpdate);
      return result.plan.expiresAt;
    });

    logger.info("highlightSpot", {uid, spotId, outcome: "highlighted"});
    return {
      success: true,
      message: "Spot highlighted successfully",
      expiresAt,
    };
  } catch (error) {
    logger.info("highlightSpot", {uid, spotId, outcome: outcomeOf(error)});
    throw error;
  }
});

export const unhighlightSpot = onCall(async (request: CallableRequest) => {
  const uid = requireUid(request, "User must be authenticated to unhighlight a spot");
  let spotId: string | null = null;
  try {
    spotId = requireSpotId(request);
    const targetId = spotId;

    const userRef = db.collection("users").doc(uid);
    const spotRef = db.collection("spots").doc(targetId);

    const outcome = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const spotSnap = await tx.get(spotRef);

      const plan = planUnhighlight({
        uid,
        spotId: targetId,
        spot: spotSnap.exists ? spotSnap.data() : undefined,
        user: userSnap.exists ? userSnap.data() : undefined,
      });

      if (plan.spotUpdate) tx.update(spotRef, plan.spotUpdate);
      if (plan.userUpdate) tx.update(userRef, plan.userUpdate);
      return plan.spotUpdate || plan.userUpdate ? "unhighlighted" : "unchanged";
    });

    logger.info("unhighlightSpot", {uid, spotId, outcome});
    return {success: true};
  } catch (error) {
    logger.info("unhighlightSpot", {uid, spotId, outcome: outcomeOf(error)});
    throw error;
  }
});
