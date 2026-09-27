/**
 * Spot image callables (T10): toggleImageLike and addSpotImages. Both rewrite the spot's image
 * arrays inside a transaction, so concurrent users cannot lose or forge each other's data.
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
import {
  currentImages,
  imageAccess,
  isOwnSpotImagePath,
  MAX_SPOT_IMAGES,
  parseStorageDownloadUrl,
  planAddImages,
  SpotAccessFields,
  SpotImageFields,
  toggleLikeInImages,
} from "../lib/spotImages";

/** Longest image id accepted from callers (image ids are array keys, never paths). */
const MAX_IMAGE_ID_LENGTH = 200;
const MAX_URL_LENGTH = 2048;

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
): Promise<SpotImageFields & SpotAccessFields> {
  const spot = snap.exists ? snap.data() as SpotImageFields & SpotAccessFields : undefined;
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

/**
 * Same id format as the client (`${ms}_${0..9999}`); within one call, the random part is re-rolled
 * until the id is not used by an existing image or an earlier id of this call.
 */
function uniqueIdFactory(used: Set<string>): () => string {
  return () => {
    let id: string;
    do {
      id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
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
    await db.runTransaction(async (tx) => {
      const spot = await readableSpot(await tx.get(spotRef), uid);
      const existingUrls = Array.isArray(spot.imageUrls) ? spot.imageUrls : [];
      if (urls.some((url) => existingUrls.includes(url))) {
        throw new HttpsError("invalid-argument", "Image already added");
      }

      const now = Timestamp.now();
      const used = new Set(currentImages(spot, rawSpotId, now).map((image) => image?.id));
      let plan;
      try {
        plan = planAddImages(spot, rawSpotId, urls, uid, now, uniqueIdFactory(used));
      } catch (error) {
        if (errorMessage(error) === "MAX_SPOT_IMAGES") {
          throw new HttpsError("resource-exhausted", "MAX_SPOT_IMAGES");
        }
        throw error;
      }
      tx.update(spotRef, {...plan});
    });

    logger.info("addSpotImages", {uid, spotId, outcome: "added"});
    return {added: urls.length};
  } catch (error) {
    logger.info("addSpotImages", {uid, spotId, outcome: outcomeOf(error)});
    throw error;
  }
});
