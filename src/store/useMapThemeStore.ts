import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The map styles themselves (Mapbox) are in lib/mapStyles.
export type MapTheme = 'standard' | 'dark' | 'light' | 'silver' | 'satellite';

interface MapThemeStore {
  theme: MapTheme;
  setTheme: (theme: MapTheme) => void;
}

export const useMapThemeStore = create<MapThemeStore>()(
  persist(
    (set) => ({
      theme: 'standard',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'spoton-map-theme',
    }
  )
);
