/**
 * claimChallengeBadge (growth plan §8): during the launch season, checks the caller's five first
 * steps on the server (a spot of their own, a review or photo on someone's approved spot, a
 * follow, an "I was here" stamp, a favourite) and, when all are done, stores the "Founder" badge
 * (users.badges, server-only; publicProfiles.badges) and recomputes the XP (+FOUNDER_XP). Answers
 * the missing steps otherwise. Logs only {uid, outcome}.
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {badgesOf, ChallengeStep, FOUNDER_BADGE, missingSteps, seasonOpen} from "../lib/challenge";
import {syncUserLevel} from "../lib/userLevel";

export const claimChallengeBadge = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated");
  const config = await db.collection("config").doc("app").get();
  if (!seasonOpen(Date.now(), config.get("launchChallengeEnd"))) {
    throw new HttpsError("failed-precondition", "CHALLENGE_OVER");
  }
  const userRef = db.collection("users").doc(uid);
  const [user, ownSpot, contributed, follow, visit] = await Promise.all([
    userRef.get(),
    db.collection("spots").where("createdBy", "==", uid).limit(1).get(),
    db.collection("spots").where("contributors", "array-contains", uid).limit(1).get(),
    db.collection("follows").where("follower", "==", uid).limit(1).get(),
    userRef.collection("visits").limit(1).get(),
  ]);
  if (!user.exists) throw new HttpsError("not-found", "User not found");
  if (badgesOf(user.get("badges")).includes(FOUNDER_BADGE)) return {badge: FOUNDER_BADGE, missing: []};
  const saved = user.get("savedSpots");
  const done: Record<ChallengeStep, boolean> = {
    spot: !ownSpot.empty,
    review: !contributed.empty,
    follow: !follow.empty,
    visit: !visit.empty,
    favorite: Array.isArray(saved) && saved.length > 0,
  };
  const missing = missingSteps(done);
  if (missing.length) {
    logger.info("claimChallengeBadge", {uid, outcome: "missing", count: missing.length});
    return {badge: null, missing};
  }
  await userRef.update({badges: FieldValue.arrayUnion(FOUNDER_BADGE)});
  await db.collection("publicProfiles").doc(uid)
    .set({badges: FieldValue.arrayUnion(FOUNDER_BADGE)}, {merge: true});
  await syncUserLevel(uid);
  logger.info("claimChallengeBadge", {uid, outcome: "awarded"});
  return {badge: FOUNDER_BADGE, missing: []};
});
