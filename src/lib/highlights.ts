// Pure helpers for spot highlights (T11b). No Firebase/React imports: types only.
import type { Spot } from '@/store/useSpotStore';

type HighlightEntry = NonNullable<Spot['highlighted']>[number];

/** A highlight entry is active until its expiresAt (ISO string). */
export function isActiveHighlight(entry: Pick<HighlightEntry, 'expiresAt'>, now: Date = new Date()): boolean {
  return Date.parse(entry.expiresAt) > now.getTime();
}

/** Whether `uid` has an active highlight on `spot`. */
export function isHighlightedBy(spot: Pick<Spot, 'highlighted'>, uid: string, now?: Date): boolean {
  return (spot.highlighted ?? []).some((h) => h.userId === uid && isActiveHighlight(h, now));
}
