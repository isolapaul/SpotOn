// Category glyphs (design 1D): hand-drawn 24x24 line icons (2px round strokes, lucide-compatible)
// that replace the emoji on map pins. Pure data: React renders it with CategoryIcon later, and the
// map builds marker markup from it. Nothing here comes from Firestore.
import type { SpotCategory } from '@/store/useSpotStore';

export type GlyphNode =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number; filled?: boolean }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx: number };

export interface Glyph {
  nodes: readonly GlyphNode[];
  /** Optional group transform in glyph units (e.g. a tilted die). */
  transform?: string;
}

const path = (d: string): GlyphNode => ({ tag: 'path', d });

export const CATEGORY_GLYPHS: Readonly<Record<SpotCategory, Glyph>> = {
  // sun setting on a horizon over water
  scenic: {
    nodes: [path('M3 16h18'), path('M7.5 16a4.5 4.5 0 0 1 9 0'), path('M12 6.5v2.5'), path('M5.6 9.6l1.5 1.5'), path('M18.4 9.6l-1.5 1.5'), path('M8 20h8')],
  },
  // drifting wisps ("hidden spot")
  'smoke-spot': {
    nodes: [path('M3 10h9.5a2.5 2.5 0 1 0-2.5-2.5'), path('M3 14h14.5a2.5 2.5 0 1 1-2.5 2.5'), path('M3 18h5')],
  },
  // twin peaks with a summit flag
  viewpoint: {
    nodes: [path('M3 20 10 8l3.5 6 2.5-4 5 10z'), path('M10 8V3.5h4l-1 1.5 1 1.5h-4')],
  },
  // laced boot with a thick sole
  hiking: {
    nodes: [path('M6 3.5h5v6l4.8 2c2.6 1.1 4.2 2.4 4.2 4.8v3.2H4V5.5a2 2 0 0 1 2-2z'), path('M4 16.5h16'), path('M8 6.5h3'), path('M8 9.5h3')],
  },
  // a slightly tipped die
  random: {
    transform: 'rotate(-10 12 12)',
    nodes: [
      { tag: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3.5 },
      { tag: 'circle', cx: 8.5, cy: 8.5, r: 1.25, filled: true },
      { tag: 'circle', cx: 12, cy: 12, r: 1.25, filled: true },
      { tag: 'circle', cx: 15.5, cy: 15.5, r: 1.25, filled: true },
    ],
  },
  // heart (echoes the app icon)
  'date-spot': {
    nodes: [path('M12 20s-8.5-5-8.5-10.5C3.5 6.9 5.5 5 7.9 5c1.7 0 3.2.9 4.1 2.3C12.9 5.9 14.4 5 16.1 5c2.4 0 4.4 1.9 4.4 4.5C20.5 15 12 20 12 20z')],
  },
  // round-crowned tree
  park: {
    nodes: [path('M12 3a5.5 5.5 0 0 0-5.3 7 4.5 4.5 0 0 0 1.3 8h8a4.5 4.5 0 0 0 1.3-8A5.5 5.5 0 0 0 12 3z'), path('M12 21v-8'), path('M12 15.5 9.5 13')],
  },
  // parasol over a wave ("part" = shore)
  part: {
    nodes: [
      path('M5.4 11.2a7 7 0 0 1 13.6-3.4c-1.4-.6-2.4-.3-3.4.8-1.4-.6-2.4-.3-3.4.8-1.4-.6-2.4-.3-3.4.8-1.4-.6-2.4-.3-3.4 1z'),
      path('M12.2 9.3l2 7.8'),
      path('M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1'),
    ],
  },
  // generic place pin
  other: {
    nodes: [path('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z'), { tag: 'circle', cx: 12, cy: 10, r: 2.5 }],
  },
};

/** The category id to use: the given one if it is a known category (own key), else 'other'. */
export function normalizeCategory(category: string | undefined): SpotCategory {
  return category !== undefined && Object.hasOwn(CATEGORY_GLYPHS, category) ? (category as SpotCategory) : 'other';
}

/** SVG markup of a glyph's nodes for marker HTML strings; `ink` is a constant colour. */
export function glyphToSvgMarkup(glyph: Glyph, ink: string): string {
  const inner = glyph.nodes
    .map((n) => {
      if (n.tag === 'path') return `<path d="${n.d}"/>`;
      if (n.tag === 'rect') return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${n.rx}"/>`;
      return n.filled
        ? `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${ink}" stroke="none"/>`
        : `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}"/>`;
    })
    .join('');
  return glyph.transform ? `<g transform="${glyph.transform}">${inner}</g>` : inner;
}
