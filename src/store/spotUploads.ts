// Firebase steps of the background uploads (G4, moved out of useSpotStore's addSpot / addReview /
// addSpotImages). Every network step has a deadline (UPLOAD_TIMEOUT_MS) and is safe to retry:
// a timed-out write may still land, so a retry first accepts what the server already has.
import {
  arrayUnion,
  collection,
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase';
import { UPLOAD_TIMEOUT_MS } from '@/lib/constants';
import { PLACEHOLDER_URL, extForMime } from '@/lib/spotImages';
import { compressImage } from '@/lib/imageCompression';
import { MAX_SPOT_IMAGES_ERROR } from '@/lib/uploadErrors';
import { withTimeout } from '@/lib/withTimeout';
import { invalidatePublicProfile } from '@/store/publicProfiles';
import type { NewReview, Review, Spot, SpotImage } from '@/store/useSpotStore';

const addSpotImagesCallable = httpsCallable<{ spotId: string; urls: string[] }, { added?: number; pending?: number }>(
  functions,
  'addSpotImages',
  { timeout: UPLOAD_TIMEOUT_MS },
);

export interface UploadedImage {
  url: string;
  spotImage: SpotImage;
}

/** The user-entered fields of a new spot. */
export type NewSpotFields = Omit<Spot, 'id' | 'imageUrls' | 'createdAt' | 'status' | 'primaryImageIndex'>;

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

/**
 * Compresses and uploads one spot image to `spot-images/{uid}/{uuid}.{ext}` with an explicit
 * contentType. Output types the Storage rules do not accept (e.g. GIF) are re-encoded as JPEG.
 */
async function compressAndUpload(imageFile: File, userId: string): Promise<UploadedImage> {
  let blob = await compressImage(imageFile, 'spot');
  if (!extForMime(blob.type)) {
    blob = await compressImage(imageFile, 'spot', 'image/jpeg');
  }
  const ext = extForMime(blob.type) ?? 'jpg';
  const imageRef = ref(storage, `spot-images/${userId}/${crypto.randomUUID()}.${ext}`);
  await uploadBytes(imageRef, blob, { contentType: blob.type });
  const url = await getDownloadURL(imageRef);
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    url,
    spotImage: {
      id: `${timestamp}_${random}`,
      url,
      addedBy: userId,
      addedAt: Timestamp.now(),
      likes: 0,
      likedBy: [],
    },
  };
}

/**
 * Uploads the photos in parallel, each with its own deadline. `done` keeps each finished file's
 * result across retries, so a Retry uploads only the files that failed (no new orphans for the rest).
 */
export async function uploadSpotImages(
  files: File[],
  userId: string,
  done: Array<UploadedImage | undefined> = [],
): Promise<UploadedImage[]> {
  await Promise.all(files.map(async (file, i) => {
    done[i] ??= await withTimeout(compressAndUpload(file, userId), UPLOAD_TIMEOUT_MS);
  }));
  return done as UploadedImage[];
}

/** A new spot id, chosen on the client so a retried create targets the same document. */
export function newSpotId(): string {
  return doc(collection(db, 'spots')).id;
}

/** The spot as the server has it (never the local cache, which also holds unsent writes). */
async function serverSpot(spotId: string): Promise<Record<string, unknown> | undefined> {
  const snap = await withTimeout(getDocFromServer(doc(db, 'spots', spotId)), UPLOAD_TIMEOUT_MS);
  return snap.exists() ? snap.data() : undefined;
}

/**
 * Creates spots/{spotId} (exactly the keys the T12 create rule allows). Without photos the spot
 * gets the placeholder image. A failed or timed-out write counts as done when the server already
 * has this user's spot under that id (an earlier attempt landed). On a retry (`isRetry`) the server
 * is checked first: an admin's second setDoc would be an allowed update that resets the spot.
 */
