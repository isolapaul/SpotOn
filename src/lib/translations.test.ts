import { describe, expect, it } from 'vitest';
import { translations } from './translations';

describe('translations', () => {
  const huKeys = Object.keys(translations.hu).sort();

  it.each(['en', 'de'] as const)('%s has exactly the hu key set', (lang) => {
    expect(Object.keys(translations[lang]).sort()).toEqual(huKeys);
  });

  it.each(['hu', 'en', 'de'] as const)('%s has no empty value', (lang) => {
    const empty = Object.entries(translations[lang])
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
