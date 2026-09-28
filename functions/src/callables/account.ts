/**
 * Account deletion (A2): deleteAccount, called by the signed-in user from Settings.
 *
 * Checks: signed in; the typed confirmation equals the username; not an admin (a super admin
 * removes the admin role first). Then, in an order that is safe to retry (the Auth user goes last,
 * so a failure halfway leaves the user signed in to try again):
 * 1. every spot: planSpotCleanup (own spots anonymised, reviews / photos on others' spots / likes /
 *    highlights removed), each in its own transaction;
 * 2. Storage: removed photos, uploads no own spot shows, profile pictures and banners;
 * 3. usernames/{name}, users/{uid} (syncPublicProfile then drops publicProfiles), publicProfiles;
 * 4. the Firebase Auth user.
 * Logs only uid and counts.
 */
import {FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {auth, db} from "../lib/app";
import {parseStorageDownloadUrl} from "../lib/spotImages";
import {DeletionRefusal, orphanedUploads, planSpotCleanup} from "../lib/accountDeletion";

function refuse(
  code: "failed-precondition" | "invalid-argument",
  reason: DeletionRefusal,
  message: string,
): never {
  throw new HttpsError(code, message, {reason});
}

async function deleteQuietly(paths: Iterable<string>): Promise<number> {
  const bucket = getStorage().bucket();
  let deleted = 0;
  for (const path of paths) {
    await bucket.file(path).delete({ignoreNotFound: true});
    deleted += 1;
  }
  return deleted;
}

async function listPaths(prefix: string): Promise<string[]> {
  const [files] = await getStorage().bucket().getFiles({prefix});
  return files.map((f) => f.name);
}

export const deleteAccount = onCall({timeoutSeconds: 300}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to delete your account");

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const username = userSnap.get("username");
  // Case-insensitive: legacy usernames may predate the lowercase rule (normalizeUsername).
  const typed = request.data?.confirmUsername;
  if (typeof username === "string" && username !== "") {
    if (typeof typed !== "string" || typed.trim().toLowerCase() !== username.toLowerCase()) {
      refuse("invalid-argument", "confirmation-mismatch", "The confirmation does not match");
    }
  }
  if ((await db.collection("admins").doc(uid).get()).exists) {
    refuse("failed-precondition", "is-admin", "Admins cannot delete their account");
  }

  // 1. Spots. Reviews, likes and highlights are embedded (D15), so every spot is checked.
  const bucket: string = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").storageBucket ?? "";
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const pathOf = (url: string) =>
    parseStorageDownloadUrl(url, {bucket, emulatorHost})?.path ?? null;

  const removedPaths = new Set<string>();
  const keptPaths = new Set<string>();
  let spotsChanged = 0;
  const spots = await db.collection("spots").get();
  for (const doc of spots.docs) {
    const own = doc.get("createdBy") === uid;
    if (!own && !planSpotCleanup(doc.data(), uid, pathOf).update) continue;
    const changed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const data = snap.data();
      if (!data) return false;
      const plan = planSpotCleanup(data, uid, pathOf);
      if (data.createdBy === uid) {
        for (const url of Array.isArray(data.imageUrls) ? data.imageUrls : []) {
          const path = typeof url === "string" ? pathOf(url) : null;
          if (path) keptPaths.add(path);
        }
      }
      if (!plan.update && !plan.anonymize) return false;
      const anonymized = {createdByName: FieldValue.delete(), createdByPhoto: FieldValue.delete()};
      tx.update(doc.ref, {...plan.update, ...(plan.anonymize ? anonymized : {})});
      plan.deletePaths.forEach((p) => removedPaths.add(p));
      return true;
    });
    if (changed) spotsChanged += 1;
  }

  // 2. Storage.
  const uploads = orphanedUploads(await listPaths(`spot-images/${uid}/`), keptPaths);
  const files = await deleteQuietly(new Set([
    ...removedPaths,
    ...uploads,
    ...(await listPaths(`profile-pictures/${uid}/`)),
    ...(await listPaths(`profile-banners/${uid}/`)),
  ]));

  // 3. Profile documents.
  const names = await db.collection("usernames").where("uid", "==", uid).get();
  await Promise.all(names.docs.map((d) => d.ref.delete()));
  await userRef.delete();
  await db.collection("publicProfiles").doc(uid).delete();

  // 4. The Auth user, last.
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as {code?: string})?.code !== "auth/user-not-found") throw error;
  }

  logger.info("deleteAccount", {uid, spotsChanged, files, usernames: names.size});
  return {success: true};
});
