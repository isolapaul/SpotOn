// Pure helpers for spot highlights (T11b). No Firebase/React imports: types only.
import type { Spot } from '@/store/useSpotStore';
import type { TranslationKey } from './translations';

type HighlightEntry = NonNullable<Spot['highlighted']>[number];

/** A highlight entry is active until its expiresAt (ISO string). */
export function isActiveHighlight(entry: Pick<HighlightEntry, 'expiresAt'>, now: Date = new Date()): boolean {
  return Date.parse(entry.expiresAt) > now.getTime();
}

/** Whether `uid` has an active highlight on `spot`. */
export function isHighlightedBy(spot: Pick<Spot, 'highlighted'>, uid: string, now?: Date): boolean {
  return (spot.highlighted ?? []).some((h) => h.userId === uid && isActiveHighlight(h, now));
}

/** Server refusal reasons (highlightSpot HttpsError `details.reason`, BUG-28) → translation keys. */
const HIGHLIGHT_REFUSAL_KEYS: Readonly<Record<string, TranslationKey>> = {
  'not-found': 'highlightSpotNotFound',
  'not-owner': 'highlightNotOwner',
  'not-approved': 'highlightNotApproved',
  'already-highlighted': 'highlightAlready',
  'level-too-low': 'highlightLevelTooLow',
  'limit-reached': 'highlightLimitReached',
};

/** Translation key for a highlightSpot refusal, or undefined (unknown reason or another error). */
export function highlightErrorKey(error: unknown): TranslationKey | undefined {
  const details = typeof error === 'object' && error !== null ? (error as { details?: unknown }).details : undefined;
  const reason = typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  return typeof reason === 'string' && Object.hasOwn(HIGHLIGHT_REFUSAL_KEYS, reason)
    ? HIGHLIGHT_REFUSAL_KEYS[reason]
    : undefined;
}
