import type { Spot } from '@/store/useSpotStore';

/** The spot lists of the three spots listeners (T30). A stopped or not-yet-loaded source is `[]`. */
export interface SpotSources {
  /** All spots (admins only). */
  admin: readonly Spot[];
  /** The signed-in user's own spots, any status. */
  own: readonly Spot[];
  /** Approved spots (everyone). */
  approved: readonly Spot[];
}

type TimestampLike = { seconds: number; nanoseconds: number };

function isTimestamp(value: unknown): value is TimestampLike {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { seconds?: unknown; nanoseconds?: unknown; toMillis?: unknown };
  return typeof v.seconds === 'number' && typeof v.nanoseconds === 'number' && typeof v.toMillis === 'function';
}

// Sort groups (as the spec asks): a null createdAt (a pending serverTimestamp of a local write) first,
// then Timestamps (newest first), then any other createdAt type. This is an approximation of Firestore's
// descending order, which puts strings/maps before Timestamps and a stored null last; only legacy or
// hand-edited data has such values. Documents without createdAt never reach the client
// (orderBy('createdAt') excludes them).
function group(createdAt: unknown): 0 | 1 | 2 {
  if (createdAt === null) return 0;
  return isTimestamp(createdAt) ? 1 : 2;
}

/**
 * Document id descending: the implicit `__name__ DESC` tie-breaker of orderBy('createdAt', 'desc').
 * Compared by UTF-16 code units, which matches Firestore's order for ASCII ids such as auto-IDs.
 */
function byIdDesc(a: Spot, b: Spot): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function compareSpots(a: Spot, b: Spot): number {
  const ga = group(a.createdAt);
  const gb = group(b.createdAt);
  if (ga !== gb) return ga - gb;
  if (ga === 1) {
    const ta = a.createdAt as TimestampLike;
    const tb = b.createdAt as TimestampLike;
    if (ta.seconds !== tb.seconds) return tb.seconds - ta.seconds;
    if (ta.nanoseconds !== tb.nanoseconds) return tb.nanoseconds - ta.nanoseconds;
  }
  return byIdDesc(a, b);
}

/**
 * Union of the listener results by spot id, ordered like Firestore's orderBy('createdAt', 'desc').
 * When a spot is in several sources (the same document, possibly from different snapshot times), the
 * copy from the widest source wins: admin > own > approved.
 */
export function mergeSpotSources({ admin, own, approved }: SpotSources): Spot[] {
  const byId = new Map<string, Spot>();
  for (const source of [admin, own, approved]) {
    for (const spot of source) {
      if (!byId.has(spot.id)) byId.set(spot.id, spot);
    }
  }
  return [...byId.values()].sort(compareSpots);
}
