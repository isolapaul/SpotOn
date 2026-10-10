import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { spotIdFromPath, userIdFromPath } from '@/lib/spotLinks';
import { useT } from './useT';

/** How long a link waits for its spot (signed-in users' own pending spots load after sign-in). */
const WAIT_MS = 6000;

/**
 * A shared link (/spot/<id>): once the app is ready, the map flies to the spot and its card opens.
 * The address goes back to "/" (back and reload behave as in the app). A spot the user cannot
 * see (pending, rejected, deleted) gives a notice instead.
 */
export function useSpotLink(isAppReady: boolean, visibleIds: ReadonlySet<string>) {
  const pathname = usePathname();
  const t = useT();
  // The linked id, read once from the first address.
  const [linked] = useState(() => spotIdFromPath(pathname));
  // A profile link (/user/<uid>, from a follow push) opens that profile instead.
  const [linkedUser] = useState(() => userIdFromPath(pathname));
  const visibleRef = useRef(visibleIds);
  useEffect(() => {
    visibleRef.current = visibleIds;
  }, [visibleIds]);

  useEffect(() => {
    if (!linkedUser || !isAppReady) return;
    globalThis.history.replaceState(globalThis.history.state, '', '/');
    useUiStore.getState().openUserProfile(linkedUser);
  }, [isAppReady, linkedUser]);

  useEffect(() => {
    if (!linked || !isAppReady) return;
    globalThis.history.replaceState(globalThis.history.state, '', '/');
    useUiStore.getState().openSpotLink(linked);
    const timer = setTimeout(() => {
      if (!visibleRef.current.has(linked)) useToastStore.getState().showToast(t('spotLinkUnavailable'), 'info');
    }, WAIT_MS);
    return () => clearTimeout(timer);
    // Once, when the app is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppReady]);
}
