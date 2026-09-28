// Reads other users' public info from the server-maintained publicProfiles/{uid} mirror (T09/T11a).
// T26: module-level cache (PUBLIC_PROFILE_TTL_MS) plus in-flight de-duplication, so concurrent
// callers share one getDoc and a profile is read at most once per TTL. Public data only (the
// same for every viewer), so the cache never needs clearing on sign-in/out.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PUBLIC_PROFILE_TTL_MS } from '@/lib/constants';

export interface PublicProfile {
  username: string | null;
  profilePictureURL: string | null;
  customNameColor: string | null;
  customNameFont: string | null;
  spotsCount?: number;
  isAdmin?: boolean;
}

interface CacheEntry {
  value: PublicProfile | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PublicProfile | null>>();

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

async function readPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const profile: PublicProfile = {
    username: strOrNull(data.username),
    profilePictureURL: strOrNull(data.profilePictureURL),
    customNameColor: strOrNull(data.customNameColor),
    customNameFont: strOrNull(data.customNameFont),
  };
  if (typeof data.spotsCount === 'number') profile.spotsCount = data.spotsCount;
  if (typeof data.isAdmin === 'boolean') profile.isAdmin = data.isAdmin;
  return profile;
}

function freshEntry(uid: string): CacheEntry | undefined {
  const entry = cache.get(uid);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt >= PUBLIC_PROFILE_TTL_MS) {
    cache.delete(uid);
    return undefined;
  }
  return entry;
}

/**
 * The profile (or `null` for a missing document). Served from the cache while fresh; concurrent
 * calls for one uid share a single request. A failed read is not cached: the error is rethrown
 * and the next call retries.
 */
export function fetchPublicProfile(uid: string): Promise<PublicProfile | null> {
  const hit = freshEntry(uid);
  if (hit) return Promise.resolve(hit.value);
  const pending = inFlight.get(uid);
  if (pending) return pending;

  const request: Promise<PublicProfile | null> = readPublicProfile(uid)
    .then((value) => {
      // Not cached if invalidatePublicProfile ran while this read was in flight (it may be stale).
      if (inFlight.get(uid) === request) cache.set(uid, { value, fetchedAt: Date.now() });
      return value;
    })
    .finally(() => {
      if (inFlight.get(uid) === request) inFlight.delete(uid);
    });
  inFlight.set(uid, request);
  return request;
}

export async function fetchPublicProfiles(uids: string[]): Promise<Record<string, PublicProfile | null>> {
  const unique = [...new Set(uids)];
  const profiles = await Promise.all(unique.map((uid) => fetchPublicProfile(uid)));
  return Object.fromEntries(unique.map((uid, i) => [uid, profiles[i]]));
}

/** The fresh cached value without reading Firestore: a profile, `null` (no document) or `undefined` (not cached). */
export function peekPublicProfile(uid: string): PublicProfile | null | undefined {
  return freshEntry(uid)?.value;
}

/** Drops a uid's cached profile (e.g. after its spotsCount changed), so the next read hits Firestore. */
export function invalidatePublicProfile(uid: string): void {
  cache.delete(uid);
  inFlight.delete(uid);
}

export function __resetPublicProfileCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
