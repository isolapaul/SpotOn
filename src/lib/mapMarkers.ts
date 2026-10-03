// Map pins (design 1D). Pure string building: MapView wraps the markup in an L.divIcon and caches
// the icons. Every value interpolated below is a constant or a normalised category id; nothing
// read from Firestore reaches the markup (Leaflet inserts divIcon html with innerHTML).
import { CATEGORY_GLYPHS, glyphToSvgMarkup, normalizeCategory } from './categoryGlyphs';

/**
 * approved: public green pin; rejected: grey with a cross (item 4: only its owner and admins see it);
 * pending: any other non-approved spot (the owner's or, for admins, anyone's).
 */
export type MarkerVariant = 'approved' | 'pending' | 'rejected';

/** Pin box and tip (the spot's coordinate) in CSS px; one size at every zoom (senior UI review M3). */
export const PIN_SIZE: readonly [number, number] = [44, 54];
export const PIN_ANCHOR: readonly [number, number] = [22, 50];

export const PIN_COLORS = {
  approved: '#12814F', // white glyph 4.9:1
  pendingRing: '#B98300', // dashed ring on white
  pendingInk: '#111418',
  rejected: '#5B6068', // white glyph 6.4:1
  rejectedBadge: '#FF453A',
  highlight: '#F7C948', // gold: highlighted only, never a status
} as const;

// Head: 36px circle (r18) centred at (22,20); the tail tapers to the tip at (22,50).
const PIN_PATH = 'M22 50C20.6 45.5 18 41.8 14.9 36.5A18 18 0 1 1 29.1 36.5C26 41.8 23.4 45.5 22 50Z';
const CLOCK_BADGE =
  '<circle cx="36" cy="7" r="7" fill="#111418" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M36 3.8V7l2.1 1.3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
const CROSS_BADGE =
  '<circle cx="36" cy="7" r="7" fill="#FF453A" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M33.6 4.6l4.8 4.8M38.4 4.6l-4.8 4.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>';
const STAR_BADGE =
  '<circle cx="36" cy="7" r="7" fill="#F7C948" stroke="#fff" stroke-width="1.5"/>' +
  '<path d="M36.00 3.60 L36.88 5.79 L39.23 5.95 L37.43 7.46 L38.00 9.75 L36.00 8.50 L34.00 9.75 L34.57 7.46 L32.77 5.95 L35.12 5.79Z" fill="#3B2A00"/>';

/** A spot's pin variant: approved, rejected, else pending (unknown statuses included). */
export function markerVariant(status: string | undefined): MarkerVariant {
  if (status === 'approved') return 'approved';
  return status === 'rejected' ? 'rejected' : 'pending';
}

/**
 * The pin's HTML: an SVG pin (shown from the city zoom in) and a small status dot (shown when the
 * map is zoomed far out, via the `data-zoom-band="far"` rule in globals.css). Status is never
 * colour-only: pending has a dashed ring and a clock, rejected a cross, highlighted a gold ring and a star.
 */
const VARIANT_LOOK: Readonly<Record<MarkerVariant, { fill: string; ink: string; ring: string; dashed: boolean; badge: string }>> = {
  approved: { fill: PIN_COLORS.approved, ink: '#FFFFFF', ring: '#FFFFFF', dashed: false, badge: '' },
  pending: { fill: '#FFFFFF', ink: PIN_COLORS.pendingInk, ring: PIN_COLORS.pendingRing, dashed: true, badge: CLOCK_BADGE },
  rejected: { fill: PIN_COLORS.rejected, ink: '#FFFFFF', ring: '#FFFFFF', dashed: false, badge: CROSS_BADGE },
};

export function buildPinHtml(o: { category: string | undefined; variant: MarkerVariant; highlighted: boolean }): string {
  const category = normalizeCategory(o.category);
  const look = VARIANT_LOOK[o.variant];
  const fill = look.fill;
  const ink = look.ink;
  const ring = o.highlighted ? PIN_COLORS.highlight : look.ring;
  const dash = look.dashed && !o.highlighted ? ' stroke-dasharray="4 3"' : '';
  const badge = o.highlighted ? STAR_BADGE : look.badge;
  const glyph = glyphToSvgMarkup(CATEGORY_GLYPHS[category], ink);

  return (
    `<div class="spot-pin" data-variant="${o.variant}" data-category="${category}" data-highlighted="${o.highlighted}">` +
    `<svg class="spot-pin__svg" width="44" height="54" viewBox="0 0 44 54" aria-hidden="true" focusable="false">` +
    `<ellipse cx="22" cy="50.6" rx="6" ry="2" fill="#000" opacity=".22"/>` +
    `<path d="${PIN_PATH}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="5.5"/>` +
    `<path d="${PIN_PATH}" fill="${fill}" stroke="${ring}" stroke-width="${o.highlighted ? 3.5 : 3}"${dash}/>` +
    `<g transform="translate(12 10) scale(.8333)" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` +
    badge +
    `</svg>` +
    `<span class="spot-pin__dot"></span>` +
    `</div>`
  );
}

/** Zoom band for the pin CSS: 'far' (country/region view: pins collapse to dots) or 'near'. */
export function zoomBand(zoom: number): 'far' | 'near' {
  return zoom <= 10 ? 'far' : 'near';
}
