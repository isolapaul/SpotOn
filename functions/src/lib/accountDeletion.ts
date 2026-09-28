/**
 * Pure planning for account deletion (A2). No Firebase imports.
 *
 * Agreed with Paul (2026-09-28):
 * - the user's own spots stay, anonymised: createdByName / createdByPhoto are removed; createdBy
 *   keeps the (then meaningless) uid, so the spotsCount triggers and rules stay consistent;
 *   photos on their own spots stay;
 * - their reviews on any spot are deleted;
 * - photos they added to other users' spots are deleted (from the spot and from Storage);
 * - their likes and highlights are removed everywhere.
 */
import {PLACEHOLDER_URL} from "./spotImages";

export type DocData = Record<string, unknown>;

interface ImageLike {
  url?: unknown;
  addedBy?: unknown;
  likes?: unknown;
  likedBy?: unknown;
}

export interface SpotCleanupPlan {
  /** Field updates for the spot, or null when nothing changes. */
  update: DocData | null;
  /** Remove createdByName / createdByPhoto (own spot). */
  anonymize: boolean;
  /** Storage paths of removed photos, to delete (only paths under spot-images/). */
  deletePaths: string[];
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function asRecord(x: unknown): Record<string, unknown> | undefined {
  return typeof x === "object" && x !== null && !Array.isArray(x) ?
    x as Record<string, unknown> : undefined;
}

/**
 * The cleanup of one spot for deleting `uid`. `pathOf` maps a download URL to its Storage object
 * path (or null for foreign / placeholder URLs).
 */
export function planSpotCleanup(
  spot: DocData,
  uid: string,
  pathOf: (url: string) => string | null,
): SpotCleanupPlan {
  const update: DocData = {};
  const own = spot.createdBy === uid;
  const ownPrefix = `spot-images/${uid}/`;

  // Reviews by the user: deleted everywhere.
  const reviews = asArray(spot.reviews);
  const keptReviews = reviews.filter((r) => asRecord(r)?.userId !== uid);
  if (keptReviews.length !== reviews.length) update.reviews = keptReviews;

  // Photos the user added to someone else's spot: by addedBy, or (legacy entries without
  // addedBy) by the per-user upload path.
  const isTheirs = (url: unknown, addedBy: unknown) =>
    addedBy === uid || (typeof url === "string" && (pathOf(url) ?? "").startsWith(ownPrefix));

  const imageUrls = asArray(spot.imageUrls).filter((u): u is string => typeof u === "string");
  const spotImages = asArray(spot.spotImages) as ImageLike[];
  let removedUrls: string[] = [];
  if (!own) {
    const byUrl = new Map(spotImages.map((img) => [img?.url, img]));
    removedUrls = imageUrls.filter((url) =>
      url !== PLACEHOLDER_URL && isTheirs(url, byUrl.get(url)?.addedBy));
  }

  // Likes by the user on the images that stay.
  let likesChanged = false;
  const keptImages = spotImages
    .filter((img) => !removedUrls.includes(img?.url as string))
    .map((img) => {
      const likedBy = asArray(img?.likedBy);
      if (!likedBy.includes(uid)) return img;
      likesChanged = true;
      const nextLikedBy = likedBy.filter((id) => id !== uid);
      const likes = Math.max(0, (Number(img.likes) || 0) - 1);
      return {...img, likedBy: nextLikedBy, likes};
    });

  if (removedUrls.length > 0) {
    let nextUrls = imageUrls.filter((url) => !removedUrls.includes(url));
    const oldPrimary = Number(spot.primaryImageIndex) || 0;
    const removedBefore = imageUrls.slice(0, oldPrimary)
      .filter((url) => removedUrls.includes(url)).length;
    let primary = Math.min(
      Math.max(0, oldPrimary - removedBefore),
      Math.max(0, nextUrls.length - 1),
    );
    if (nextUrls.length === 0) {
      nextUrls = [PLACEHOLDER_URL];
      primary = 0;
    }
    update.imageUrls = nextUrls;
    update.primaryImageIndex = primary;
  }
  if (removedUrls.length > 0 || likesChanged) {
    if (Array.isArray(spot.spotImages)) update.spotImages = keptImages;
  }

  // Highlights by the user.
  const highlighted = asArray(spot.highlighted);
  const keptHighlights = highlighted.filter((h) => asRecord(h)?.userId !== uid);
  if (keptHighlights.length !== highlighted.length) {
    update.highlighted = keptHighlights;
    update.isHighlighted = keptHighlights.length > 0;
  }

  const anonymize = own && (spot.createdByName !== undefined || spot.createdByPhoto !== undefined);
  const deletePaths = removedUrls
    .map((url) => pathOf(url))
    .filter((p): p is string => typeof p === "string" && p.startsWith("spot-images/"));

  return {update: Object.keys(update).length ? update : null, anonymize, deletePaths};
}

/**
 * Files under spot-images/{uid}/ to delete: everything the user's own (kept) spots do not show.
 * `keptPaths` are the Storage paths referenced by the user's own spots after cleanup.
 */
export function orphanedUploads(uploadPaths: string[], keptPaths: ReadonlySet<string>): string[] {
  return uploadPaths.filter((path) => !keptPaths.has(path));
}

/** Why a deletion is refused (HttpsError details.reason, translated by the client). */
export type DeletionRefusal = "is-admin" | "confirmation-mismatch" | "no-user";
