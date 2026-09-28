import { describe, expect, it } from 'vitest';
import type { TranslationKey } from './translations';
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL_KEY, MARKER_COLORS, getMarkerEmoji } from './categories';
import { categoryEmojis, categoryTranslationKeys } from './spotUtils';
import * as oracle from './__oracles__/legacy';

const IDS = ['scenic', 'smoke-spot', 'viewpoint', 'hiking', 'random', 'date-spot', 'park', 'part', 'other'] as const;
const LOOKUPS: Array<string | undefined> = [...IDS, 'unknown', undefined, '', 'toString', '__proto__'];

describe('categories (characterisation)', () => {
  it('CATEGORIES matches the AddSpotModal option list (order, value, emoji, label key)', () => {
    expect(CATEGORIES.map((c) => ({ value: c.id, emoji: c.emoji, labelKey: c.labelKey }))).toEqual(oracle.addSpotOptions);
    expect(CATEGORIES.map((c) => c.id)).toEqual(IDS);
  });

  it('CATEGORIES matches the DiscoveryPanel categories (order, value, label, emoji)', () => {
    const t = (key: TranslationKey) => `t:${key}`;
    expect(CATEGORIES.map((c) => ({ value: c.id, label: t(c.labelKey), emoji: c.emoji }))).toEqual(oracle.discoveryCategories(t));
  });

  it('CATEGORY_EMOJI / CATEGORY_LABEL_KEY equal the former spotUtils maps (no fallback)', () => {
    expect(CATEGORY_EMOJI).toEqual(oracle.categoryEmojis);
    expect(CATEGORY_LABEL_KEY).toEqual(oracle.categoryTranslationKeys);
    expect((CATEGORY_EMOJI as Record<string, string>).unknown).toBeUndefined();
    expect((CATEGORY_LABEL_KEY as Record<string, string>).unknown).toBeUndefined();
  });

  it('spotUtils keeps re-exporting the old names', () => {
    expect(categoryEmojis).toBe(CATEGORY_EMOJI);
    expect(categoryTranslationKeys).toBe(CATEGORY_LABEL_KEY);
  });

  it.each(IDS.map((id) => [id]))('SpotDetailsPanel/SpotInfoWindow lookups unchanged: %s', (id) => {
    expect(categoryEmojis[id]).toBe(oracle.categoryEmojis[id]);
    expect(categoryTranslationKeys[id]).toBe(oracle.categoryTranslationKeys[id]);
  });

  it.each(LOOKUPS.filter((c) => c !== 'toString' && c !== '__proto__').map((c) => [c]))(
    'getMarkerEmoji matches the DiscoveryPanel badge (`categoryEmojis[c] || "📍"`): %s',
    (category) => {
      expect(getMarkerEmoji(category)).toBe(oracle.discoveryBadgeEmoji(category));
    },
  );

  it('getMarkerEmoji falls back to 📍 for prototype names too (as the MapView switch did)', () => {
    expect(getMarkerEmoji('toString')).toBe('📍');
    expect(getMarkerEmoji('__proto__')).toBe('📍');
    expect(getMarkerEmoji('other')).toBe('📍');
  });

  it('MARKER_COLORS are the MapView colours', () => {
    expect(MARKER_COLORS).toEqual({ approved: '#10b981', other: '#eab308', highlighted: '#FFD700' });
  });
});
