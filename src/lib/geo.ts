// Geographic helpers (T23, DUP-01). Pure: no React, Firebase or DOM.

/** Mean Earth radius in km used by the haversine distance. */
const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance in km between two lat/lng points (haversine). The operation order is the
 * same as the former DiscoveryPanel copy, so results are bit-identical.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
