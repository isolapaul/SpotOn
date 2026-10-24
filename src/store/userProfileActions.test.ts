import { beforeEach, describe, expect, it, vi } from 'vitest';

// The signed-in user's own changes (store/userProfileActions), against a small fake store.
// Firebase is mocked; every callable is one mock that records its name and payload.

const m = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  updateDoc: vi.fn(),
  callables: new Map<string, ReturnType<typeof vi.fn>>(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: async (ref: { path: string }) => {
    const data = m.docs.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  },
  updateDoc: m.updateDoc,
  arrayUnion: (...v: unknown[]) => ({ union: v }),
  arrayRemove: (...v: unknown[]) => ({ remove: v }),
  serverTimestamp: () => 'ts',
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/functions', () => ({
  httpsCallable: (_f: unknown, name: string) => {
    const fn = m.callables.get(name) ?? vi.fn();
    m.callables.set(name, fn);
    return fn;
  },
}));
vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('@/lib/imageCompression', () => ({ compressImage: vi.fn() }));
vi.mock('@/lib/nativeApp', () => ({ isNativeApp: () => false }));
vi.mock('./nativeAuth', () => ({}));
vi.mock('./telemetry', () => ({ track: vi.fn() }));
vi.mock('./useReferralStore', () => ({ useReferralStore: { getState: () => ({ markSignedUp: vi.fn() }) } }));

import { createProfileActions } from './userProfileActions';
import type { User } from '@/lib/mapUserDoc';
import type { UserStore } from './userStoreTypes';

const callable = (name: string) => {
  const fn = m.callables.get(name);
  if (!fn) throw new Error(`no callable ${name}`);
  return fn;
};
const httpsError = (code: string) => Object.assign(new Error(code), { code });

/** A minimal store: the state object the actions read and write, with zustand-like set/get. */
function fakeStore(user: User | null) {
  let state = { user, needsUsername: true } as UserStore;
  const set = (partial: Partial<UserStore> | ((s: UserStore) => Partial<UserStore>)) => {
    state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
  };
  const get = () => state;
  state.setUser = (u) => set({ user: u, loading: false });
  const actions = createProfileActions(set, get);
  return { actions, get, set };
}

const ann = (): User => ({ uid: 'u1', username: 'ann', email: 'ann@example.com', savedSpots: ['s1'], highlightedSpots: ['h1'] });

beforeEach(() => {
  m.docs.clear();
  m.updateDoc.mockReset();
  for (const fn of m.callables.values()) fn.mockReset();
});

describe('toggleFavorite', () => {
  it('adds and removes a spot, in the doc and the store', async () => {
    const s = fakeStore(ann());
    await s.actions.toggleFavorite('s2');
    expect(m.updateDoc).toHaveBeenLastCalledWith({ path: 'users/u1' }, { savedSpots: { union: ['s2'] } });
    expect(s.get().user?.savedSpots).toEqual(['s1', 's2']);
    await s.actions.toggleFavorite('s1');
    expect(m.updateDoc).toHaveBeenLastCalledWith({ path: 'users/u1' }, { savedSpots: { remove: ['s1'] } });
    expect(s.get().user?.savedSpots).toEqual(['s2']);
  });

  it('applies to the current state, so a toggle that finished meanwhile is kept', async () => {
    const s = fakeStore(ann());
    let release!: () => void;
    m.updateDoc.mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    const slow = s.actions.toggleFavorite('s2');
    // Another toggle lands while the first write is still running.
    s.set((st) => ({ user: { ...st.user!, savedSpots: [...st.user!.savedSpots, 's3'] } }));
    release();
    await slow;
    expect(s.get().user?.savedSpots).toEqual(['s1', 's3', 's2']);
  });

  it('does nothing while signed out', async () => {
    await fakeStore(null).actions.toggleFavorite('s1');
    expect(m.updateDoc).not.toHaveBeenCalled();
  });
});

