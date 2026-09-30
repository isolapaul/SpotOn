import { create } from 'zustand';
import { useMapThemeStore, type MapTheme } from './useMapThemeStore';

/** The one panel or modal page.tsx shows over the map (T29). Opening one replaces the other. */
export type ActivePanel = 'none' | 'auth' | 'addSpot' | 'profile' | 'discovery' | { type: 'spot'; spotId: string };

/** Where "back" from a spot returns to: the list it was opened from. */
export type ReturnTarget = 'profile' | 'discovery';

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
  /** Replaces whatever is open. Only the details of the previewed spot keep the way back. */
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
  /** A pin tap (or null): shows that spot's card; the way back to a list is dropped. */
  previewSpot: (id: string | null) => void;
  /** Bumped by the locate button: the map re-centres on the user (once the location is known). */
  locateRequest: number;
  requestLocate: () => void;

  /** The list the shown spot was opened from; "back" returns there. */
  returnTo: ReturnTarget | null;
  /** The map flies to this spot; each request has a new `seq`. */
  focusRequest: { spotId: string; seq: number } | null;
  /**
   * Opens a spot from a list. From the profile: the profile closes, the map flies to the spot and
   * its place card opens on arrival (arriveAtSpot). From Explore: the details open over it.
   */
  openSpotFromList: (spotId: string, from: ReturnTarget) => void;
  /** The map reached the focused spot: show its card, unless something else was opened meanwhile. */
  arriveAtSpot: (spotId: string) => void;
  /** Closing the details: back to Explore when opened from there, else the map stays at the spot. */
  closeSpot: () => void;
  /** Back (the back buttons and the system back): one step up, else close what is open. */
  goBack: () => void;
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
  openPanel: (p) => {
    const { previewSpotId, returnTo } = get();
    const keepsWayBack = isSpotPanel(p) && p.spotId === previewSpotId;
    set({ activePanel: p, previewSpotId: null, returnTo: keepsWayBack ? returnTo : null });
  },
  closePanel: () => set({ activePanel: 'none', returnTo: null }),
  closeSpotPanel: (spotId) => {
    const p = get().activePanel;
    if (isSpotPanel(p) && p.spotId === spotId) set({ activePanel: 'none', returnTo: null });
  },
  startSelectingLocation: (currentTheme) => {
    set({ prevMapTheme: currentTheme, selectingLocation: true, pendingLocation: null, previewSpotId: null, returnTo: null });
    useMapThemeStore.getState().setTheme('satellite');
  },
  cancelSelectingLocation: () => set({ selectingLocation: false, ...restoreTheme(get().prevMapTheme) }),
  selectLocation: (loc) => set({ pendingLocation: loc, selectingLocation: false, activePanel: 'addSpot' }),
  closeAddSpot: () =>
    set({ activePanel: 'none', pendingLocation: null, selectingLocation: false, ...restoreTheme(get().prevMapTheme) }),
  onMapClick: () => {
    if (isSpotPanel(get().activePanel)) set({ activePanel: 'none' });
    if (get().previewSpotId !== null) set({ previewSpotId: null });
    if (get().returnTo !== null) set({ returnTo: null });
  },
  movedBannerVisible: false,
  setMovedBannerVisible: (v: boolean) => set({ movedBannerVisible: v }),
  previewSpotId: null,
  previewSpot: (id) => set({ previewSpotId: id, returnTo: null }),
  locateRequest: 0,
  requestLocate: () => set((s) => ({ locateRequest: s.locateRequest + 1 })),

  returnTo: null,
  focusRequest: null,
  openSpotFromList: (spotId, from) => {
    if (from === 'discovery') {
      set({ activePanel: { type: 'spot', spotId }, previewSpotId: null, returnTo: 'discovery' });
      return;
    }
    const seq = (get().focusRequest?.seq ?? 0) + 1;
    set({ activePanel: 'none', previewSpotId: null, returnTo: 'profile', focusRequest: { spotId, seq } });
  },
  arriveAtSpot: (spotId) => {
    const { focusRequest, activePanel, returnTo } = get();
    if (focusRequest?.spotId !== spotId || activePanel !== 'none') return;
    // previewSpot would drop the way back; this card keeps it.
    set({ previewSpotId: spotId, returnTo });
  },
  closeSpot: () =>
    set(get().returnTo === 'discovery' ? { activePanel: 'discovery', returnTo: null } : { activePanel: 'none', returnTo: null }),
  goBack: () => {
    const s = get();
    if (s.activePanel === 'addSpot') return s.closeAddSpot();
    if (s.activePanel === 'none' && s.previewSpotId === null && s.selectingLocation) return s.cancelSelectingLocation();
    const onSpot = isSpotPanel(s.activePanel) || s.previewSpotId !== null;
    set({ activePanel: onSpot && s.returnTo ? s.returnTo : 'none', previewSpotId: null, returnTo: null });
  },
}));

/** Whether something is open that "back" can close (the system back is taken over while it is). */
export function hasBackStep(s: Pick<UiStore, 'activePanel' | 'previewSpotId' | 'selectingLocation'>): boolean {
  return s.activePanel !== 'none' || s.previewSpotId !== null || s.selectingLocation;
}
