// Spot categories (T23, DUP-05): single source for ids, emoji and label keys. Pure: types only.
import type { SpotCategory } from '@/store/useSpotStore';
import type { TranslationKey } from './translations';

/** All categories in UI order (AddSpotModal options, DiscoveryPanel filter chips). */
export const CATEGORIES: ReadonlyArray<{ id: SpotCategory; emoji: string; labelKey: TranslationKey }> = [
  { id: 'scenic', emoji: '🌅', labelKey: 'categoryScenic' },
  { id: 'smoke-spot', emoji: '💨', labelKey: 'categorySmoke' },
  { id: 'viewpoint', emoji: '🏔️', labelKey: 'categoryViewpoint' },
  { id: 'hiking', emoji: '🥾', labelKey: 'categoryHiking' },
  { id: 'random', emoji: '🎲', labelKey: 'categoryRandom' },
  { id: 'date-spot', emoji: '❤️', labelKey: 'categoryDateSpot' },
  { id: 'park', emoji: '🌳', labelKey: 'categoryPark' },
  { id: 'part', emoji: '🏖️', labelKey: 'categoryPart' },
  { id: 'other', emoji: '📍', labelKey: 'categoryOther' },
];

/** Emoji per category, no fallback (an unknown category yields undefined). */
export const CATEGORY_EMOJI = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.emoji])) as Record<SpotCategory, string>;

/** Translation key per category, no fallback. */
export const CATEGORY_LABEL_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.labelKey])) as Record<
  SpotCategory,
  TranslationKey
>;

/** Fallback emoji for an unknown category (also the 'other' emoji). */
export const DEFAULT_CATEGORY_EMOJI = '📍';

/**
 * Emoji for a map marker or badge: the category's emoji, else '📍'. Only own keys count, so
 * prototype names such as 'toString' fall back as well (as MapView's former switch did).
 * (hasOwnProperty.call rather than Object.hasOwn: the latter needs Safari 15.4+.)
 */
export function getMarkerEmoji(category: string | undefined): string {
  return category !== undefined && Object.prototype.hasOwnProperty.call(CATEGORY_EMOJI, category)
    ? CATEGORY_EMOJI[category as SpotCategory]
    : DEFAULT_CATEGORY_EMOJI;
}

/** Marker background colours: status-based, highlighted overrides both. */
export const MARKER_COLORS = { approved: '#10b981', other: '#eab308', highlighted: '#FFD700' } as const;
