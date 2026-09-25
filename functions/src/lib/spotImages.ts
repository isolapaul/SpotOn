/**
 * Pure helpers for spot image lists (T10): legacy materialisation, adding images, likes and
 * Storage download URL validation. No Firebase imports: the timestamp type is generic and the
 * value is injected by the caller (`now: T`).
 *
 * Stored shapes (must not change):
 * - spots.imageUrls: string[]
 * - spots.spotImages[]: {id, url, addedBy?, addedAt: Timestamp, likes: number, likedBy: string[]}
 * - spots.primaryImageIndex: number
 * Legacy image ids are `${spotId}_${index}`; new ids are `${ms}_${0..9999}`.
 */

/** Placeholder image stored on spots created without photos. */
export const PLACEHOLDER_URL = "/placeholder-spot.jpg";

/** Maximum number of images per spot (D12). */
export const MAX_SPOT_IMAGES = 20;

export interface SpotImage<T> {
  id: string;
  url: string;
  addedBy?: string;
  addedAt: T;
  likes: number;
  likedBy: string[];
}

/** The image-related fields of a spots/{id} document. */
export interface SpotImageFields {
  imageUrls?: unknown;
  spotImages?: unknown;
}

export interface AddImagesPlan<T> {
  imageUrls: string[];
  spotImages: SpotImage<T>[];
  primaryImageIndex?: number;
}

function stringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Legacy spot (only imageUrls) → spotImages. Byte-for-byte the shape of the client's
 * migrateSpotImages: no `addedBy`, and a placeholder url is included if present.
 */
export function materializeSpotImages<T>(
  spotId: string,
  imageUrls: string[],
  now: T,
): SpotImage<T>[] {
  return imageUrls.map((url, index) => ({
    id: `${spotId}_${index}`,
    url,
    addedAt: now,
    likes: 0,
    likedBy: [],
  }));
}

/** spotImages if non-empty, else the materialised legacy imageUrls (never written on read). */
export function currentImages<T>(
  spot: SpotImageFields,
  spotId: string,
  now: T,
): SpotImage<T>[] {
  if (Array.isArray(spot.spotImages) && spot.spotImages.length) {
    return spot.spotImages as SpotImage<T>[];
  }
  return materializeSpotImages(spotId, stringArray(spot.imageUrls), now);
}

/**
 * Plan for appending `urls` to a spot (same algorithm as the client's addSpotImages).
 * Throws Error("MAX_SPOT_IMAGES") when the spot would exceed MAX_SPOT_IMAGES.
 */
export function planAddImages<T>(
  spot: SpotImageFields,
  spotId: string,
  urls: string[],
  uid: string,
  now: T,
  idFactory: () => string,
): AddImagesPlan<T> {
  const existingUrls = stringArray(spot.imageUrls);
  const baseUrls =
    existingUrls.length === 1 && existingUrls[0] === PLACEHOLDER_URL ? [] : existingUrls;
  const baseSpotImages = currentImages(spot, spotId, now)
    .filter((image) => image?.url !== PLACEHOLDER_URL);

  if (baseUrls.length + urls.length > MAX_SPOT_IMAGES) {
    throw new Error("MAX_SPOT_IMAGES");
  }

  const newEntries: SpotImage<T>[] = urls.map((url) => ({
    id: idFactory(),
    url,
    addedBy: uid,
    addedAt: now,
    likes: 0,
    likedBy: [],
  }));

  const plan: AddImagesPlan<T> = {
    imageUrls: [...baseUrls, ...urls],
    spotImages: [...baseSpotImages, ...newEntries],
  };
  if (!baseUrls.length) plan.primaryImageIndex = 0;
  return plan;
}

/**
 * Toggles uid's like on the image `imageId`. Throws Error("IMAGE_NOT_FOUND") when no image has
 * that id. likes never drops below 0; uid is never duplicated in likedBy.
 */
export function toggleLikeInImages<T>(
  images: SpotImage<T>[],
  imageId: string,
  uid: string,
): {images: SpotImage<T>[]; liked: boolean; likes: number} {
  const index = images.findIndex((image) => image?.id === imageId);
  if (index < 0) throw new Error("IMAGE_NOT_FOUND");

  const image = images[index];
  const likedBy = stringArray(image.likedBy);
  const currentLikes = typeof image.likes === "number" ? image.likes : 0;
  const alreadyLiked = likedBy.includes(uid);
  const likes = Math.max(0, currentLikes + (alreadyLiked ? -1 : 1));
  const updated: SpotImage<T> = {
    ...image,
    likes,
    likedBy: alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid],
  };

  const next = [...images];
  next[index] = updated;
  return {images: next, liked: !alreadyLiked, likes};
}

const PROD_STORAGE_HOST = "firebasestorage.googleapis.com";
const DOWNLOAD_PATH_RE = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/;

/**
 * Parses a Firebase Storage download URL of `bucket`. Returns the decoded object path, or null.
 * Accepts https://firebasestorage.googleapis.com, or http://<emulatorHost> when emulatorHost is
 * set. Rejects userinfo (user:pass@). Requires alt=media and a non-empty token.
 */
export function parseStorageDownloadUrl(
  url: string,
  {bucket, emulatorHost}: {bucket: string; emulatorHost?: string},
): {path: string} | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isProd = parsed.protocol === "https:" && parsed.host === PROD_STORAGE_HOST;
  const isEmulator = !!emulatorHost && parsed.protocol === "http:" &&
    parsed.host === emulatorHost;
  if (!isProd && !isEmulator) return null;
  if (parsed.username || parsed.password) return null;

  const match = DOWNLOAD_PATH_RE.exec(parsed.pathname);
  if (!match || match[1] !== bucket) return null;

  let path: string;
  try {
    path = decodeURIComponent(match[2]);
  } catch {
    return null;
  }

  if (parsed.searchParams.get("alt") !== "media" || !parsed.searchParams.get("token")) {
    return null;
  }
  return {path};
}

const OWN_IMAGE_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** True for `spot-images/{uid}/{uuid}.{jpg|png|webp}` (the T11b upload path). */
export function isOwnSpotImagePath(path: string, uid: string): boolean {
  const prefix = `spot-images/${uid}/`;
  return path.startsWith(prefix) && OWN_IMAGE_NAME_RE.test(path.slice(prefix.length));
}
