// Tile URL helpers for the map themes. Pure.

/**
 * Adds the CARTO basemaps API key to a cartocdn tile URL (`?key=…`). Since 2026-09 CARTO stamps
 * keyless raster tiles with an "API KEY REQUIRED" watermark. Other URLs, or no key, stay as they are.
 */
export function withCartoKey(url: string, key: string | undefined): string {
  const k = key?.trim();
  if (!k || !url.includes('.basemaps.cartocdn.com/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(k)}`;
}
