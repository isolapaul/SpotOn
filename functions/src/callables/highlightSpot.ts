/**
 * Callable highlightSpot, moved verbatim from index.ts (T08; T10 replaces the logic).
 */
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";

// ========================================
// CALLABLE: Highlight a Spot
// ========================================
export const highlightSpot = onCall(async (request: CallableRequest) => {
  logger.info("highlightSpot", {uid: request.auth?.uid, spotId: request.data?.spotId});

  // Check authentication
  if (!request.auth) {
    logger.warn("Highlight attempt without authentication");
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated to highlight a spot",
    );
  }

  const userId = request.auth.uid;
  const spotId = request.data?.spotId;

  logger.info(`Highlight request from user ${userId} for spot ${spotId}`);

  if (!spotId) {
    logger.warn("No spotId provided");
    throw new HttpsError(
      "invalid-argument",
      "Spot ID is required",
    );
  }

  // Get user document
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    logger.warn(`User ${userId} not found`);
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userDoc.data();

  // Check if user has highlight bonus available
  const highlightBonus = userData?.questRewards?.valentine2026?.highlightBonus ?? 0;
  logger.info(`User highlight bonus: ${highlightBonus}`);

  if (highlightBonus <= 0) {
    logger.warn("No highlight bonus available");
    throw new HttpsError(
      "permission-denied",
      "No highlight bonus available",
    );
  }

  // Count active highlights by this user (filter out expired ones)
  const now = new Date();
  const allHighlights = userData?.questRewards?.valentine2026?.activeHighlights ?? [];
  const activeHighlights = allHighlights.filter((h: any) => {
    const expiry = new Date(h.expiresAt);
    return expiry > now;
  });

  logger.info(`Active highlights: ${activeHighlights.length}/${highlightBonus}`);

  if (activeHighlights.length >= highlightBonus) {
    throw new HttpsError(
      "permission-denied",
      "You have reached your highlight limit",
    );
  }

  // Check if spot exists
  const spotRef = db.collection("spots").doc(spotId);
  const spotDoc = await spotRef.get();

  if (!spotDoc.exists) {
    logger.warn(`Spot ${spotId} not found`);
    throw new HttpsError("not-found", "Spot not found");
  }

  // Check if user already highlighted this spot
  const spotData = spotDoc.data();
  const highlighted = spotData?.highlighted || [];
  const alreadyHighlighted = highlighted.some(
    (h: any) => h.userId === userId,
  );

  if (alreadyHighlighted) {
    logger.warn("User already highlighted this spot");
    throw new HttpsError(
      "permission-denied",
      "You have already highlighted this spot",
    );
  }

  // Create highlight entry (expires in 7 days)
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Add highlight to spot using arrayUnion for safety
  await spotRef.update({
    highlighted: FieldValue.arrayUnion({
      userId: userId,
      highlightedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  });

  // Update user's active highlights
  await userRef.update({
    "questRewards.valentine2026.activeHighlights": FieldValue.arrayUnion({
      spotId: spotId,
      highlightedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  });

  logger.info(
    `SUCCESS: User ${userId} highlighted spot ${spotId}. Expires: ${expiresAt.toISOString()}`,
  );

  return {
    success: true,
    message: "Spot highlighted successfully",
    expiresAt: expiresAt.toISOString(),
  };
});
