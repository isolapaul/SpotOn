import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real map theme store persists to localStorage (absent in the node test environment):
// replace it with a plain store so theme changes can be asserted.
vi.mock('@/store/useMapThemeStore', async () => {
  const { create } = await import('zustand');
  type MapTheme = 'standard' | 'dark' | 'light' | 'silver' | 'satellite';
  const useMapThemeStore = create<{ theme: MapTheme; setTheme: (theme: MapTheme) => void }>((set) => ({
    theme: 'standard',
    setTheme: (theme) => set({ theme }),
  }));
  return { useMapThemeStore };
});

import { useMapThemeStore } from '@/store/useMapThemeStore';
import { isSpotPanel, useUiStore, type ActivePanel } from './useUiStore';

const theme = () => useMapThemeStore.getState().theme;
const ui = () => useUiStore.getState();
const spot = (spotId: string): ActivePanel => ({ type: 'spot', spotId });

beforeEach(() => {
  useUiStore.setState({
    activePanel: 'none',
    selectingLocation: false,
    pendingLocation: null,
    prevMapTheme: null,
    movedBannerVisible: false,
    previewSpotId: null,
    locateRequest: 0,
  });
  useMapThemeStore.setState({ theme: 'dark' });
});

describe('isSpotPanel', () => {
  it('is true only for a spot panel', () => {
    expect(isSpotPanel(spot('a'))).toBe(true);
    for (const p of ['none', 'auth', 'addSpot', 'profile', 'discovery'] as const) expect(isSpotPanel(p)).toBe(false);
  });
});

describe('openPanel / closePanel', () => {
  it('starts with nothing open', () => {
    expect(ui().activePanel).toBe('none');
  });

  it('opening a panel replaces whatever is open', () => {
    ui().openPanel('profile');
    expect(ui().activePanel).toBe('profile');
    ui().openPanel('auth');
    expect(ui().activePanel).toBe('auth');
    ui().openPanel('discovery');
    ui().openPanel(spot('s1'));
    expect(ui().activePanel).toEqual(spot('s1'));
  });

  it('closePanel always returns to none', () => {
    for (const p of ['auth', 'addSpot', 'profile', 'discovery', spot('s1')] as ActivePanel[]) {
      ui().openPanel(p);
      ui().closePanel();
      expect(ui().activePanel).toBe('none');
    }
  });

  it('opening a panel does not cancel location selection (orthogonal)', () => {
    ui().startSelectingLocation('dark');
    ui().openPanel('profile');
    ui().openPanel('discovery');
    ui().openPanel(spot('s1'));
    ui().closePanel();
    expect(ui().selectingLocation).toBe(true);
    expect(theme()).toBe('satellite');
  });
});

describe('closeSpotPanel', () => {
  it('closes that spot', () => {
    ui().openPanel(spot('s1'));
    ui().closeSpotPanel('s1');
    expect(ui().activePanel).toBe('none');
  });

  it('leaves another spot or another panel open', () => {
    ui().openPanel(spot('s2'));
    ui().closeSpotPanel('s1');
    expect(ui().activePanel).toEqual(spot('s2'));
    for (const p of ['none', 'auth', 'addSpot', 'profile', 'discovery'] as const) {
      ui().openPanel(p);
      ui().closeSpotPanel('s1');
      expect(ui().activePanel).toBe(p);
    }
  });
});

describe('onMapClick', () => {
  it('closes an open spot panel', () => {
    ui().openPanel(spot('s1'));
    ui().onMapClick();
    expect(ui().activePanel).toBe('none');
  });

  it('changes nothing for other panels', () => {
    for (const p of ['none', 'profile', 'discovery', 'auth', 'addSpot'] as const) {
      ui().openPanel(p);
      ui().onMapClick();
      expect(ui().activePanel).toBe(p);
    }
  });
});

