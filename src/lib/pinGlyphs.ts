// Special pin icons (item 6): from level 4 a user picks one icon that replaces the category glyph
// on the map pins of all their spots. Same format as the category glyphs (24x24, 2px round
// strokes, lucide-compatible). Pure data; the ids are the allowlist the server enforces
// (functions/src/lib/pinIcons.ts, parity-tested).
import type { Glyph, GlyphNode } from './categoryGlyphs';
import type { TranslationKey } from './translations';

export const PIN_ICON_IDS = ['star', 'crown', 'flame', 'mountain', 'leaf', 'bolt', 'diamond', 'moon'] as const;
export type PinIconId = (typeof PIN_ICON_IDS)[number];

const path = (d: string): GlyphNode => ({ tag: 'path', d });

export const PIN_GLYPHS: Readonly<Record<PinIconId, Glyph>> = {
  star: { nodes: [path('M12 3.4 14.7 9.18l6.34.78-4.67 4.36 1.21 6.27L12 17.5l-5.58 3.09 1.21-6.27-4.67-4.36 6.34-.78z')] },
  crown: { nodes: [path('M5 16.5 3.5 7l5 4.5L12 4.5l3.5 7 5-4.5-1.5 9.5z'), path('M5 20h14')] },
  flame: { nodes: [path('M12 21a7 7 0 0 1-7-7c0-2.9 1.4-4.9 3-6.4.2 1.8 1 3 2.2 3.6C10 7.9 11 5.2 13.5 3c.7 3.2 2.5 5.1 3.9 7A7 7 0 0 1 19 14a7 7 0 0 1-7 7z')] },
  mountain: { nodes: [path('M3 19.5 12 4.5l9 15z'), path('M7.8 11.5 10 13.2l2-2 2 2 2.2-1.7')] },
  leaf: { nodes: [path('M6.5 17.5C4.5 11.5 8.5 4.5 19.5 4.5c0 11-7 15-13 13z'), path('M4 20 14 10')] },
  bolt: { nodes: [path('M13.2 3 4.8 13.4h6.9l-.9 7.6 8.4-10.4h-6.9z')] },
  diamond: { nodes: [path('M7 4h10l4 5-9 11L3 9z'), path('M3 9h18'), path('M10 4 8.5 9 12 20l3.5-11L14 4')] },
  moon: { nodes: [path('M11.16 3.84a8.5 8.5 0 1 0 9.3 9.3 7 7 0 0 1-9.3-9.3z')] },
};

export const PIN_ICON_LABELS: Readonly<Record<PinIconId, TranslationKey>> = {
  star: 'pinIconStar',
  crown: 'pinIconCrown',
  flame: 'pinIconFlame',
  mountain: 'pinIconMountain',
  leaf: 'pinIconLeaf',
  bolt: 'pinIconBolt',
  diamond: 'pinIconDiamond',
  moon: 'pinIconMoon',
};

/** An allowlisted pin icon id, else null (anything read from Firestore goes through this). */
export function normalizePinIcon(x: unknown): PinIconId | null {
  return typeof x === 'string' && (PIN_ICON_IDS as readonly string[]).includes(x) ? (x as PinIconId) : null;
}
