// Pure helpers for spot images (T11b). No Firebase/React imports: types only.
import type { Spot, SpotImage } from '@/store/useSpotStore';

/** Placeholder image stored on spots created without photos. */
export const PLACEHOLDER_URL = '/placeholder-spot.jpg';

/** Maximum number of images per spot (D12). */
export const MAX_SPOT_IMAGES = 20;

/** A spot image for display: legacy (materialised) entries have no `addedAt`. */
export type DisplaySpotImage = Omit<SpotImage, 'addedAt'> & { addedAt?: SpotImage['addedAt'] };

// imageUrls is optional: legacy documents may lack it (getSpotImages treats it as []).
type ImageFields = Pick<Spot, 'id' | 'spotImages'> & { imageUrls?: string[] };

/**
 * Image fields read by the URL helpers. `imageUrls` is optional because legacy documents may lack
 * it; `imageUrl` is the legacy singular field some old spots still carry (not on `Spot`).
 */
export type SpotImageUrlFields = {
  imageUrls?: string[];
  primaryImageIndex?: number;
  imageUrl?: string;
};

/** Minimal image shape the like-sort needs (addedAt is a Firestore Timestamp, or missing/null). */
export type SortableSpotImage = {
  url: string;
  likes: number;
  addedAt?: { toMillis?: () => number } | null;
};

/**
 * Tie-break for images with equal likes (both kept on purpose, see T23):
 * - 'missingAsZero' (details panel/gallery): newer first; a missing timestamp counts as 0 (oldest).
 * - 'bothRequired' (map info window): newer first only if both have a truthy timestamp, else equal.
 *   Not transitive for mixed inputs, so the result depends on the input order.
 */
export type ImageTieBreak = 'missingAsZero' | 'bothRequired';

/**
 * spotImages if non-empty, else the legacy imageUrls materialised in memory (never written).
 * Legacy ids are `${spotId}_${index}`, the same as the server's materialisation (T10).
 */
export function getSpotImages(spot: ImageFields): DisplaySpotImage[] {
  return spot.spotImages?.length
    ? spot.spotImages
    : (spot.imageUrls ?? []).map((url, index) => ({ id: `${spot.id}_${index}`, url, likes: 0, likedBy: [] }));
}

/** Number of real images: a spot whose imageUrls is exactly [placeholder] has none. */
export function realImageCount(spot: Pick<Spot, 'imageUrls'>): number {
  const urls = spot.imageUrls;
  if (urls?.length === 1 && urls[0] === PLACEHOLDER_URL) return 0;
  return urls?.length ?? 0;
}

/** File extension for an upload content type accepted by the Storage rules, else null. */
export function extForMime(mime: string): 'jpg' | 'png' | 'webp' | null {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

/** The legacy singular `imageUrl` field, read without `any`. */
export function getLegacyImageUrl(spot: Pick<SpotImageUrlFields, 'imageUrl'>): string | undefined {
  return spot.imageUrl;
}

/** Card/list thumbnail: primary imageUrls entry, first entry, legacy imageUrl, placeholder. */
export function getThumbnailUrl(spot: SpotImageUrlFields): string {
  return (spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || getLegacyImageUrl(spot)) || PLACEHOLDER_URL;
}

/**
 * Details hero: primary imageUrls entry, first entry, most-liked image, placeholder. No legacy
 * imageUrl fallback (unlike the thumbnail and preview).
 */
export function getHeroImageUrl(spot: SpotImageUrlFields, sorted: ReadonlyArray<{ url: string }>): string {
  return (
    spot.imageUrls?.[spot.primaryImageIndex || 0] ||
    spot.imageUrls?.[0] ||
    sorted[0]?.url ||
    PLACEHOLDER_URL
  );
}

/** Map info-window preview: the most-liked image first, then as the thumbnail. */
export function getPreviewImageUrl(spot: SpotImageUrlFields, sorted: ReadonlyArray<{ url: string }>): string {
  return (
    sorted[0]?.url ||
    spot.imageUrls?.[spot.primaryImageIndex || 0] ||
    spot.imageUrls?.[0] ||
    getLegacyImageUrl(spot) ||
    PLACEHOLDER_URL
  );
}

/** next/image `unoptimized` flag: set when the spot has neither imageUrls nor a legacy imageUrl. */
export function isImageUnoptimized(spot: SpotImageUrlFields): boolean {
  return !spot.imageUrls && !getLegacyImageUrl(spot);
}

/**
 * Real images (placeholder entries dropped) sorted by likes, most first, then by `tieBreak`.
 * Returns a new array; the input is never mutated. The sort is stable.
 */
export function sortSpotImagesByLikes<T extends SortableSpotImage>(images: ReadonlyArray<T>, tieBreak: ImageTieBreak): T[] {
  const compareTime =
    tieBreak === 'missingAsZero'
      ? (a: T, b: T) => (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0)
      : (a: T, b: T) => {
          const aMillis = a.addedAt?.toMillis?.();
          const bMillis = b.addedAt?.toMillis?.();
          return aMillis && bMillis ? bMillis - aMillis : 0;
        };
  // filter() returns a fresh array, so sorting it never mutates the input.
  return images
    .filter((image) => image.url !== PLACEHOLDER_URL)
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return compareTime(a, b);
    });
}

/**
 * Gallery order: liked-sorted image urls ('missingAsZero'), then imageUrls not already included;
 * placeholder and duplicate urls removed. `sorted` defaults to the spot's own sorted images.
 */
export function getGalleryUrls(
  spot: ImageFields,
  sorted: ReadonlyArray<{ url: string }> = sortSpotImagesByLikes(getSpotImages(spot), 'missingAsZero'),
): string[] {
  return [
    ...sorted.map((img) => img.url),
    ...(spot.imageUrls || []).filter((url) => !sorted.some((img) => img.url === url)),
  ].filter((url, i, self) => url !== PLACEHOLDER_URL && self.indexOf(url) === i);
}
