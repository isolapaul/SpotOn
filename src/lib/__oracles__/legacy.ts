/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim copies of the pre-T23 code */
// T23 characterisation oracles: the pre-T23 implementations, copied verbatim from the call sites
// (only wrapped in functions and given parameter types). Imported by tests only; excluded from
// coverage. Do not "fix" anything here: these pin today's behaviour, quirks included.
import type { Review, SpotImage } from '@/store/useSpotStore';

type OracleSpot = {
  imageUrls?: string[];
  primaryImageIndex?: number;
  spotImages?: SpotImage[];
  reviews?: Review[];
  imageUrl?: unknown;
};

// ---------------------------------------------------------------------------------------------
// Haversine (DUP-01): DiscoveryPanel.tsx `calculateDistance`. page.tsx's copy was removed in T03.
// ---------------------------------------------------------------------------------------------
export function discoveryCalculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------------------------
// Average rating (DUP-07). useSpotStore.addReview no longer computes one (T11b/T21).
// ---------------------------------------------------------------------------------------------
/** ProfilePanel favourites `avgRating` and SpotInfoWindow `averageRating` (same expression). */
export function profileAvgRating(spot: OracleSpot): number {
  const avgRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;
  return avgRating;
}

export function infoWindowAverageRating(spot: OracleSpot): number {
  const averageRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;
  return averageRating;
}

/** SpotDetailsPanel `averageRating`. */
export function detailsAverageRating(spot: OracleSpot): number {
  const averageRating = spot.reviews?.length
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;
  return averageRating;
}

/** DiscoveryPanel `getAverageRating`. */
export function discoveryGetAverageRating(spot: OracleSpot): number {
  if (!spot.reviews || spot.reviews.length === 0) return 0;
  return spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length;
}

// ---------------------------------------------------------------------------------------------
// Image URL expressions (DUP-06)
// ---------------------------------------------------------------------------------------------
/** Thumbnail: ProfilePanel (×4) and DiscoveryPanel. */
export function thumbnailSrc(spot: OracleSpot): unknown {
  return (spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || (spot as any).imageUrl) || '/placeholder-spot.jpg';
}

/** `unoptimized` prop: ProfilePanel (×4), DiscoveryPanel, SpotDetailsPanel hero, SpotInfoWindow. */
export function unoptimizedProp(spot: OracleSpot): boolean {
  return !spot.imageUrls && !(spot as any).imageUrl;
}

/** SpotDetailsPanel `sortedSpotImages` (input: getSpotImages(fresh), or [] without a spot). PLACEHOLDER_URL inlined. */
export function detailsSortedSpotImages<T extends { url: string; likes: number; addedAt?: any }>(images: T[]): T[] {
  return images
    .filter((image) => image.url !== '/placeholder-spot.jpg')
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0);
    });
}

/** SpotDetailsPanel `allGalleryImages` for a present `fresh` spot. PLACEHOLDER_URL inlined. */
export function detailsAllGalleryImages(fresh: OracleSpot, sortedSpotImages: { url: string }[]): string[] {
  return [
    ...sortedSpotImages.map((img) => img.url),
    ...(fresh.imageUrls || []).filter((url) => !sortedSpotImages.some((img) => img.url === url)),
  ].filter((url, i, self) => url !== '/placeholder-spot.jpg' && self.indexOf(url) === i);
}

/** SpotDetailsPanel `heroImageUrl`. */
export function detailsHeroImageUrl(spot: OracleSpot, sortedSpotImages: { url: string }[]): string {
  const heroImageUrl =
    spot.imageUrls?.[spot.primaryImageIndex || 0] ||
    spot.imageUrls?.[0] ||
    sortedSpotImages[0]?.url ||
    '/placeholder-spot.jpg';
  return heroImageUrl;
}

/** SpotInfoWindow `sortedSpotImages` (spotImages only; no legacy materialisation). */
export function infoWindowSortedSpotImages(spot: OracleSpot): SpotImage[] {
  const sortedSpotImages = (spot.spotImages || [])
    .filter((image) => image.url !== '/placeholder-spot.jpg')
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return a.addedAt?.toMillis?.() && b.addedAt?.toMillis?.()
        ? b.addedAt.toMillis() - a.addedAt.toMillis()
        : 0;
    });
  return sortedSpotImages;
}

/** SpotInfoWindow `previewImageUrl`. */
export function infoWindowPreviewImageUrl(spot: OracleSpot, sortedSpotImages: { url: string }[]): unknown {
  const previewImageUrl =
    sortedSpotImages[0]?.url ||
    spot.imageUrls?.[spot.primaryImageIndex || 0] ||
    spot.imageUrls?.[0] ||
    (spot as any).imageUrl ||
    '/placeholder-spot.jpg';
  return previewImageUrl;
}

// ---------------------------------------------------------------------------------------------
// Image compression options per call site (DUP-11), as they are after T14/T15.
// ---------------------------------------------------------------------------------------------
/** useSpotStore `IMAGE_COMPRESSION_OPTIONS` (retried with `fileType: 'image/jpeg'` for GIF etc.). */
export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1280,
  useWebWorker: false,
};

/** useUserStore `compressProfileImage` options (same JPEG retry). */
export const compressProfileImageOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: false,
};

/** SettingsPanel profile picture (before the store's second pass). */
export const settingsProfilePictureOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 800,
  useWebWorker: false,
};

/** SettingsPanel banner (before the store's second pass). */
export const settingsBannerOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: false,
};

/** FeedbackPanel attachment options (T14 set useWebWorker: false). */
export const feedbackOptions = { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: false };