export async function createSpot(
  spotId: string,
  fields: NewSpotFields,
  uploaded: UploadedImage[],
  primaryIndex: number,
  userId: string,
  isAdmin: boolean,
  isRetry = false,
): Promise<void> {
  if (isRetry && (await serverSpot(spotId))?.createdBy === userId) {
    invalidatePublicProfile(userId);
    return;
  }
  const images: UploadedImage[] = uploaded.length > 0
    ? uploaded
    : [{
        url: PLACEHOLDER_URL,
        spotImage: {
          id: `${Date.now()}_placeholder`,
          url: PLACEHOLDER_URL,
          addedBy: userId,
          addedAt: Timestamp.now(),
          likes: 0,
          likedBy: [],
        },
      }];
  const imageUrls = images.map((u) => u.url);
  try {
    await withTimeout(
      setDoc(doc(db, 'spots', spotId), {
        name: fields.name,
        category: fields.category,
        description: fields.description,
        location: { lat: fields.location.lat, lng: fields.location.lng },
        createdBy: userId,
        createdByName: fields.createdByName,
        createdByPhoto: fields.createdByPhoto,
        imageUrls,
        spotImages: images.map((u) => u.spotImage),
        primaryImageIndex: imageUrls.length > 0 ? primaryIndex : 0,
        status: isAdmin ? 'approved' : 'pending',
        createdAt: serverTimestamp(),
      }),
      UPLOAD_TIMEOUT_MS,
    );
  } catch (error) {
    const existing = await serverSpot(spotId).catch(() => undefined);
    if (existing?.createdBy !== userId) throw error;
  }
  // The server bumps spotsCount; drop the cached profile so the next read sees it (T26).
  invalidatePublicProfile(userId);
}

/**
 * Appends uploaded photo URLs to a spot through the addSpotImages callable. The server rejects
 * URLs it already has ("Image already added"): after a timeout that still landed, that counts as done.
 * Returns how many photos wait for an admin (item 4: other users' photos, and the owner's on an
 * approved spot, are reviewed first).
 */
export async function attachSpotImages(spotId: string, urls: string[]): Promise<number> {
  try {
    const { data } = await addSpotImagesCallable({ spotId, urls });
    return typeof data?.pending === 'number' ? data.pending : 0;
  } catch (error) {
    if (errorCode(error) === 'functions/resource-exhausted') throw new Error(MAX_SPOT_IMAGES_ERROR);
    if (errorCode(error) === 'functions/invalid-argument') {
      const existing = await serverSpot(spotId).catch(() => undefined);
      const stored = Array.isArray(existing?.imageUrls) ? (existing.imageUrls as unknown[]) : [];
      // The callable adds all URLs or none: any one of them on the spot means this batch landed
      // (one may have been deleted since).
      if (urls.some((url) => stored.includes(url))) return 0;
    }
    throw error;
  }
}

/** The review as stored: `id` and `createdAt` fixed once, so a retry appends the same object. */
export function buildReview(review: NewReview): Review {
  const full: Review = { ...review, id: `${review.userId}_${Date.now()}`, createdAt: Timestamp.now() };
  return Object.fromEntries(Object.entries(full).filter(([, v]) => v !== undefined)) as unknown as Review;
}

/**
 * Appends the review (the spots listener delivers it, BUG-25). A retry of a write that already
 * landed is denied by the append-only rule; the review being on the server then counts as done.
 */
export async function appendReview(spotId: string, review: Review): Promise<void> {
  try {
    await withTimeout(updateDoc(doc(db, 'spots', spotId), { reviews: arrayUnion(review) }), UPLOAD_TIMEOUT_MS);
  } catch (error) {
    const existing = await serverSpot(spotId).catch(() => undefined);
    const reviews = Array.isArray(existing?.reviews) ? (existing.reviews as Array<{ id?: unknown }>) : [];
    if (!reviews.some((r) => r?.id === review.id)) throw error;
  }
}
