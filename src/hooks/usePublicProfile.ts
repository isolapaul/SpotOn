import { useEffect, useMemo, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { fetchPublicProfile, peekPublicProfile, type PublicProfile } from '@/store/publicProfiles';

/** `undefined` = loading, failed or no uid; `null` = no profile document. */
export type PublicProfileResult = PublicProfile | null | undefined;

function loadProfile(uid: string): Promise<PublicProfileResult> {
  return fetchPublicProfile(uid).catch((error) => {
    console.error('Failed to fetch public profile:', error);
    return undefined;
  });
}

/**
 * One user's public profile (cached, de-duplicated, one-shot; see store/publicProfiles).
 * For the signed-in user, username, name colour/font and picture are overlaid from the store,
 * so their own changes show immediately; spotsCount always comes from the profile.
 */
export function usePublicProfile(uid?: string): PublicProfileResult {
  const [loaded, setLoaded] = useState<{ uid?: string; value: PublicProfileResult }>(() => ({
    uid,
    value: uid ? peekPublicProfile(uid) : undefined,
  }));

  useEffect(() => {
    if (!uid) return;
    let isMounted = true;
    loadProfile(uid).then((value) => {
      if (isMounted) setLoaded({ uid, value });
    });
    return () => {
      isMounted = false;
    };
  }, [uid]);

  // A result for another uid is never shown; until this uid's read resolves, use the cache.
  let fetched: PublicProfileResult;
  if (!uid) fetched = undefined;
  else if (loaded.uid === uid) fetched = loaded.value;
  else fetched = peekPublicProfile(uid);

  const isSelf = useUserStore((s) => !!uid && s.user?.uid === uid);
  const selfUsername = useUserStore((s) => s.user?.username);
  const selfNameColor = useUserStore((s) => s.user?.customNameColor);
  const selfNameFont = useUserStore((s) => s.user?.customNameFont);
  const selfPicture = useUserStore((s) => s.user?.profilePictureURL);

  return useMemo(() => {
    if (!isSelf) return fetched;
    return {
      ...fetched,
      username: selfUsername ?? null,
      customNameColor: selfNameColor ?? null,
      customNameFont: selfNameFont ?? null,
      profilePictureURL: selfPicture ?? fetched?.profilePictureURL ?? null,
    };
  }, [fetched, isSelf, selfUsername, selfNameColor, selfNameFont, selfPicture]);
}

const KEY_SEPARATOR = ',';

function idsFromKey(key: string): string[] {
  return key ? key.split(KEY_SEPARATOR) : [];
}

/**
 * Several public profiles at once, keyed by uid (falsy uids are ignored). Every uid goes through
 * fetchPublicProfile, so cached ones cost no read and only missing ones are fetched, in parallel.
 * No own-user overlay (reviewer badges read the profile only, as before T26).
 */
export function usePublicProfiles(uids: string[]): Record<string, PublicProfileResult> {
  const key = [...new Set(uids.filter(Boolean))].sort().join(KEY_SEPARATOR);
  const [loaded, setLoaded] = useState<Record<string, PublicProfile | null>>({});

  useEffect(() => {
    const ids = idsFromKey(key);
    if (!ids.length) return;
    let isMounted = true;
    Promise.all(ids.map(loadProfile)).then((values) => {
      if (!isMounted) return;
      const next: Record<string, PublicProfile | null> = {};
      ids.forEach((id, i) => {
        const value = values[i];
        if (value !== undefined) next[id] = value; // a failed read keeps the previous value
      });
      setLoaded((prev) => ({ ...prev, ...next }));
    });
    return () => {
      isMounted = false;
    };
  }, [key]);

  return useMemo(() => {
    const result: Record<string, PublicProfileResult> = {};
    for (const id of idsFromKey(key)) {
      result[id] = Object.prototype.hasOwnProperty.call(loaded, id) ? loaded[id] : peekPublicProfile(id);
    }
    return result;
  }, [key, loaded]);
}
