import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_LABEL_KEY } from './categories';
import { categoryTranslationKeys } from './spotUtils';
import { translations } from './translations';

const IDS = ['scenic', 'smoke-spot', 'viewpoint', 'hiking', 'random', 'date-spot', 'park', 'part', 'other'] as const;

describe('categories', () => {
  it('lists the nine categories in UI order', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(IDS);
  });

  it('every label key exists in the dictionaries', () => {
    for (const { labelKey } of CATEGORIES) expect(translations.hu).toHaveProperty(labelKey);
  });

  it('CATEGORY_LABEL_KEY maps each id, with no fallback for unknown ids', () => {
    for (const c of CATEGORIES) expect(CATEGORY_LABEL_KEY[c.id]).toBe(c.labelKey);
    expect((CATEGORY_LABEL_KEY as Record<string, string>).unknown).toBeUndefined();
  });

  it('spotUtils keeps re-exporting the label map', () => {
    expect(categoryTranslationKeys).toBe(CATEGORY_LABEL_KEY);
  });
});
