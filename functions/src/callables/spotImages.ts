/**
 * Spot image callables (T10): toggleImageLike and addSpotImages. Both rewrite the spot's image
 * arrays inside a transaction, so concurrent users cannot lose or forge each other's data.
 * addSpotImages adds directly only for admins and for the owner of a spot under review; other
 * photos become photoSubmissions that an admin approves (item 4, callables/moderation.ts).
 * Legacy spots (only imageUrls) are materialised to spotImages only by these user actions,
 * never on read. A non-approved spot answers like a missing one unless the caller is its creator
 * or an admin (T30). Logs only {uid, spotId, outcome}.
 */
import {DocumentSnapshot, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAdminRole} from "../lib/admin";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";
import {notifyAdminsToReview} from "../lib/inbox";
import {checkRate} from "../lib/rateLimit";
import {
  currentImages,
  imageAccess,
  isOwnSpotImagePath,
  MAX_SPOT_IMAGES,
  parseStorageDownloadUrl,
  photosAddDirectly,
  planAddImages,
  SpotAccessFields,
  SpotImageFields,
  toggleLikeInImages,
  uniqueIdFactory,
} from "../lib/spotImages";

/** Longest image id accepted from callers (image ids are array keys, never paths). */
const MAX_IMAGE_ID_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
/** Photos one user may have waiting for approval on one spot. */
export const MAX_PENDING_PER_UPLOADER = 5;

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  return uid;
}

function isImageId(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && x.length <= MAX_IMAGE_ID_LENGTH;
}

/**
 * The spot's data if the caller may change its images, else the "Spot not found" error a missing
 * id gets: a non-approved spot is only for its creator and admins (T30), and the error must not
 * reveal that a pending id exists. The admin lookup runs only for someone else's non-approved spot.
 */
async function readableSpot(
  snap: DocumentSnapshot,
  uid: string,
): Promise<SpotImageFields & SpotAccessFields & {name?: unknown}> {
  type ReadableSpot = SpotImageFields & SpotAccessFields & {name?: unknown};
  const spot = snap.exists ? snap.data() as ReadableSpot : undefined;
  if (!spot || (imageAccess(spot, uid) === "admin" && (await getAdminRole(uid)) === null)) {
    throw new HttpsError("not-found", "Spot not found");
  }
  return spot;
}