describe('usernames', () => {
  it('is available when free or already the own name', async () => {
    const s = fakeStore(ann());
    expect(await s.actions.checkUsernameAvailable('Free')).toBe(true);
    m.docs.set('usernames/ann', { uid: 'u1' });
    m.docs.set('usernames/bob', { uid: 'u2' });
    expect(await s.actions.checkUsernameAvailable('ann')).toBe(true);
    expect(await s.actions.checkUsernameAvailable('bob')).toBe(false);
  });

  it('validates before calling the server', async () => {
    const s = fakeStore(ann());
    await expect(s.actions.updateUsername('ab')).rejects.toThrow('USERNAME_TOO_SHORT');
    await expect(s.actions.updateUsername('a'.repeat(21))).rejects.toThrow('USERNAME_TOO_LONG');
    await expect(s.actions.updateUsername('bad-name')).rejects.toThrow('USERNAME_INVALID_CHARS');
    expect(callable('claimUsername')).not.toHaveBeenCalled();
    await expect(fakeStore(null).actions.updateUsername('fine_name')).rejects.toThrow('NOT_AUTHENTICATED');
  });

  it('stores the claimed name and clears the prompt', async () => {
    callable('claimUsername').mockResolvedValue({ data: { username: 'new_name' } });
    const s = fakeStore(ann());
    await s.actions.updateUsername('New_Name');
    expect(callable('claimUsername')).toHaveBeenCalledWith({ username: 'new_name' });
    expect(s.get().user?.username).toBe('new_name');
    expect(s.get().needsUsername).toBe(false);
  });

  it('maps the server errors to the store codes', async () => {
    const s = fakeStore(ann());
    callable('claimUsername').mockRejectedValueOnce(httpsError('functions/already-exists'));
    await expect(s.actions.updateUsername('taken')).rejects.toThrow('USERNAME_TAKEN');
    callable('claimUsername').mockRejectedValueOnce(httpsError('functions/invalid-argument'));
    await expect(s.actions.updateUsername('okay_name')).rejects.toThrow('USERNAME_INVALID_CHARS');
    const other = httpsError('functions/unavailable');
    callable('claimUsername').mockRejectedValueOnce(other);
    await expect(s.actions.updateUsername('okay_name')).rejects.toBe(other);
    expect(s.get().user?.username).toBe('ann');
  });
});

describe('highlights', () => {
  it('adds once and removes, from the current user', async () => {
    const s = fakeStore(ann());
    await s.actions.highlightSpot('h2');
    await s.actions.highlightSpot('h2');
    expect(callable('highlightSpot')).toHaveBeenCalledWith({ spotId: 'h2' });
    expect(s.get().user?.highlightedSpots).toEqual(['h1', 'h2']);
    await s.actions.unhighlightSpot('h1');
    expect(callable('unhighlightSpot')).toHaveBeenCalledWith({ spotId: 'h1' });
    expect(s.get().user?.highlightedSpots).toEqual(['h2']);
  });

  it('starts a list for a legacy user without highlightedSpots', async () => {
    const s = fakeStore({ ...ann(), highlightedSpots: undefined });
    await s.actions.highlightSpot('h9');
    expect(s.get().user?.highlightedSpots).toEqual(['h9']);
  });

  it('keeps the store as it was when the server refuses', async () => {
    callable('highlightSpot').mockRejectedValueOnce(httpsError('functions/failed-precondition'));
    const s = fakeStore(ann());
    await expect(s.actions.highlightSpot('h2')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect(s.get().user?.highlightedSpots).toEqual(['h1']);
  });
});

describe('profile settings', () => {
  it('trims the bio and writes only the given fields', async () => {
    const s = fakeStore(ann());
    await s.actions.updateProfileFields({ bio: '  hello  ', profilePrivate: true });
    expect(m.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { bio: 'hello', profilePrivate: true });
    expect(s.get().user).toMatchObject({ bio: 'hello', profilePrivate: true });
  });

  it('sets and clears the pin icon', async () => {
    const s = fakeStore({ ...ann(), pinIcon: 'star' });
    await s.actions.updatePinIcon('flame');
    expect(callable('updatePinIcon')).toHaveBeenLastCalledWith({ icon: 'flame' });
    expect(s.get().user?.pinIcon).toBe('flame');
    await s.actions.updatePinIcon(null);
    expect(s.get().user).not.toHaveProperty('pinIcon');
  });

  it('sends the name colour and font separately', async () => {
    const s = fakeStore(ann());
    await s.actions.updateCustomNameColor('#ff0000');
    await s.actions.updateCustomNameFont('serif');
    expect(callable('updateNameStyle').mock.calls).toEqual([[{ color: '#ff0000' }], [{ font: 'serif' }]]);
    expect(s.get().user).toMatchObject({ customNameColor: '#ff0000', customNameFont: 'serif' });
  });

  it('stores the notification settings', async () => {
    const s = fakeStore(ann());
    const settings = { spotApproved: true, spotReviewed: false, newPendingSpot: false, follows: true };
    await s.actions.updateNotificationSettings(settings);
    expect(m.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { notificationSettings: settings });
    expect(s.get().user?.notificationSettings).toEqual(settings);
  });

  it('needs a signed-in user', async () => {
    const s = fakeStore(null);
    await expect(s.actions.updateProfileFields({ bio: 'x' })).rejects.toThrow('NOT_AUTHENTICATED');
    await expect(s.actions.updatePinIcon(null)).rejects.toThrow('NOT_AUTHENTICATED');
    await expect(s.actions.highlightSpot('h')).rejects.toThrow('NOT_AUTHENTICATED');
  });
});
