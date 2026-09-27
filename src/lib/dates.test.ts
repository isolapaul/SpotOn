/* eslint-disable @typescript-eslint/no-explicit-any -- the oracle is the pre-T28 code, verbatim */
import { describe, expect, it } from 'vitest';
import type { Language } from './i18n';
import { dateLocale, formatLongDate, type DateInput } from './dates';

// Oracle: SpotDetailsPanel's `getDateLocale`/`formatDate` before T28, only wrapped in a function
// and given parameters (language, t('unknownDate')).
function oracleFormatDate(language: Language, unknownLabel: string, timestamp: any) {
  const getDateLocale = () => language === 'hu' ? 'hu-HU' : language === 'de' ? 'de-DE' : 'en-US';
  if (!timestamp) return unknownLabel;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
}

const LANGS: Language[] = ['hu', 'en', 'de'];
const WHEN = new Date('2025-06-01T12:00:00Z');

const SAMPLES: Array<[string, DateInput]> = [
  ['Timestamp-like (toDate)', { toDate: () => new Date(WHEN) }],
  ['Date', new Date(WHEN)],
  ['number (epoch ms)', WHEN.getTime()],
  ['ISO string', WHEN.toISOString()],
  ['null', null],
  ['undefined', undefined],
  ['0', 0],
  ['empty string', ''],
];

describe('dateLocale', () => {
  it.each([
    ['hu', 'hu-HU'],
    ['de', 'de-DE'],
    ['en', 'en-US'],
  ] as const)('%s → %s', (lang, locale) => {
    expect(dateLocale(lang)).toBe(locale);
  });
});

describe('formatLongDate matches the pre-T28 formatDate', () => {
  for (const lang of LANGS) {
    it.each(SAMPLES)(`${lang}: %s`, (_, input) => {
      expect(formatLongDate(input, lang, 'Unknown')).toBe(oracleFormatDate(lang, 'Unknown', input));
    });
  }

  it('falsy input gives the unknown label', () => {
    expect(formatLongDate(null, 'en', 'n/a')).toBe('n/a');
    expect(formatLongDate(undefined, 'hu', 'ismeretlen')).toBe('ismeretlen');
  });

  it('formats a long date in the language locale', () => {
    expect(formatLongDate(WHEN, 'en', '?')).toBe('June 1, 2025');
    expect(formatLongDate({ toDate: () => WHEN }, 'de', '?')).toBe('1. Juni 2025');
  });
});
