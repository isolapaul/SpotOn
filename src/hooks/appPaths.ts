import { spotIdFromPath, userIdFromPath } from '@/lib/spotLinks';
import { useUiStore } from '@/store/useUiStore';
import { runViewTransition } from './viewTransition';

/**
 * Opens an in-app address in place (no reload, so uploads and forms survive): a spot flies to its
 * place card, a profile opens, /feed opens the feed. False for any other address.
 */
export function openAppPath(path: string): boolean {
  const pathname = new URL(path, 'https://app.invalid').pathname;
  const spotId = spotIdFromPath(pathname);
  if (spotId) {
    useUiStore.getState().openSpotLink(spotId);
    return true;
  }
  const uid = userIdFromPath(pathname);
  if (uid) {
    runViewTransition(() => useUiStore.getState().openUserProfile(uid));
    return true;
  }
  if (/^\/feed\/?$/.test(pathname)) {
    runViewTransition(() => useUiStore.getState().openPanel('feed'));
    return true;
  }
  return false;
}
