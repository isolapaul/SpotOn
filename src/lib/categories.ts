// Spot categories (T23, DUP-05): single source for ids and label keys. Pure: types only.
// The map pins and tiles draw each category's glyph (components/ui/CategoryIcon).
import type { SpotCategory } from '@/store/useSpotStore';
import type { TranslationKey } from './translations';

/** All categories in UI order (AddSpotModal tiles, DiscoveryPanel filter chips). */
export const CATEGORIES: ReadonlyArray<{ id: SpotCategory; labelKey: TranslationKey }> = [
  { id: 'scenic', labelKey: 'categoryScenic' },
  { id: 'smoke-spot', labelKey: 'categorySmoke' },
  { id: 'viewpoint', labelKey: 'categoryViewpoint' },
  { id: 'hiking', labelKey: 'categoryHiking' },
  { id: 'random', labelKey: 'categoryRandom' },
  { id: 'date-spot', labelKey: 'categoryDateSpot' },
  { id: 'park', labelKey: 'categoryPark' },
  { id: 'part', labelKey: 'categoryPart' },
  { id: 'other', labelKey: 'categoryOther' },
];

/** Translation key per category, no fallback. */
export const CATEGORY_LABEL_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.labelKey])) as Record<
  SpotCategory,
  TranslationKey
>;
