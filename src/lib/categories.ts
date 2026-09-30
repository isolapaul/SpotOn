// Spot categories (T23, DUP-05; item 7): the nine built-ins plus the ones the super admin creates
// in categories/{id}. Single source for ids, labels and glyphs. Pure: types only.
import type { SpotCategory } from '@/store/useSpotStore';
import type { TranslationKey } from './translations';
import type { Language } from './i18n';
import { CATEGORY_GLYPHS, type Glyph } from './categoryGlyphs';
import { CATEGORY_ICON_GLYPHS, normalizeCategoryIcon, type CategoryIconId } from './categoryIcons';

/** The built-in categories in UI order ('other' last). */
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

/** Translation key per built-in category, no fallback. */
export const CATEGORY_LABEL_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.labelKey])) as Record<
  SpotCategory,
  TranslationKey
>;

export const MAX_CATEGORY_NAME = 50;

/**
 * A category the super admin created: the Hungarian `name` is required, English and German are
 * optional and fall back to it (no auto-translation). `icon` is null for a legacy (emoji) icon.
 */
export interface CustomCategory {
  id: string;
  name: string;
  nameEn?: string;
  nameDe?: string;
  icon: CategoryIconId | null;
}

function optionalName(x: unknown): string | undefined {
  return typeof x === 'string' && x.trim() ? x.trim() : undefined;
}

/** A categories/{id} document, or null when it has no usable name. */
export function parseCustomCategory(id: string, data: unknown): CustomCategory | null {
  if (typeof data !== 'object' || data === null) return null;
  const { name, nameEn, nameDe, icon } = data as Record<string, unknown>;
  const hu = optionalName(name);
  if (!hu) return null;
  const en = optionalName(nameEn);
  const de = optionalName(nameDe);
  return { id, name: hu, ...(en ? { nameEn: en } : {}), ...(de ? { nameDe: de } : {}), icon: normalizeCategoryIcon(icon) };
}

/** A custom category's name in a UI language (Hungarian when that one is empty). */
export function customCategoryName(c: CustomCategory, language: Language): string {
  if (language === 'en') return c.nameEn ?? c.name;
  if (language === 'de') return c.nameDe ?? c.name;
  return c.name;
}

/** A category ready to show: its label (a translation key or the admin's text) and glyph. */
export interface CategoryOption {
  id: string;
  label: { key: TranslationKey } | { custom: CustomCategory };
  glyph: Glyph;
  custom: boolean;
}

function builtIn(c: (typeof CATEGORIES)[number]): CategoryOption {
  return { id: c.id, label: { key: c.labelKey }, glyph: CATEGORY_GLYPHS[c.id], custom: false };
}

function customOption(c: CustomCategory): CategoryOption {
  return { id: c.id, label: { custom: c }, glyph: c.icon ? CATEGORY_ICON_GLYPHS[c.icon] : CATEGORY_GLYPHS.other, custom: true };
}

const OTHER = builtIn(CATEGORIES[CATEGORIES.length - 1]);

/** Every category in UI order: the built-ins, the custom ones by name, then 'other'. */
export function categoryOptions(customs: readonly CustomCategory[]): CategoryOption[] {
  const sorted = [...customs].sort((a, b) => a.name.localeCompare(b.name));
  return [...CATEGORIES.slice(0, -1).map(builtIn), ...sorted.map(customOption), OTHER];
}

/** One category by id; unknown ids (e.g. of a legacy spot) show as 'other'. */
export function resolveCategory(id: string | undefined, customs: readonly CustomCategory[]): CategoryOption {
  const known = CATEGORIES.find((c) => c.id === id);
  if (known) return builtIn(known);
  const custom = customs.find((c) => c.id === id);
  return custom ? customOption(custom) : OTHER;
}
