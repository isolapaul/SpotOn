import { useEffect } from 'react';
import { appLinkPath, isNativeApp } from '@/lib/nativeApp';
import { spotIdFromPath } from '@/lib/spotLinks';
import { useUiStore } from '@/store/useUiStore';

/** sessionStorage: the launch link already shown (a reload must not open it again). */
const LAUNCH_LINK_KEY = 'spoton-launch-link';

/** A link that opened the running app: a spot opens in place (no reload: uploads and forms survive). */
function openRunningAppLink(url: string) {
  const path = appLinkPath(url, globalThis.location.origin);
  if (!path) return;
  const spotId = spotIdFromPath(new URL(path, globalThis.location.origin).pathname);
  if (spotId) useUiStore.getState().openSpotLink(spotId);
  else globalThis.location.replace(path);
}

/**
 * The native app shell (Android/iOS, capacitor.config.ts); does nothing in a browser.
 * - Android back: steps back in the app's history (useSystemBack keeps one entry while anything is
 *   open); on the map with nothing open it sends the app to the background, as other apps do.
 * - App Links: a spot link that opens the running app opens the spot in place; one that started the
 *   app loads that page, where useSpotLink opens the spot.
 */
export function useNativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const { App } = await import('@capacitor/app');
      if (cancelled) return;
      handles.push(
        await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) globalThis.history.back();
          else void App.minimizeApp();
        }),
        await App.addListener('appUrlOpen', ({ url }) => openRunningAppLink(url)),
      );
      if (cancelled) {
        handles.forEach((h) => void h.remove());
        return;
      }
      const launch = await App.getLaunchUrl();
      let handled: string | null = null;
      try {
        handled = globalThis.sessionStorage.getItem(LAUNCH_LINK_KEY);
      } catch {
        // storage unavailable: the link may open again after a reload, nothing worse
      }
      if (!launch?.url || launch.url === handled) return;
      try {
        globalThis.sessionStorage.setItem(LAUNCH_LINK_KEY, launch.url);
      } catch {
        // see above
      }
      const path = appLinkPath(launch.url, globalThis.location.origin);
      // Cold start: the page loaded "/"; show the linked page, where useSpotLink opens the spot.
      if (path && path !== `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`) {
        globalThis.location.replace(path);
      }
    })().catch((error: unknown) => console.error('Native shell setup failed:', error));

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, []);
}
