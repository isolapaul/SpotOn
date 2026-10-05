import { useEffect } from 'react';
import { appLinkPath, isNativeApp } from '@/lib/nativeApp';

/** sessionStorage: the launch link already shown (a reload must not open it again). */
const LAUNCH_LINK_KEY = 'spoton-launch-link';

function openAppLink(url: string, replace: boolean) {
  const path = appLinkPath(url, globalThis.location.origin);
  if (!path) return;
  if (replace) globalThis.location.replace(path);
  else globalThis.location.assign(path);
}

/**
 * The native app shell (Android/iOS, capacitor.config.ts); does nothing in a browser.
 * - Android back: steps back in the app's history (useSystemBack keeps one entry while anything is
 *   open); on the map with nothing open it sends the app to the background, as other apps do.
 * - App Links: a spot link that opened the app (cold start or while running) shows that page, where
 *   useSpotLink opens the spot.
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
        await App.addListener('appUrlOpen', ({ url }) => openAppLink(url, false)),
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
      if (path && path !== `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`) {
        openAppLink(launch.url, true);
      }
    })().catch((error: unknown) => console.error('Native shell setup failed:', error));

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, []);
}