describe('add-spot location selection', () => {
  it('start remembers the theme, switches to satellite and clears a previous location', () => {
    useUiStore.setState({ pendingLocation: { lat: 1, lng: 2 } });
    ui().startSelectingLocation('dark');
    expect(ui()).toMatchObject({ selectingLocation: true, pendingLocation: null, prevMapTheme: 'dark' });
    expect(theme()).toBe('satellite');
    expect(ui().activePanel).toBe('none');
  });

  it('cancel stops selecting and restores the theme', () => {
    ui().startSelectingLocation('dark');
    ui().cancelSelectingLocation();
    expect(ui()).toMatchObject({ selectingLocation: false, prevMapTheme: null });
    expect(theme()).toBe('dark');
  });

  it('cancel without a remembered theme leaves the theme alone', () => {
    useUiStore.setState({ selectingLocation: true, prevMapTheme: null });
    useMapThemeStore.setState({ theme: 'silver' });
    ui().cancelSelectingLocation();
    expect(ui().selectingLocation).toBe(false);
    expect(theme()).toBe('silver');
  });

  it('selectLocation stores the location, stops selecting and opens the add form (satellite kept)', () => {
    ui().openPanel('profile');
    ui().startSelectingLocation('light');
    ui().selectLocation({ lat: 47.5, lng: 19 });
    expect(ui()).toMatchObject({
      selectingLocation: false,
      pendingLocation: { lat: 47.5, lng: 19 },
      activePanel: 'addSpot',
      prevMapTheme: 'light',
    });
    expect(theme()).toBe('satellite');
  });

  it('closing the add form after a selection clears everything and restores the theme', () => {
    ui().startSelectingLocation('light');
    ui().selectLocation({ lat: 47.5, lng: 19 });
    ui().closeAddSpot();
    expect(ui()).toMatchObject({ activePanel: 'none', pendingLocation: null, selectingLocation: false, prevMapTheme: null });
    expect(theme()).toBe('light');
  });

  it('closing the add form without a remembered theme leaves the theme alone', () => {
    useUiStore.setState({ activePanel: 'addSpot', pendingLocation: { lat: 1, lng: 2 }, prevMapTheme: null });
    useMapThemeStore.setState({ theme: 'satellite' });
    ui().closeAddSpot();
    expect(ui()).toMatchObject({ activePanel: 'none', pendingLocation: null, selectingLocation: false });
    expect(theme()).toBe('satellite');
  });

  it('starting again while selecting remembers the current (satellite) theme, as before T29', () => {
    ui().startSelectingLocation('dark');
    ui().startSelectingLocation(theme());
    ui().cancelSelectingLocation();
    expect(theme()).toBe('satellite');
  });
});

describe('movedBannerVisible (T19)', () => {
  it('is still present and settable', () => {
    expect(ui().movedBannerVisible).toBe(false);
    ui().setMovedBannerVisible(true);
    expect(ui().movedBannerVisible).toBe(true);
    ui().setMovedBannerVisible(false);
    expect(ui().movedBannerVisible).toBe(false);
  });
});

describe('place card (design 1E)', () => {
  it('previewSpot shows and hides a card', () => {
    ui().previewSpot('a');
    expect(ui().previewSpotId).toBe('a');
    ui().previewSpot(null);
    expect(ui().previewSpotId).toBeNull();
  });

  it('a map click, opening a panel and starting to add a spot each close the card', () => {
    ui().previewSpot('a');
    ui().onMapClick();
    expect(ui().previewSpotId).toBeNull();

    ui().previewSpot('a');
    ui().openPanel(spot('a'));
    expect(ui().previewSpotId).toBeNull();
    expect(ui().activePanel).toEqual(spot('a'));

    ui().previewSpot('b');
    ui().startSelectingLocation('dark');
    expect(ui().previewSpotId).toBeNull();
  });
});

describe('requestLocate (design 1C)', () => {
  it('bumps a counter the map reacts to', () => {
    ui().requestLocate();
    ui().requestLocate();
    expect(ui().locateRequest).toBe(2);
  });
});
