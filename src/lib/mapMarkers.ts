// Map marker SVG and size (T23). Pure string building: MapView keeps L.divIcon and the icon cache.
import { MARKER_COLORS, getMarkerEmoji } from './categories';

export type MarkerStatus = 'approved' | 'pending' | 'rejected';

/**
 * Marker SVG markup for a spot. Byte-identical to MapView's former getCategoryIcon html
 * (whitespace included): the characterisation test compares it with the oracle.
 */
export function buildMarkerSvg(category: string, status: MarkerStatus, isHighlighted: boolean, size: number): string {
  const emoji = getMarkerEmoji(category);
  let bgColor: string = status === 'approved' ? MARKER_COLORS.approved : MARKER_COLORS.other;
  if (isHighlighted) bgColor = MARKER_COLORS.highlighted;

  const svg = isHighlighted
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="28" cy="28" r="24" fill="${bgColor}" stroke="#FFA500" stroke-width="3" filter="url(#glow)"/>
        <text x="28" y="35" font-size="22" text-anchor="middle">${emoji}</text>
        <text x="46" y="14" font-size="18">⭐</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="${bgColor}" opacity="0.9"/>
        <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${emoji}</text>
      </svg>`;

  return svg;
}

/** Marker size in px for a map zoom level (highlighted markers are scaled by MapView). */
export function getMarkerSize(zoom: number): number {
  if (zoom <= 5) return 24;
  if (zoom <= 10) return 32;
  if (zoom <= 14) return 48;
  if (zoom <= 18) return 64;
  return 80;
}
