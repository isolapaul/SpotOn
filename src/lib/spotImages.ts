// Pure helpers for spot images (T11b). No Firebase/React imports: types only.
import type { Spot, SpotImage } from '@/store/useSpotStore';

/** Placeholder image stored on spots created without photos. */
export const PLACEHOLDER_URL = '/placeholder-spot.jpg';

/** Maximum number of images per spot (D12). */
export const MAX_SPOT_IMAGES = 20;

/** A spot image for display: legacy (materialised) entries have no `addedAt`. */
export type DisplaySpotImage = Omit<SpotImage, 'addedAt'> & { addedAt?: SpotImage['addedAt'] };

type ImageFields = Pick<Spot, 'id' | 'imageUrls' | 'spotImages'>;

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
