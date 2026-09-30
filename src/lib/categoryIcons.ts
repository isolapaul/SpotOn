// Icons for categories the super admin creates (item 7): a separate hand-drawn set, same format as
// the built-in category glyphs (24x24, 2px round strokes, lucide-compatible). Pure data; the ids
// are the allowlist firestore.rules enforces for categories/{id}.icon (parity-tested).
import type { Glyph, GlyphNode } from './categoryGlyphs';
import type { TranslationKey } from './translations';

export const CATEGORY_ICON_IDS = [
  'waterfall', 'lake', 'beach', 'forest', 'cave', 'castle', 'ruins', 'bridge',
  'church', 'museum', 'cafe', 'food', 'camping', 'picnic', 'bike', 'street-art',
] as const;
export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

const path = (d: string): GlyphNode => ({ tag: 'path', d });

export const CATEGORY_ICON_GLYPHS: Readonly<Record<CategoryIconId, Glyph>> = {
  waterfall: { nodes: [path('M5.5 4.5h8.5a3 3 0 0 1 3 3v9'), path('M5.5 8.5H9a3 3 0 0 1 3 3v5'), path('M5.5 12.5a2 2 0 0 1 2 2v2'), path('M3.5 20.5c1.4 0 1.4-1 2.8-1s1.4 1 2.8 1 1.4-1 2.9-1 1.4 1 2.9 1 1.4-1 2.8-1 1.4 1 2.8 1')] },
  lake: { nodes: [path('M3 16.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1'), path('M6 20.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1'), path('M15 13V4.5'), path('M18.5 13V8'), path('M11.5 13l-1.5-4')] },
  beach: { nodes: [path('M13.5 20.5c.6-4-.2-8.5-2.5-11.5'), path('M11 9C9.5 6.5 6 5.5 3.5 7'), path('M11 9c-3 0-5.5 1.5-6.5 4.5'), path('M11 9c1.5-2.5 5-3.5 8-2'), path('M11 9c3-.3 5.8 1.2 7 4'), path('M3 20.5c3-1.6 15-1.6 18 0')] },
  forest: { nodes: [path('M6.75 3 4 9h1.6L2.5 15.5H11L7.9 9h1.6z'), path('M6.75 15.5v5'), path('M17.25 6.5 14.8 11.5h1.4L13 16.5h8.5l-3.2-5h1.4z'), path('M17.25 16.5v4')] },
  cave: { nodes: [path('M2.5 20.5c.4-5.2 2-8.7 4.4-10.7L9 6.5l3 1.5 3-2c3 2.2 5.8 7 6.5 14.5z'), path('M8.5 20.5v-2.5a3.5 3.5 0 0 1 7 0v2.5')] },
  castle: { nodes: [path('M4 20.5V5h3v2.5h2.5V5h5v2.5H17V5h3v15.5z'), path('M9.5 20.5v-4a2.5 2.5 0 0 1 5 0v4')] },
  ruins: { nodes: [path('M3.5 20.5V7l2.5 2 2.5-3.5L11 8.5l2-1.5v3.5l3 1.5 2.5-1.5 2 2v8z'), path('M7.5 20.5v-4.5a2 2 0 0 1 4 0v4.5'), path('M2.5 20.5h19')] },
  bridge: { nodes: [path('M2.5 15.5h19'), path('M7 20.5v-16'), path('M17 20.5v-16'), path('M2.5 11c2.5 0 3.5-2.5 4.5-6.5 2 5.5 8 5.5 10 0 1 4 2 6.5 4.5 6.5'), path('M12 8.6v6.9')] },
  church: { nodes: [path('M12 2.5v4.5'), path('M10 4.5h4'), path('M5 20.5v-9L12 7l7 4.5v9z'), path('M10 20.5V17a2 2 0 0 1 4 0v3.5')] },
  museum: { nodes: [path('M3 9 12 3.5 21 9z'), path('M6 12v6'), path('M10 12v6'), path('M14 12v6'), path('M18 12v6'), path('M3 20.5h18')] },
  cafe: { nodes: [path('M3.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z'), path('M15.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.5'), path('M7.5 3.5c-.8 1 .8 2 0 3'), path('M11.5 3.5c-.8 1 .8 2 0 3')] },
  food: { nodes: [path('M5 3v5.5a2.5 2.5 0 0 0 5 0V3'), path('M7.5 3v18'), path('M17.5 21V3c-2 1-3.5 3.5-3.5 7.5 0 1.5 1 2.5 3.5 2.5')] },
  camping: { nodes: [path('M2.5 20.5h19'), path('M4.5 20.5 12 6.5l7.5 14'), path('M10.5 3.5 12 6.5l1.5-3'), path('M9.5 20.5 12 15.5l2.5 5')] },
  picnic: { nodes: [path('M4.5 8h15'), path('M9.5 8 6 20.5'), path('M14.5 8 18 20.5'), path('M3 14.5h18')] },
  bike: { nodes: [{ tag: 'circle', cx: 6, cy: 16, r: 3.5 }, { tag: 'circle', cx: 18, cy: 16, r: 3.5 }, path('M6 16h5.5L9 9h6.5L18 16'), path('M11.5 16l4-7'), path('M9 9 8.5 7.5M7.5 7.5h2.5'), path('M15.5 9 15 6.5h2')] },
  'street-art': { nodes: [path('M5 11a3 3 0 0 1 3-3h2.5a3 3 0 0 1 3 3v8a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19z'), path('M8 8V5h2.5v3'), path('M5 13.5h8.5'), { tag: 'circle', cx: 14, cy: 4.5, r: 1.1, filled: true }, { tag: 'circle', cx: 17.5, cy: 3.2, r: 1.1, filled: true }, { tag: 'circle', cx: 17.5, cy: 6.8, r: 1.1, filled: true }, { tag: 'circle', cx: 20.5, cy: 5, r: 1, filled: true }] },
};

export const CATEGORY_ICON_LABELS: Readonly<Record<CategoryIconId, TranslationKey>> = {
  waterfall: 'catIconWaterfall',
  lake: 'catIconLake',
  beach: 'catIconBeach',
  forest: 'catIconForest',
  cave: 'catIconCave',
  castle: 'catIconCastle',
  ruins: 'catIconRuins',
  bridge: 'catIconBridge',
  church: 'catIconChurch',
  museum: 'catIconMuseum',
  cafe: 'catIconCafe',
  food: 'catIconFood',
  camping: 'catIconCamping',
  picnic: 'catIconPicnic',
  bike: 'catIconBike',
  'street-art': 'catIconStreetArt',
};

/** An allowlisted category icon id, else null (anything read from Firestore goes through this). */
export function normalizeCategoryIcon(x: unknown): CategoryIconId | null {
  return typeof x === 'string' && (CATEGORY_ICON_IDS as readonly string[]).includes(x) ? (x as CategoryIconId) : null;
}
