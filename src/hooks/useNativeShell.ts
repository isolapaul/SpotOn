import { useEffect, useState } from 'react';
import { APP_BUILD, SITE_URL } from '@/lib/constants';
import { appLinkPath, isNativeApp, nativePlatform } from '@/lib/nativeApp';
import { openAppPath } from './appPaths';

/** sessionStorage: the launch link already shown (a reload must not open it again). */
const LAUNCH_LINK_KEY = 'spoton-launch-link';

/** A link that opened the running app: a spot, profile or the feed opens in place (openAppPath). */
function openRunningAppLink(url: string) {
  const path = linkPath(url);
  if (!path) return;
  if (!openAppPath(path) && !APP_BUILD) globalThis.location.replace(path);
}

/** The in-app path of a link to the site (or to the page's own origin, a live-site build). */
function linkPath(url: string): string | null {
  return appLinkPath(url, SITE_URL) ?? appLinkPath(url, globalThis.location.origin);
}

/**
 * The native app shell (Android/iOS, capacitor.config.ts); does nothing in a browser.
 * - Android back: steps back in the app's history (useSystemBack keeps one entry while anything is
 *   open); on the map with nothing open it sends the app to the background, as other apps do.
 * - App Links / Universal Links: a spot, profile or feed link that opens the running app opens it
 *   in place; one that started the app loads that page, where useSpotLink opens it.
 * - `<html data-app="ios|android">`: the apps' own motion in globals.css (springier presses and
 *   sheets, the splash zooming into the map).
 */
export function useNativeShell(ready: boolean) {
  // The link that started the app opens once the app is ready (the map and the spots are there).
  const [launchPath, setLaunchPath] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !launchPath) return;
    // The bundled app has only "/": everything opens in place. A live-site shell loads the page.
    if (!openAppPath(launchPath) && !APP_BUILD) globalThis.location.replace(launchPath);
  }, [ready, launchPath]);

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.app = nativePlatform() ?? 'app';
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
      const path = linkPath(launch.url);
      if (path && path !== `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`) {
        setLaunchPath(path);
      }
    })().catch((error: unknown) => console.error('Native shell setup failed:', error));

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, []);
}
