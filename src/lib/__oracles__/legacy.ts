/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim copies of the pre-T23 code */
// T23 characterisation oracles: the pre-T23 implementations, copied verbatim from the call sites
// (only wrapped in functions and given parameter types). Imported by tests only; excluded from
// coverage. Do not "fix" anything here: these pin today's behaviour, quirks included.
import type { Review, SpotCategory, SpotImage } from '@/store/useSpotStore';
import type { TranslationKey } from '@/lib/translations';

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
// Categories (DUP-05)
// ---------------------------------------------------------------------------------------------
/** spotUtils.ts `categoryEmojis`. */
export const categoryEmojis: Record<SpotCategory, string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
  hiking: '🥾',
  random: '🎲',
  'date-spot': '❤️',
  park: '🌳',
  part: '🏖️',
};

/** spotUtils.ts `categoryTranslationKeys`. */
export const categoryTranslationKeys: Record<SpotCategory, TranslationKey> = {
  scenic: 'categoryScenic',
  'smoke-spot': 'categorySmoke',
  viewpoint: 'categoryViewpoint',
  other: 'categoryOther',
  hiking: 'categoryHiking',
  random: 'categoryRandom',
  'date-spot': 'categoryDateSpot',
  park: 'categoryPark',
  part: 'categoryPart',
};

/**
 * AddSpotModal `<option>` list: value, emoji prefix and label key, in render order
 * (`<option value="scenic" className="bg-gray-800">🌅 {t('categoryScenic')}</option>` …).
 */
export const addSpotOptions: { value: SpotCategory; emoji: string; labelKey: TranslationKey }[] = [
  { value: 'scenic', emoji: '🌅', labelKey: 'categoryScenic' },
  { value: 'smoke-spot', emoji: '💨', labelKey: 'categorySmoke' },
  { value: 'viewpoint', emoji: '🏔️', labelKey: 'categoryViewpoint' },
  { value: 'hiking', emoji: '🥾', labelKey: 'categoryHiking' },
  { value: 'random', emoji: '🎲', labelKey: 'categoryRandom' },
  { value: 'date-spot', emoji: '❤️', labelKey: 'categoryDateSpot' },
  { value: 'park', emoji: '🌳', labelKey: 'categoryPark' },
  { value: 'part', emoji: '🏖️', labelKey: 'categoryPart' },
  { value: 'other', emoji: '📍', labelKey: 'categoryOther' },
];

/** DiscoveryPanel `categories` (verbatim, with `t` injected). */
export function discoveryCategories(t: (key: TranslationKey) => string): { value: SpotCategory; label: string; emoji: string }[] {
  const categories: { value: SpotCategory; label: string; emoji: string }[] = [
    { value: 'scenic', label: t('categoryScenic'), emoji: '🌅' },
    { value: 'smoke-spot', label: t('categorySmoke'), emoji: '💨' },
    { value: 'viewpoint', label: t('categoryViewpoint'), emoji: '🏔️' },
    { value: 'hiking', label: t('categoryHiking'), emoji: '🥾' },
    { value: 'random', label: t('categoryRandom'), emoji: '🎲' },
    { value: 'date-spot', label: t('categoryDateSpot'), emoji: '❤️' },
    { value: 'park', label: t('categoryPark'), emoji: '🌳' },
    { value: 'part', label: t('categoryPart'), emoji: '🏖️' },
    { value: 'other', label: t('categoryOther'), emoji: '📍' },
  ];
  return categories;
}

/** DiscoveryPanel thumbnail badge emoji. */
export function discoveryBadgeEmoji(category: any): string {
  return categoryEmojis[category as SpotCategory] || '📍';
}

// ---------------------------------------------------------------------------------------------
// Map markers: MapView `getCategoryIcon` without `L.divIcon` (returns the `html` string).
// ---------------------------------------------------------------------------------------------
export const getCategoryIconSvg = (category: string, status: 'approved' | 'pending' | 'rejected', isHighlighted: boolean = false, size = 48) => {
  let emoji = '📍';
  switch (category) {
    case 'scenic': emoji = '🌅'; break;
    case 'smoke-spot': emoji = '💨'; break;
    case 'viewpoint': emoji = '🏔️'; break;
    case 'hiking': emoji = '🥾'; break;
    case 'random': emoji = '🎲'; break;
    case 'date-spot': emoji = '❤️'; break;
    case 'park': emoji = '🌳'; break;
    case 'part': emoji = '🏖️'; break;
  }

  let bgColor = status === 'approved' ? '#10b981' : '#eab308';
  if (isHighlighted) bgColor = '#FFD700';

  const svg = isHighlighted
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="28" cy="28" r="24" fill="${bgColor}" stroke="#FFA500" stroke-width="3" filter="url(#glow)"/>
        <text x="28" y="35" font-size="22" text-anchor="middle">${emoji}</text>
        <text x="46" y="14" font-size="18">⭐</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="${bgColor}" opacity="0.9"/>
        <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${emoji}</text>
      </svg>`;

  return svg;
};

/** MapView `getMarkerSize` (the useCallback body). */
export const getMarkerSize = (zoom: number) => {
  if (zoom <= 5) return 24;
  if (zoom <= 10) return 32;
  if (zoom <= 14) return 48;
  if (zoom <= 18) return 64;
  return 80;
};

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

// ---------------------------------------------------------------------------------------------
// Magic numbers
// ---------------------------------------------------------------------------------------------
/** ProfilePanel "All levels" list: `[0, 0, 3, 10, 15, 20][level]`. */
export const profileLevelSpots = [0, 0, 3, 10, 15, 20];
