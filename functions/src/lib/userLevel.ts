/**
 * Stored XP and level (item 5): users/{uid}.{xp, level, levelFloor}, mirrored to
 * publicProfiles/{uid}.{xp, level}. Written only here (and by scripts/migrate-xp.ts).
 */
import {FieldValue} from "firebase-admin/firestore";
import {db} from "./app";
import {DELETED_OWNER} from "./accountDeletion";
import {levelForSpotCount, validLevel} from "./levels";
import {userLevelFields, xpOf} from "./xp";

/**
 * Recomputes one user's XP from every spot they earn it from (own spots and spots listing them in
 * `contributors`) and stores it. Writes are skipped when nothing changed; no users doc is created.
 */
export async function recomputeXp(uid: string): Promise<string> {
  if (!uid || uid === DELETED_OWNER) return "skipped";
  const userRef = db.collection("users").doc(uid);
  const profileRef = db.collection("publicProfiles").doc(uid);
  const own = db.collection("spots").where("createdBy", "==", uid);
  const contributed = db.collection("spots").where("contributors", "array-contains", uid);

  return db.runTransaction(async (tx) => {
    const [ownSnap, contributedSnap, userSnap, profileSnap] = await Promise.all([
      tx.get(own), tx.get(contributed), tx.get(userRef), tx.get(profileRef),
    ]);
    if (!userSnap.exists) return "no-user";
    const spots = new Map([...ownSnap.docs, ...contributedSnap.docs].map((d) => [d.id, d.data()]));
    const fields = userLevelFields(xpOf(uid, spots.values()), userSnap.get("levelFloor"), ownSnap.size);

    let outcome = "unchanged";
    if (userSnap.get("xp") !== fields.xp || userSnap.get("level") !== fields.level ||
        userSnap.get("levelFloor") !== fields.levelFloor) {
      tx.update(userRef, fields);
      outcome = "updated";
    }
    if (!profileSnap.exists || profileSnap.get("xp") !== fields.xp ||
        profileSnap.get("level") !== fields.level) {
      const mirror = {xp: fields.xp, level: fields.level};
      tx.set(profileRef, {...mirror, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      outcome = "updated";
    }
    return outcome;
  });
}

/**
 * The caller's level for server checks: the stored one, or (before it was ever computed) the old
 * spot-count level from a live count of every status.
 */
export async function levelOf(uid: string): Promise<number> {
  const stored = validLevel((await db.collection("users").doc(uid).get()).get("level"));
  if (stored !== null) return stored;
  const n = (await db.collection("spots").where("createdBy", "==", uid).count().get()).data().count;
  return levelForSpotCount(n);
}
