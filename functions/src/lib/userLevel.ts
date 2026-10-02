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

/**
 * Recomputes one user's XP from every spot they earn it from (own spots and spots listing them in
 * `contributors`) and stores it, then puts the pin icon their level allows on each own spot.
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
  const [ownSnap, contributedSnap] = await Promise.all([
    db.collection("spots").where("createdBy", "==", uid).get(),
    db.collection("spots").where("contributors", "array-contains", uid).get(),
  ]);
  const spots = new Map([...ownSnap.docs, ...contributedSnap.docs].map((d) => [d.id, d.data()]));
  const xp = xpOf(uid, spots.values());

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
    if (!userSnap.exists) return null;
    const fields = userLevelFields(xp, userSnap.get("levelFloor"), null);
    let changed = false;
    if (userSnap.get("xp") !== fields.xp || userSnap.get("level") !== fields.level ||
        userSnap.get("levelFloor") !== fields.levelFloor) {
      tx.update(userRef, fields);
      changed = true;
    }
    if (!profileSnap.exists || profileSnap.get("xp") !== fields.xp ||
        profileSnap.get("level") !== fields.level) {
      const mirror = {xp: fields.xp, level: fields.level};
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
