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
import { hasBackStep, isSpotPanel, useUiStore, type ActivePanel } from './useUiStore';

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
    returnTo: null,
    focusRequest: null,
    relocatingSpotId: null,
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

describe('opening a spot from a list, and back', () => {
  it('from the profile: closes it, asks the map to fly, and shows the card on arrival', () => {
    ui().openPanel('profile');
    ui().openSpotFromList('s1', 'profile');
    expect(ui()).toMatchObject({ activePanel: 'none', previewSpotId: null, returnTo: 'profile', focusRequest: { spotId: 's1', seq: 1 } });
    ui().arriveAtSpot('s1');
    expect(ui()).toMatchObject({ previewSpotId: 's1', returnTo: 'profile' });
    ui().openSpotFromList('s1', 'profile');
    expect(ui().focusRequest).toEqual({ spotId: 's1', seq: 2 });
  });

  it('an arrival after something else was opened, or for another spot, shows nothing', () => {
    ui().openSpotFromList('s1', 'profile');
    ui().openPanel('discovery');
    ui().arriveAtSpot('s1');
    expect(ui().previewSpotId).toBeNull();
    ui().closePanel();
    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s2');
    expect(ui().previewSpotId).toBeNull();
  });

  it('back from the card or from its details returns to the profile', () => {
    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s1');
    ui().goBack();
    expect(ui()).toMatchObject({ activePanel: 'profile', previewSpotId: null, returnTo: null });

    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s1');
    ui().openPanel(spot('s1')); // Details from the card keeps the way back
    expect(ui().returnTo).toBe('profile');
    ui().goBack();
    expect(ui().activePanel).toBe('profile');
  });

  it('closing (swipe down, ×, a map tap) stays on the map', () => {
    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s1');
    ui().previewSpot(null);
    expect(ui()).toMatchObject({ activePanel: 'none', previewSpotId: null, returnTo: null });

    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s1');
    ui().openPanel(spot('s1'));
    ui().closeSpot();
    expect(ui()).toMatchObject({ activePanel: 'none', returnTo: null });
  });

  it('a spot opened from Explore returns to Explore on close and on back', () => {
    ui().openPanel('discovery');
    ui().openSpotFromList('s1', 'discovery');
    expect(ui()).toMatchObject({ activePanel: spot('s1'), returnTo: 'discovery' });
    ui().closeSpot();
    expect(ui()).toMatchObject({ activePanel: 'discovery', returnTo: null });
    ui().openSpotFromList('s1', 'discovery');
    ui().goBack();
    expect(ui().activePanel).toBe('discovery');
  });

  it('another pin or panel drops the way back', () => {
    ui().openSpotFromList('s1', 'profile');
    ui().arriveAtSpot('s1');
    ui().previewSpot('s2');
    expect(ui().returnTo).toBeNull();
    ui().openSpotFromList('s1', 'discovery');
    ui().openPanel('profile');
    expect(ui().returnTo).toBeNull();
  });

  it('back without a way back closes what is open, the add form and the picking included', () => {
    ui().openPanel('profile');
    ui().goBack();
    expect(ui().activePanel).toBe('none');
    ui().previewSpot('s1');
    ui().goBack();
    expect(ui().previewSpotId).toBeNull();

    ui().startSelectingLocation('dark');
    ui().goBack();
    expect(ui().selectingLocation).toBe(false);
    expect(theme()).toBe('dark');

    ui().startSelectingLocation('light');
    ui().selectLocation({ lat: 1, lng: 2 });
    ui().goBack();
    expect(ui()).toMatchObject({ activePanel: 'none', pendingLocation: null });
    expect(theme()).toBe('light');
  });

  it('hasBackStep is true while anything is open', () => {
    expect(hasBackStep(ui())).toBe(false);
    ui().previewSpot('s1');
    expect(hasBackStep(ui())).toBe(true);
    ui().previewSpot(null);
    ui().startSelectingLocation('dark');
    expect(hasBackStep(ui())).toBe(true);
    ui().cancelSelectingLocation();
    ui().openPanel('auth');
    expect(hasBackStep(ui())).toBe(true);
  });
});

describe('relocating a spot (item 4 edit)', () => {
  it('leaves the spot for satellite picking, and a pick or a cancel returns to it with the theme', () => {
    ui().openPanel(spot('s1'));
    ui().startRelocating('s1', 'dark');
    expect(ui()).toMatchObject({ relocatingSpotId: 's1', selectingLocation: true, activePanel: 'none' });
    expect(theme()).toBe('satellite');
    ui().finishRelocating();
    expect(ui()).toMatchObject({ relocatingSpotId: null, selectingLocation: false, activePanel: spot('s1') });
    expect(theme()).toBe('dark');

    ui().startRelocating('s1', 'light');
    ui().cancelSelectingLocation();
    expect(ui()).toMatchObject({ relocatingSpotId: null, activePanel: spot('s1') });
    expect(theme()).toBe('light');

    ui().startRelocating('s1', 'light');
    ui().goBack();
    expect(ui().activePanel).toEqual(spot('s1'));
  });
});

describe('requestLocate (design 1C)', () => {
  it('bumps a counter the map reacts to', () => {
    ui().requestLocate();
    ui().requestLocate();
    expect(ui().locateRequest).toBe(2);
  });
});

describe('user profiles (item 8)', () => {
  beforeEach(() => useUiStore.setState({ activePanel: 'none', previewSpotId: null, returnTo: null, userFrom: null }));
  it('back from a profile opened in Explore returns to Explore', () => {
    useUiStore.getState().openPanel('discovery');
    useUiStore.getState().openUserProfile('u1');
    expect(useUiStore.getState().activePanel).toEqual({ type: 'user', uid: 'u1' });
    useUiStore.getState().goBack();
    expect(useUiStore.getState().activePanel).toBe('discovery');
  });
  it('a spot opened from a profile flies there, and back returns to the profile', () => {
    useUiStore.getState().openUserProfile('u1');
    useUiStore.getState().openSpotFromList('s1', { type: 'user', uid: 'u1' });
    expect(useUiStore.getState()).toMatchObject({ activePanel: 'none', focusRequest: { spotId: 's1' } });
    useUiStore.getState().arriveAtSpot('s1');
    useUiStore.getState().goBack();
    expect(useUiStore.getState().activePanel).toEqual({ type: 'user', uid: 'u1' });
  });
  it('a spot opened from the feed flies there, and back returns to the feed', () => {
    ui().openPanel('feed');
    ui().openSpotFromList('s1', 'feed');
    expect(ui()).toMatchObject({ activePanel: 'none', returnTo: 'feed', focusRequest: { spotId: 's1' } });
    ui().arriveAtSpot('s1');
    expect(ui().previewSpotId).toBe('s1');
    ui().goBack();
    expect(ui()).toMatchObject({ activePanel: 'feed', previewSpotId: null, returnTo: null });
  });
  it('a profile opened from the feed returns to the feed', () => {
    ui().openPanel('feed');
    ui().openUserProfile('u1');
    ui().goBack();
    expect(ui().activePanel).toBe('feed');
  });
  it('the sign-in sheet returns to the panel it was opened from', () => {
    ui().openPanel('feed');
    ui().openAuth();
    expect(ui().activePanel).toBe('auth');
    ui().closePanel();
    expect(ui().activePanel).toBe('feed');
    ui().closePanel();
    expect(ui().activePanel).toBe('none');
    ui().openAuth();
    ui().closePanel();
    expect(ui().activePanel).toBe('none');
  });
});
