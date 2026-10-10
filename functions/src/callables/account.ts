/**
 * Account deletion (A2): deleteAccount, called by the signed-in user from Settings.
 *
 * Checks: signed in; the typed confirmation equals the username; not an admin (a super admin
 * removes the admin role first). Then, in an order that is safe to retry (the Auth user goes last,
 * so a failure halfway leaves the user signed in to try again):
 * 1. every spot: planSpotCleanup (own spots handed to DELETED_OWNER with their photos copied to
 *    spot-images/deleted-user/ first, reviews / photos on others' spots / likes / highlights
 *    removed), each in its own transaction;
 * 2. Storage: removed photos, uploads no own spot shows, profile pictures and banners;
 * 3. the inbox, the spot lists, the user's spotEdits proposals and photoSubmissions (item 4);
 * 4. usernames/{name}, users/{uid} (syncPublicProfile then drops publicProfiles), publicProfiles;
 * 4b. follows both ways (counters adjusted), follow requests, request-notice cooldowns, rate
 *     limits;
 * 4c. blocks both ways, reports the user filed, their replies and the replies to their reviews,
 *     notices in other users' inboxes that name them;
 * 5. the Firebase Auth user.
 * Logs only uid and counts.
 */
import {DocumentData, DocumentReference, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {auth, db} from "../lib/app";
import {parseStorageDownloadUrl} from "../lib/spotImages";
import {
  DeletionRefusal,
  orphanedUploads,
  planSpotCleanup,
  relocatedPath,
  rewriteDownloadUrl,
} from "../lib/accountDeletion";

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

/**
 * Copies the user's photos on one of their own spots to spot-images/deleted-user/ (idempotent: an
 * existing copy is reused) and returns the URL rewrite for them. The copy keeps the object's
 * metadata, so its download token, and the old files are deleted later with the other uploads.
 */
async function relocateOwnPhotos(
  spotId: string,
  data: DocumentData,
  ownPrefix: string,
  pathOf: (url: string) => string | null,
): Promise<(url: string) => string | null> {
  const bucket = getStorage().bucket();
  const urls = new Set<string>();
  for (const u of Array.isArray(data.imageUrls) ? data.imageUrls : []) if (typeof u === "string") urls.add(u);
  for (const img of Array.isArray(data.spotImages) ? data.spotImages : []) {
    if (typeof img?.url === "string") urls.add(img.url);
  }
  if (typeof data.imageUrl === "string") urls.add(data.imageUrl);

  const rewrites = new Map<string, string>();
  for (const url of urls) {
    const path = pathOf(url);
    if (!path || !path.startsWith(ownPrefix)) continue;
    const target = relocatedPath(spotId, path);
    const next = rewriteDownloadUrl(url, path, target);
    if (!next) continue;
    const [exists] = await bucket.file(target).exists();
    if (!exists) {
      const [sourceExists] = await bucket.file(path).exists();
      if (!sourceExists) continue; // a dead link stays as it is
      await bucket.file(path).copy(bucket.file(target));
    }
    rewrites.set(url, next);
  }
  return (url) => rewrites.get(url) ?? null;
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
  // The word to type: the username, else the account e-mail, else "delete" (same fallback as the
  // client's DeleteAccountModal). Case-insensitive: legacy usernames may predate lowercase.
  const expected = (typeof username === "string" && username) ||
    request.auth?.token?.email || "delete";
  const typed = request.data?.confirmUsername;
  if (typeof typed !== "string" || typed.trim().toLowerCase() !== expected.toLowerCase()) {
    refuse("invalid-argument", "confirmation-mismatch", "The confirmation does not match");
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
  /** The user's removed reviews per spot: other people's replies to them go too (step 4c). */
  const removedReviews = new Map<string, string[]>();
  const ownPrefix = `spot-images/${uid}/`;
  const spots = await db.collection("spots").get();
  for (const doc of spots.docs) {
    const own = doc.get("createdBy") === uid;
    if (!own && !planSpotCleanup(doc.data(), uid, pathOf).update) continue;
    // Own spot: copy its photos out of the user's folder first, so the transaction can point the
    // spot at the copies (Storage is not transactional; a retry reuses existing copies).
    const relocate = own ?
      await relocateOwnPhotos(doc.id, doc.data(), ownPrefix, pathOf) :
      undefined;
    // Paths are collected from the committed attempt only (a transaction may retry).
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const data = snap.data();
      if (!data) {
        const none: string[] = [];
        return {changed: false, deletePaths: none, kept: none, reviewIds: none};
      }
      const reviewIds = (Array.isArray(data.reviews) ? data.reviews : [])
        .filter((r: {userId?: unknown; id?: unknown}) =>
          r?.userId === uid && typeof r?.id === "string")
        .map((r: {id: string}) => r.id);
      const plan = planSpotCleanup(data, uid, pathOf, relocate);
      // Files the spot still shows after the update (a photo that could not be copied keeps its
      // old place and must not be deleted).
      const finalUrls = (plan.update?.imageUrls ?? data.imageUrls) as unknown;
      const kept = Array.isArray(finalUrls) ?
        finalUrls.map((url: unknown) => (typeof url === "string" ? pathOf(url) : null))
          .filter((p: string | null): p is string => !!p) :
        [];
      if (!plan.update && !plan.anonymize) {
        return {changed: false, deletePaths: [], kept, reviewIds};
      }
      const anonymized = {createdByName: FieldValue.delete(), createdByPhoto: FieldValue.delete()};
      tx.update(doc.ref, {...plan.update, ...(plan.anonymize ? anonymized : {})});
      return {changed: true, deletePaths: plan.deletePaths, kept, reviewIds};
    });
    if (result.reviewIds.length) removedReviews.set(doc.id, result.reviewIds);
    result.kept.forEach((p) => keptPaths.add(p));
    result.deletePaths.forEach((p) => removedPaths.add(p));
    if (result.changed) spotsChanged += 1;
  }

  // 2. Storage.
  const uploads = orphanedUploads(await listPaths(ownPrefix), keptPaths);
  const files = await deleteQuietly(new Set([
    ...removedPaths,
    ...uploads,
    ...(await listPaths(`profile-pictures/${uid}/`)),
    ...(await listPaths(`profile-banners/${uid}/`)),
  ]));

  // 3. Moderation documents (item 4): the inbox, the spot lists, the user's pending edit
  // proposals and photo submissions (their files were orphaned uploads above).
  const [inbox, lists, edits, submissions] = await Promise.all([
    userRef.collection("inbox").get(),
    userRef.collection("lists").get(),
    db.collection("spotEdits").where("ownerId", "==", uid).get(),
    db.collection("photoSubmissions").where("uploader", "==", uid).get(),
  ]);
  await Promise.all([...inbox.docs, ...lists.docs, ...edits.docs, ...submissions.docs]
    .map((d) => d.ref.delete()));

  // 4. Profile documents.
  const names = await db.collection("usernames").where("uid", "==", uid).get();
  await Promise.all(names.docs.map((d) => d.ref.delete()));
  await userRef.delete();
  await db.collection("publicProfiles").doc(uid).delete();

  // 4b. Follows (item 8), after the users doc is gone (the follow callables read both users docs
  // in their transactions, so no new edge or counter can appear): both directions (the other
  // side's count drops, only for an edge that still exists), requests, request-notice and
  // favourite-notice cooldowns, rate limits.
  const [following, followers, sent, received, noticesSent, noticesReceived, favNotices] =
    await Promise.all([
      db.collection("follows").where("follower", "==", uid).get(),
      db.collection("follows").where("target", "==", uid).get(),
      db.collection("followRequests").where("requester", "==", uid).get(),
      db.collection("followRequests").where("target", "==", uid).get(),
      db.collection("followNotices").where("requester", "==", uid).get(),
      db.collection("followNotices").where("target", "==", uid).get(),
      db.collection("favoriteNotices").where("favoriter", "==", uid).get(),
    ]);
  // The user's spot likes: each goes with its count, in one transaction per like.
  const likes = await db.collection("spotLikes").where("uid", "==", uid).get();
  await Promise.all(likes.docs.map((d) => db.runTransaction(async (tx) => {
    if (!(await tx.get(d.ref)).exists) return;
    tx.delete(d.ref);
    const spotRef = db.collection("spots").doc(String(d.get("spotId")));
    if ((await tx.get(spotRef)).exists) tx.update(spotRef, {likeCount: FieldValue.increment(-1)});
  })));
  const counters = db.collection("publicProfiles");
  const dropEdge = (ref: DocumentReference, other: string, field: string) =>
    db.runTransaction(async (tx) => {
      if (!(await tx.get(ref)).exists) return;
      tx.delete(ref);
      tx.set(counters.doc(other), {[field]: FieldValue.increment(-1)}, {merge: true});
    });
  await Promise.all([
    ...following.docs.map((d) => dropEdge(d.ref, String(d.get("target")), "followersCount")),
    ...followers.docs.map((d) => dropEdge(d.ref, String(d.get("follower")), "followingCount")),
    ...[sent, received, noticesSent, noticesReceived, favNotices]
      .flatMap((q) => q.docs).map((d) => d.ref.delete()),
    db.collection("rateLimits").doc(uid).delete(),
  ]);

  // 4c. Blocks either way, reports the user filed, their replies and other people's replies to
  // their (removed) reviews, and the notices in other users' inboxes that name them (follow
  // news, replies). Reports about them stay until an admin resolves them; their author field no
  // longer resolves to anyone.
  const replyQueries = [...removedReviews].flatMap(([spotId, ids]) => {
    const replies = db.collection("spots").doc(spotId).collection("replies");
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    return chunks.map((chunk) => replies.where("reviewId", "in", chunk).get());
  });
  const safety = await Promise.all([
    db.collection("blocks").where("blocker", "==", uid).get(),
    db.collection("blocks").where("blocked", "==", uid).get(),
    db.collection("reports").where("reporter", "==", uid).get(),
    db.collectionGroup("replies").where("userId", "==", uid).get(),
    db.collectionGroup("inbox").where("actorUid", "==", uid).get(),
    ...replyQueries,
  ]);
  await Promise.all(safety.flatMap((q) => q.docs.map((d) => d.ref.delete())));

  // 5. The Auth user, last.
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as {code?: string})?.code !== "auth/user-not-found") throw error;
  }

  logger.info("deleteAccount", {uid, spotsChanged, files, usernames: names.size});
  return {success: true};
});
