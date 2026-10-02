// Explore's "new this week" filter. Pure.
import type { DateInput } from './dates';

export const NEW_SPOT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Epoch ms of a Timestamp / Date / number / string; null when missing or invalid. */
export function toMillis(ts: DateInput): number | null {
  if (ts === null || ts === undefined || ts === '') return null;
  const ms = typeof ts === 'object' && 'toDate' in ts ? ts.toDate().getTime() : new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** When the spot appeared on the map: its approval, or (for spots approved before approvedAt existed) its creation. */
export function publishedAt(spot: { approvedAt?: DateInput; createdAt: DateInput }): number | null {
  return toMillis(spot.approvedAt) ?? toMillis(spot.createdAt);
}

/** Appeared within the last 7 days. */
export function isNewThisWeek(spot: { approvedAt?: DateInput; createdAt: DateInput }, now: number): boolean {
  const at = publishedAt(spot);
  return at !== null && at <= now + 60_000 && now - at <= NEW_SPOT_WINDOW_MS;
}
