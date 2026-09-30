// Level identity (design): each level has its own colours and a hand-drawn badge glyph, replacing
// the emoji. Pure data plus the level-up rule; LevelBadge / LevelRing / LevelUpCelebration render it.
// Thresholds and perks stay in levelUtils (the Cloud Functions parity test imports that file).
import type { Glyph, GlyphNode } from './categoryGlyphs';
import type { TranslationKey } from './translations';

export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export interface LevelTheme {
  /** Gradient stops, top-left to bottom-right (badge fill, ring stroke). */
  stops: readonly string[];
  /** Solid colour for small marks and glows. */
  accent: string;
  glyph: Glyph;
}

const path = (d: string): GlyphNode => ({ tag: 'path', d });

export const LEVEL_THEMES: Readonly<Record<LevelNumber, LevelTheme>> = {
  // Rookie: a sprout
  1: {
    stops: ['#5EE08A', '#0E8A4F'],
    accent: '#34C759',
    glyph: { nodes: [path('M12 20v-8'), path('M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5z'), path('M12 14.5c0-3-2.5-5-6-5 0 3 2.5 5 6 5z')] },
  },
  // Explorer: a compass
  2: {
    stops: ['#6FD3FF', '#0A64D6'],
    accent: '#0A84FF',
    glyph: { nodes: [{ tag: 'circle', cx: 12, cy: 12, r: 8.5 }, path('M15.5 8.5l-2 5-5 2 2-5z')] },
  },
  // Trailblazer: a winding route between two points
  3: {
    stops: ['#D59BFF', '#6E2FD6'],
    accent: '#AF52DE',
    glyph: {
      nodes: [
        { tag: 'circle', cx: 6, cy: 18, r: 2 },
        { tag: 'circle', cx: 18, cy: 6, r: 2 },
        path('M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5'),
      ],
    },
  },
  // Local Legend: a crown
  4: {
    stops: ['#FFD66B', '#FF7A00'],
    accent: '#FF9F0A',
    glyph: { nodes: [path('M4.5 17 3.5 8l4.8 3.6L12 5l3.7 6.6L20.5 8l-1 9z'), path('M5.5 20h13')] },
  },
  // Cartographer: a folded map
  5: {
    stops: ['#5EEAD4', '#A78BFA', '#F472B6'],
    accent: '#C084FC',
    glyph: { nodes: [path('M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z'), path('M9 4v14'), path('M15 6v14')] },
  },
};

/** The theme of a level (clamped to 1–5). */
export function levelTheme(level: number): LevelTheme {
  const clamped = Math.min(5, Math.max(1, Math.round(level))) as LevelNumber;
  return LEVEL_THEMES[clamped];
}

export type PerkIcon = 'name' | 'highlight' | 'icons' | 'style';

export interface Perk {
  icon: PerkIcon | null;
  /** Rendered joined by a space (e.g. `highlightOneSpot goldAppearance`). */
  keys: readonly TranslationKey[];
  muted?: boolean;
}

/** What each level unlocks (level info table, level-up celebration). */
export const LEVEL_PERKS: Readonly<Record<LevelNumber, readonly Perk[]>> = {
  1: [{ icon: null, keys: ['noSpecialBenefits'], muted: true }],
  2: [{ icon: 'name', keys: ['silverName'] }],
  3: [
    { icon: 'name', keys: ['goldName'] },
    { icon: 'highlight', keys: ['highlightOneSpot', 'goldAppearance'] },
  ],
  4: [
    { icon: 'name', keys: ['goldName'] },
    { icon: 'highlight', keys: ['highlightTwoSpots', 'goldAppearance'] },
    { icon: 'icons', keys: ['useCustomIcons'] },
  ],
  5: [
    { icon: 'name', keys: ['diamondNameAndBadge'] },
    { icon: 'highlight', keys: ['highlightTwoSpots', 'goldAppearance'] },
    { icon: 'icons', keys: ['useCustomIcons'] },
    { icon: 'style', keys: ['customizeNameStyle'] },
  ],
};

/**
 * The level-up rule: `seen` is the highest level already shown to this user on this device (null:
 * never recorded). A celebration is due only for a level above it; the first sighting is just
 * recorded, so opening the app never celebrates old levels. `next` is the value to store: it never
 * goes down, because XP can drop (deleted content takes it back) and regaining a level is no news.
 */
export function levelUpStep(seen: number | null, level: number): { celebrate: boolean; next: number } {
  if (seen === null) return { celebrate: false, next: level };
  return { celebrate: level > seen, next: Math.max(seen, level) };
}