function outcomeOf(error: unknown): string {
  return error instanceof HttpsError ? error.code : "error";
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export const toggleImageLike = onCall(async (request) => {
  const uid = requireUid(request);
  let spotId: string | null = null;
  try {
    const rawSpotId: unknown = request.data?.spotId;
    const imageId: unknown = request.data?.imageId;
    if (!isValidSpotId(rawSpotId) || !isImageId(imageId)) {
      throw new HttpsError("invalid-argument", "Invalid spotId or imageId");
    }
    spotId = rawSpotId;
    const spotRef = db.collection("spots").doc(rawSpotId);

    const result = await db.runTransaction(async (tx) => {
      const spot = await readableSpot(await tx.get(spotRef), uid);
      // Each like rewrites the spot (every viewer re-reads it): rate limited like spot likes.
      const count = await checkRate(tx, uid, "like");
      const images = currentImages(spot, rawSpotId, Timestamp.now());
      let toggled;
      try {
        toggled = toggleLikeInImages(images, imageId, uid);
      } catch (error) {
        if (errorMessage(error) === "IMAGE_NOT_FOUND") {
          throw new HttpsError("not-found", "Image not found");
        }
        throw error;
      }
      count();
      tx.update(spotRef, {spotImages: toggled.images});
      return {liked: toggled.liked, likes: toggled.likes};
    });

    logger.info("toggleImageLike", {uid, spotId, outcome: result.liked ? "liked" : "unliked"});
    return result;
  } catch (error) {
    logger.info("toggleImageLike", {uid, spotId, outcome: outcomeOf(error)});
    throw error;
  }
});

export const addSpotImages = onCall(async (request) => {
  const uid = requireUid(request);
  let spotId: string | null = null;
  try {
    const rawSpotId: unknown = request.data?.spotId;
    const rawUrls: unknown = request.data?.urls;
    if (!isValidSpotId(rawSpotId)) {
      throw new HttpsError("invalid-argument", "Invalid spotId");
    }
    spotId = rawSpotId;
    if (!Array.isArray(rawUrls) || rawUrls.length < 1 || rawUrls.length > MAX_SPOT_IMAGES ||
        !rawUrls.every((u) => typeof u === "string" && u.length <= MAX_URL_LENGTH) ||
        new Set(rawUrls).size !== rawUrls.length) {
      throw new HttpsError("invalid-argument", "urls must be 1-20 distinct image URLs");
    }
    const urls = rawUrls as string[];

    const bucket: string = JSON.parse(process.env.FIREBASE_CONFIG!).storageBucket;
    const emulatorHost = process.env.FUNCTIONS_EMULATOR === "true" ?
      process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined;

    const paths = urls.map((url) => {
      const parsed = parseStorageDownloadUrl(url, {bucket, emulatorHost});
      if (!parsed || !isOwnSpotImagePath(parsed.path, uid)) {
        throw new HttpsError("permission-denied", "Invalid image URL");
      }
      return parsed.path;
    });

    const exists = await Promise.all(
      paths.map(async (path) => (await getStorage().bucket().file(path).exists())[0]),
    );
    if (exists.some((e) => !e)) {
      throw new HttpsError("failed-precondition", "Image not uploaded");
    }

    const spotRef = db.collection("spots").doc(rawSpotId);
    const callerIsAdmin = (await getAdminRole(uid)) !== null;
    const result = await db.runTransaction(async (tx) => {
      const spot = await readableSpot(await tx.get(spotRef), uid);
      const existingUrls = Array.isArray(spot.imageUrls) ? spot.imageUrls : [];
      if (urls.some((url) => existingUrls.includes(url))) {
        throw new HttpsError("invalid-argument", "Image already added");
      }
      const now = Timestamp.now();
      const used = new Set(currentImages(spot, rawSpotId, now).map((image) => image?.id));
      // Item 4: admins, and owners of a spot still under review, add photos at once; everyone
      // else's photos wait for an admin (photoSubmissions). Only the caller's own waiting photos
      // count here (at most MAX_PENDING_PER_UPLOADER per spot), so nobody can fill a spot's limit
      // for others; the hard limit is checked again on approval.
      const direct = photosAddDirectly(spot, uid, callerIsAdmin);
      const waiting = direct ? [] : (await tx.get(db.collection("photoSubmissions")
        .where("spotId", "==", rawSpotId).where("uploader", "==", uid)))
        .docs.map((doc) => doc.get("url") as string);
      // The submissions are created all or none: one of them waiting means a retry of a call
      // that landed (after a client timeout), which counts as done.
      if (urls.some((url) => waiting.includes(url))) {
        return {direct: false, retry: true, spotName: "", owner: ""};
      }
      if (waiting.length + urls.length > MAX_PENDING_PER_UPLOADER && !direct) {
        throw new HttpsError("resource-exhausted", "MAX_PENDING_PHOTOS");
      }
      // Each submission pings the admins: at most RATE_LIMITS.photo calls an hour per user.
      const countSubmission = direct ? null : await checkRate(tx, uid, "photo");
      let plan;
      try {
        const ids = uniqueIdFactory(used);
        plan = planAddImages(spot, rawSpotId, [...waiting, ...urls], uid, now, ids);
      } catch (error) {
        if (errorMessage(error) === "MAX_SPOT_IMAGES") {
          throw new HttpsError("resource-exhausted", "MAX_SPOT_IMAGES");
        }
        throw error;
      }
      if (direct) {
        // updatedAt: the version approveSpot checks (a photo added while under review).
        tx.update(spotRef, {...plan, updatedAt: now});
        return {
          direct: true, retry: false, spotName: String(spot.name ?? ""), owner: String(spot.createdBy ?? ""),
        };
      }
      countSubmission?.();
      for (const url of urls) {
        tx.create(db.collection("photoSubmissions").doc(), {
          spotId: rawSpotId,
          spotName: String(spot.name ?? ""),
          uploader: uid,
          url,
          status: "pending",
          createdAt: now,
        });
      }
      return {
        direct: false, retry: false, spotName: String(spot.name ?? ""), owner: String(spot.createdBy ?? ""),
      };
    });

    if (!result.direct && !result.retry) {
      await notifyAdminsToReview("photoSubmitted", "photoSubmittedBody", [result.spotName],
        {type: "photo_submitted", spotId: rawSpotId});
    }
    const outcome = result.retry ? "already-waiting" : result.direct ? "added" : "submitted";
    logger.info("addSpotImages", {uid, spotId, outcome});
    return result.direct ? {added: urls.length, pending: 0} : {added: 0, pending: urls.length};
  } catch (error) {
    logger.info("addSpotImages", {uid, spotId, outcome: outcomeOf(error)});
    throw error;
  }
});
