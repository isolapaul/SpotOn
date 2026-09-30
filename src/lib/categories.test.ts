import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIES, CATEGORY_LABEL_KEY, categoryOptions, customCategoryName, parseCustomCategory, resolveCategory } from './categories';
import { CATEGORY_GLYPHS } from './categoryGlyphs';
import { CATEGORY_ICON_GLYPHS, CATEGORY_ICON_IDS, CATEGORY_ICON_LABELS } from './categoryIcons';
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

});

describe('custom categories (item 7)', () => {
  const lake = { id: 'c1', name: 'Lakes', icon: 'lake' as const };
  const bar = { id: 'c2', name: 'Bars', icon: null };

  it('parses a categories doc; legacy emoji icons become null, nameless docs are skipped', () => {
    expect(parseCustomCategory('c1', { name: ' Lakes ', icon: 'lake' })).toEqual(lake);
    expect(parseCustomCategory('c2', { name: 'Bars', icon: '🍺' })).toEqual(bar);
    expect(parseCustomCategory('c3', { name: '  ', icon: 'lake' })).toBeNull();
    expect(parseCustomCategory('c4', null)).toBeNull();
    expect(parseCustomCategory('c5', { name: 'Tavak', nameEn: 'Lakes', nameDe: ' ', icon: 'lake' }))
      .toEqual({ id: 'c5', name: 'Tavak', nameEn: 'Lakes', icon: 'lake' });
  });

  it('names fall back to Hungarian', () => {
    const c = { id: 'c', name: 'Tavak', nameEn: 'Lakes', icon: null };
    expect([customCategoryName(c, 'hu'), customCategoryName(c, 'en'), customCategoryName(c, 'de')]).toEqual(['Tavak', 'Lakes', 'Tavak']);
  });

  it('lists built-ins, custom ones by name, then other', () => {
    const ids = categoryOptions([lake, bar]).map((o) => o.id);
    expect(ids).toEqual([...IDS.slice(0, -1), 'c2', 'c1', 'other']);
  });

  it('resolves labels and glyphs; unknown ids show as other', () => {
    expect(resolveCategory('c1', [lake])).toMatchObject({ label: { custom: lake }, glyph: CATEGORY_ICON_GLYPHS.lake, custom: true });
    expect(resolveCategory('c2', [bar]).glyph).toBe(CATEGORY_GLYPHS.other);
    expect(resolveCategory('park', [])).toMatchObject({ label: { key: 'categoryPark' }, custom: false });
    expect(resolveCategory('gone', []).id).toBe('other');
  });

  it('every icon has a glyph and a label', () => {
    for (const id of CATEGORY_ICON_IDS) {
      expect(CATEGORY_ICON_GLYPHS[id].nodes.length).toBeGreaterThan(0);
      expect(translations.hu).toHaveProperty(CATEGORY_ICON_LABELS[id]);
    }
  });

  it('firestore.rules allows exactly these built-ins and icons', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const list = (fn: string) => {
      const body = rules.slice(rules.indexOf(`function ${fn}(`));
      return [...body.slice(body.indexOf('['), body.indexOf(']') + 1).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };
    expect(list('builtInCategory').sort()).toEqual([...IDS].sort());
    expect(list('validCategoryIcon')).toEqual([...CATEGORY_ICON_IDS]);
  });
});
