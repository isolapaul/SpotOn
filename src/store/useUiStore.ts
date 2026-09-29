import { create } from 'zustand';
import { useMapThemeStore, type MapTheme } from './useMapThemeStore';

/** The one panel or modal page.tsx shows over the map (T29). Opening one replaces the other. */
export type ActivePanel = 'none' | 'auth' | 'addSpot' | 'profile' | 'discovery' | { type: 'spot'; spotId: string };

export function isSpotPanel(p: ActivePanel): p is { type: 'spot'; spotId: string } {
  return typeof p === 'object' && p !== null && p.type === 'spot';
}

interface UiStore {
  activePanel: ActivePanel;
  /** Add-spot location picking. Orthogonal to activePanel: opening a panel does not cancel it. */
  selectingLocation: boolean;
  pendingLocation: { lat: number; lng: number } | null;
  /** Map theme to restore after picking / the add form (not persisted). */
  prevMapTheme: MapTheme | null;
  /** Replaces whatever is open. */
  openPanel: (p: ActivePanel) => void;
  closePanel: () => void;
  /** Closes only while that spot is still the open panel (late effects never close another panel). */
  closeSpotPanel: (spotId: string) => void;
  /** Remembers the theme, switches to satellite and starts picking. */
  startSelectingLocation: (currentTheme: MapTheme) => void;
  cancelSelectingLocation: () => void;
  /** A map click while picking: store the location and open the add form. */
  selectLocation: (loc: { lat: number; lng: number }) => void;
  closeAddSpot: () => void;
  /** A map click outside picking: closes a spot panel and the place card, nothing else. */
  onMapClick: () => void;
  movedBannerVisible: boolean;
  setMovedBannerVisible: (v: boolean) => void;
  /** The spot whose place card shows over the map (design 1E); null = none. */
  previewSpotId: string | null;
  previewSpot: (id: string | null) => void;
  /** Bumped by the locate button: the map re-centres on the user (once the location is known). */
  locateRequest: number;
  requestLocate: () => void;
}

/** Restores the remembered map theme, if any, and forgets it. */
function restoreTheme(prev: MapTheme | null): { prevMapTheme: null } {
  if (prev) useMapThemeStore.getState().setTheme(prev);
  return { prevMapTheme: null };
}

export const useUiStore = create<UiStore>((set, get) => ({
  activePanel: 'none',
  selectingLocation: false,
  pendingLocation: null,
  prevMapTheme: null,
  openPanel: (p) => set({ activePanel: p, previewSpotId: null }),
  closePanel: () => set({ activePanel: 'none' }),
  closeSpotPanel: (spotId) => {
    const p = get().activePanel;
    if (isSpotPanel(p) && p.spotId === spotId) set({ activePanel: 'none' });
  },
  startSelectingLocation: (currentTheme) => {
    set({ prevMapTheme: currentTheme, selectingLocation: true, pendingLocation: null, previewSpotId: null });
    useMapThemeStore.getState().setTheme('satellite');
  },
  cancelSelectingLocation: () => set({ selectingLocation: false, ...restoreTheme(get().prevMapTheme) }),
  selectLocation: (loc) => set({ pendingLocation: loc, selectingLocation: false, activePanel: 'addSpot' }),
  closeAddSpot: () =>
    set({ activePanel: 'none', pendingLocation: null, selectingLocation: false, ...restoreTheme(get().prevMapTheme) }),
  onMapClick: () => {
    if (isSpotPanel(get().activePanel)) set({ activePanel: 'none' });
    if (get().previewSpotId !== null) set({ previewSpotId: null });
  },
  movedBannerVisible: false,
  setMovedBannerVisible: (v: boolean) => set({ movedBannerVisible: v }),
  previewSpotId: null,
  previewSpot: (id) => set({ previewSpotId: id }),
  locateRequest: 0,
  requestLocate: () => set((s) => ({ locateRequest: s.locateRequest + 1 })),
}));

export default useUiStore;
