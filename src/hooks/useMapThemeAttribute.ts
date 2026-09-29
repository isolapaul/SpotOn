import { useEffect } from 'react';
import { useMapThemeStore } from '@/store/useMapThemeStore';

/**
 * Mirrors the map theme on <html data-map-theme>, so the page background (--map-bg in globals.css)
 * matches the tiles: no black or grey strip while tiles load or under the iOS status bar (design 1A).
 */
export function useMapThemeAttribute() {
  const theme = useMapThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.mapTheme = theme;
  }, [theme]);
}
