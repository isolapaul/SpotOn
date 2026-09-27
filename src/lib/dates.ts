// Pure date helpers (T28). No React/Firebase imports: a Firestore Timestamp is accepted
// structurally (anything with `toDate()`).
import type { Language } from '@/lib/i18n';

export type DateLocale = 'hu-HU' | 'de-DE' | 'en-US';

/** A Firestore Timestamp (or anything with `toDate()`), a Date, epoch ms or a date string. */
export type DateInput = { toDate: () => Date } | Date | number | string | null | undefined;

/** The `toLocaleDateString` locale for a UI language. */
export function dateLocale(lang: Language): DateLocale {
  if (lang === 'hu') return 'hu-HU';
  if (lang === 'de') return 'de-DE';
  return 'en-US';
}

/** Long date (e.g. "June 1, 2025"); a falsy input gives `unknownLabel`. */
export function formatLongDate(ts: DateInput, lang: Language, unknownLabel: string): string {
  if (!ts) return unknownLabel;
  const date = typeof ts === 'object' && 'toDate' in ts ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(dateLocale(lang), { year: 'numeric', month: 'long', day: 'numeric' });
}
