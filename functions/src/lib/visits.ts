/**
 * "I was here" (growth plan §4), pure: a visit counts when the reported position is close to the
 * spot. The position comes from the device (it can be faked, as any check-in can), so the server
 * keeps the rule simple and rate-limited.
 */
export const VISIT_RADIUS_M = 300;
/** A position less precise than this is not good enough. */
export const VISIT_MAX_ACCURACY_M = 150;

type LatLng = {lat: number; lng: number};

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A {lat, lng} within range, else null. */
export function parsePosition(x: unknown): LatLng | null {
  if (typeof x !== "object" || x === null) return null;
  const {lat, lng} = x as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return {lat, lng};
}

/** Whether a position (with its accuracy in metres) is close enough to the spot. */
export function closeEnough(spot: LatLng, at: LatLng, accuracy: unknown): boolean {
  const acc = typeof accuracy === "number" && accuracy >= 0 ? accuracy : 0;
  if (acc > VISIT_MAX_ACCURACY_M) return false;
  return distanceM(spot, at) <= VISIT_RADIUS_M + acc;
}
