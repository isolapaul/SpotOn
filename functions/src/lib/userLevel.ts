/**
 * Stored XP and level (item 5): users/{uid}.{xp, level, levelFloor}, mirrored to
 * publicProfiles/{uid}.{xp, level}, and the owner's pin icon on their spots (item 6,
 * spots.ownerPin). Written only here (and by scripts/migrate-xp.ts).
 */
import {FieldValue} from "firebase-admin/firestore";
import {db} from "./app";
import {DELETED_OWNER} from "./accountDeletion";
import {validLevel} from "./levels";
import {ownerPinFor} from "./pinIcons";
import {userLevelFields, xpOf} from "./xp";
import {referralXp} from "./referrals";
import {badgeXp} from "./challenge";

/** The user's referral standing: invitees, of whom with an approved spot, and whether invited. */
export async function referralStats(
  uid: string,
): Promise<{invites: number; withSpot: number; invited: boolean}> {
  const referrals = db.collection("referrals");
  const [all, withSpot, own] = await Promise.all([
    referrals.where("referrer", "==", uid).count().get(),
    referrals.where("referrer", "==", uid).where("spotApproved", "==", true).count().get(),
    referrals.doc(uid).get(),
  ]);
  return {invites: all.data().count, withSpot: withSpot.data().count, invited: own.exists};
}

/**
 * Recomputes one user's XP from every spot they earn it from (own spots and spots listing them in
 * `contributors`) and from the referral program, and stores it (publicProfiles also gets the
 * invitee count, `invitesCount`, for the invite badges), then puts the pin icon their level
 * allows on each own spot.
 * The spots are read outside a transaction: XP is a pure function of them, and any spot write
 * that lands meanwhile runs syncXp again, so the last run stores the right total. Only the
 * users/publicProfiles write is transactional (the stored floor); own spots get `ownerPin` in
 * batches, and only those whose pin differs. Writes are skipped when nothing changed; no users
 * doc is created.
 */
export async function syncUserLevel(uid: string): Promise<string> {
  if (!uid || uid === DELETED_OWNER) return "skipped";
  const userRef = db.collection("users").doc(uid);
  const profileRef = db.collection("publicProfiles").doc(uid);
  const [ownSnap, contributedSnap, referral] = await Promise.all([
    db.collection("spots").where("createdBy", "==", uid).get(),
    db.collection("spots").where("contributors", "array-contains", uid).get(),
    referralStats(uid),
  ]);
  const spots = new Map([...ownSnap.docs, ...contributedSnap.docs].map((d) => [d.id, d.data()]));
  // Spots plus the referral program (growth plan §2).
  const xp = xpOf(uid, spots.values()) +
    referralXp(referral.invites, referral.withSpot, referral.invited);

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
    if (!userSnap.exists) return null;
    // The launch challenge's badge (growth plan §8) adds its XP.
    const fields = userLevelFields(xp + badgeXp(userSnap.get("badges")), userSnap.get("levelFloor"), null);
    let changed = false;
    if (userSnap.get("xp") !== fields.xp || userSnap.get("level") !== fields.level ||
        userSnap.get("levelFloor") !== fields.levelFloor) {
      tx.update(userRef, fields);
      changed = true;
    }
    if (!profileSnap.exists || profileSnap.get("xp") !== fields.xp ||
        profileSnap.get("level") !== fields.level ||
        (profileSnap.get("invitesCount") ?? 0) !== referral.invites) {
      const mirror = {xp: fields.xp, level: fields.level, invitesCount: referral.invites};
      tx.set(profileRef, {...mirror, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      changed = true;
    }
    return {changed, pin: ownerPinFor(fields.level, userSnap.get("pinIcon"))};
  });
  if (!result) return "no-user";

  const stale = ownSnap.docs.filter((spot) => (spot.get("ownerPin") ?? null) !== result.pin);
  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    for (const spot of stale.slice(i, i + 400)) {
      batch.update(spot.ref, {ownerPin: result.pin ?? FieldValue.delete()});
    }
    await batch.commit();
  }
  return result.changed || stale.length ? "updated" : "unchanged";
}

/**
 * The caller's level for server checks: the stored one, or 1 before it was ever computed (the
 * migration stores everyone's; a new account has no approved spot yet).
 */
export async function levelOf(uid: string): Promise<number> {
  return validLevel((await db.collection("users").doc(uid).get()).get("level")) ?? 1;
}
