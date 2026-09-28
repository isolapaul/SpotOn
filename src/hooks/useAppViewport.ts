import { useEffect } from 'react';
import { computeAppHeight } from '@/lib/appViewport';

/**
 * Installed iOS app only: sets --app-h (the height of the app root and full-screen layers, Tailwind
 * `h-app`) to the real screen height, so the app reaches the bottom edge (design 1A). Elsewhere the
 * CSS default (100dvh) stays. Only a CSS custom property changes, so the CSP is unaffected.
 */
export function useAppViewport() {
  useEffect(() => {
    const nav = globalThis.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone !== true) return;
    const root = document.documentElement;
    const apply = () => {
      const height = computeAppHeight({
        standalone: true,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      });
      if (height === null) root.style.removeProperty('--app-h');
      else root.style.setProperty('--app-h', `${height}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}
