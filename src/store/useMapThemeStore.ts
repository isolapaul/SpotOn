import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { withCartoKey } from '@/lib/mapTiles';

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

// Build-time, public (CARTO keys are sent with every tile request anyway).
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

// Leaflet tile layer configs for each theme. `detectRetina`: providers without @2x tiles load the
// next zoom level at half size on high-DPI screens, instead of upscaling 256px tiles (pixelated on
// phones). CARTO serves real @2x tiles through `{r}`. Leaflet's detectRetina lowers the layer's
// maxZoom by one, so those layers declare 19 to keep the usual closest zoom (18 on screen, z19 tiles).
interface ThemeLayer {
  url: string;
  attribution: string;
  className?: string;
  detectRetina?: boolean;
  maxZoom?: number;
}

export const mapThemes: Record<MapTheme, ThemeLayer> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    detectRetina: true,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  light: {
    url: withCartoKey('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', CARTO_KEY),
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  dark: {
    url: withCartoKey('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', CARTO_KEY),
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  silver: {
    url: withCartoKey('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', CARTO_KEY),
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    detectRetina: true,
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
};
