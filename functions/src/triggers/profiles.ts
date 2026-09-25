/**
 * Server-maintained public profile mirror (T09):
 * - syncPublicProfile: users/{uid} → publicProfiles/{uid} projection.
 * - syncSpotsCount: spot create/delete/owner change → users.spotsCount + publicProfiles.spotsCount
 *   (all statuses, D8).
 * - syncAdminFlag: admins/{uid} → publicProfiles/{uid}.isAdmin.
 * These write only users.spotsCount and publicProfiles; no trigger listens on publicProfiles,
 * and every write is skipped when the stored value is already current, so nothing loops.
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {buildPublicProfile, profileFieldsEqual} from "../lib/profiles";

/** True when merging `patch` into `existing` would not change any field except updatedAt. */
function alreadyMerged(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): boolean {
  return existing !== undefined && profileFieldsEqual({...existing, ...patch}, existing);
}

export const syncPublicProfile = onDocumentWritten(
  "users/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const profileRef = db.collection("publicProfiles").doc(uid);

    // Always re-read fresh state (never trust the event snapshot, including for
    // deletes) so out-of-order events converge; a missing users doc deletes below.
    const [userSnap, adminSnap, profileSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("admins").doc(uid).get(),
      profileRef.get(),
    ]);
    const user = userSnap.data();
    if (!user) {
      await profileRef.delete();
      logger.info("syncPublicProfile", {uid, outcome: "deleted"});
      return;
    }

    const projection = buildPublicProfile(user, {isAdmin: adminSnap.exists});
    if (alreadyMerged(profileSnap.data(), {...projection})) {
      logger.info("syncPublicProfile", {uid, outcome: "unchanged"});
      return;
    }
    await profileRef.set(
      {...projection, updatedAt: FieldValue.serverTimestamp()},
      {merge: true},
    );
    logger.info("syncPublicProfile", {uid, outcome: "written"});
  },
);

/** Recounts one owner's spots (all statuses) and stores the count on users + publicProfiles. */
async function recountSpots(uid: string): Promise<string> {
  const userRef = db.collection("users").doc(uid);
  const profileRef = db.collection("publicProfiles").doc(uid);
  const countQuery = db.collection("spots").where("createdBy", "==", uid).count();

  return db.runTransaction(async (tx) => {
    // Reads first.
    const n = (await tx.get(countQuery)).data().count;
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return "no-user"; // never create a users doc
    const profileSnap = await tx.get(profileRef);

    let outcome = "unchanged";
    if (userSnap.get("spotsCount") !== n) {
      tx.update(userRef, {spotsCount: n});
      outcome = "updated";
    }
    if (!profileSnap.exists || profileSnap.get("spotsCount") !== n) {
      tx.set(profileRef, {spotsCount: n, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      outcome = "updated";
    }
    return outcome;
  });
}

export const syncSpotsCount = onDocumentWritten(
  "spots/{spotId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Only creates, deletes and owner changes change a count; reviews, likes, status,
    // highlights and edits must not recount.
    const created = !before && !!after;
    const deleted = !!before && !after;
    if (!created && !deleted && before?.createdBy === after?.createdBy) return;

    const uids = new Set<string>();
    for (const owner of [before?.createdBy, after?.createdBy]) {
      if (typeof owner === "string" && owner.length > 0) uids.add(owner);
    }
    for (const uid of uids) {
      const outcome = await recountSpots(uid);
      logger.info("syncSpotsCount", {spotId: event.params.spotId, uid, outcome});
    }
  },
);

export const syncAdminFlag = onDocumentWritten(
  "admins/{uid}",
  async (event) => {
    const uid = event.params.uid;
    // Fresh read (not the event snapshot) so out-of-order add/remove events converge.
    const [adminSnap, userSnap, profileSnap] = await Promise.all([
      db.collection("admins").doc(uid).get(),
      db.collection("users").doc(uid).get(),
      db.collection("publicProfiles").doc(uid).get(),
    ]);
    const isAdmin = adminSnap.exists;
    if (!userSnap.exists) {
      logger.info("syncAdminFlag", {uid, outcome: "no-user"});
      return;
    }
    if (profileSnap.exists && profileSnap.get("isAdmin") === isAdmin) {
      logger.info("syncAdminFlag", {uid, outcome: "unchanged"});
      return;
    }
    await db.collection("publicProfiles").doc(uid).set(
      {isAdmin, updatedAt: FieldValue.serverTimestamp()},
      {merge: true},
    );
    logger.info("syncAdminFlag", {uid, outcome: "written"});
  },
);
