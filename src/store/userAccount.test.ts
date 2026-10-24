import { beforeEach, describe, expect, it, vi } from 'vitest';

// The new-user setup shared by the sign-in flows: generated usernames, loading or creating the
// user doc, the guard that keeps the auth listener out while a flow runs, and the provider sign-in.
// Firebase is mocked: docs live in a plain map, the claimUsername callable is one mock.

const m = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  claim: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  auth: { currentUser: null as null | { uid: string; email: string | null; photoURL: string | null; displayName: string | null } },
  track: vi.fn(),
  markSignedUp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({ signInWithPopup: m.signInWithPopup, signInWithRedirect: m.signInWithRedirect }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: async (ref: { path: string }) => {
    const data = m.docs.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: m.setDoc,
  updateDoc: m.updateDoc,
  serverTimestamp: () => 'ts',
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => m.claim }));
vi.mock('@/lib/firebase', () => ({ auth: m.auth, db: {}, functions: {} }));
vi.mock('@/lib/nativeApp', () => ({ isNativeApp: () => false }));
vi.mock('./nativeAuth', () => ({ signInWithAppleNative: vi.fn(), signInWithGoogleNative: vi.fn() }));
vi.mock('./telemetry', () => ({ track: m.track }));
vi.mock('./useReferralStore', () => ({ useReferralStore: { getState: () => ({ markSignedUp: m.markSignedUp }) } }));

import {
  beginNewUserSetup,
  claimGeneratedUsername,
  endNewUserSetup,
  isNewUserSetupRunning,
  loadOrCreateUser,
  signInWithProvider,
} from './userAccount';
import type { UserStore } from './userStoreTypes';

const firebaseUser = (uid = 'u1', displayName: string | null = 'Ann Lee') => ({
  uid,
  email: `${uid}@example.com`,
  photoURL: null,
  displayName,
});
const httpsError = (code: string) => Object.assign(new Error(code), { code });
const provider = (providerId = 'google.com') => ({ providerId }) as never;

/** Collects the store updates a helper makes, merged in order. */
function recorder() {
  const updates: Partial<UserStore>[] = [];
  const set = (partial: Partial<UserStore>) => updates.push(partial);
  const state = () => Object.assign({}, ...updates) as Partial<UserStore>;
  return { set, updates, state };
}

/** Lets the floating promises (the guard's recovery load) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  m.docs.clear();
  for (const fn of [m.claim, m.setDoc, m.updateDoc, m.signInWithPopup, m.signInWithRedirect, m.track, m.markSignedUp]) fn.mockReset();
  m.auth.currentUser = null;
  while (isNewUserSetupRunning()) endNewUserSetup(() => {}, () => null, false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('claimGeneratedUsername', () => {
  it('returns the claimed name', async () => {
    m.claim.mockImplementation(async ({ username }: { username: string }) => ({ data: { username } }));
    const name = await claimGeneratedUsername('Ann Lee');
    expect(name).toMatch(/^annlee\d+$/);
    expect(m.claim).toHaveBeenCalledTimes(1);
  });

  it('tries a fresh name after a taken or rejected one, six attempts in all', async () => {
    m.claim
      .mockRejectedValueOnce(httpsError('functions/already-exists'))
      .mockRejectedValueOnce(httpsError('functions/invalid-argument'))
      .mockResolvedValueOnce({ data: { username: 'third' } });
    expect(await claimGeneratedUsername('x')).toBe('third');
    expect(m.claim).toHaveBeenCalledTimes(3);

    m.claim.mockReset().mockRejectedValue(httpsError('functions/already-exists'));
    expect(await claimGeneratedUsername('x')).toBeNull();
    expect(m.claim).toHaveBeenCalledTimes(6);
  });

  it('gives up at once on any other error', async () => {
    m.claim.mockRejectedValue(httpsError('functions/unavailable'));
    expect(await claimGeneratedUsername('x')).toBeNull();
    expect(m.claim).toHaveBeenCalledTimes(1);
  });
});

describe('loadOrCreateUser', () => {
  it('loads an existing user doc', async () => {
    m.docs.set('users/u1', { username: 'ann', savedSpots: ['s1'] });
    const r = recorder();
    await loadOrCreateUser(firebaseUser() as never, r.set);
    expect(r.state()).toMatchObject({ loading: false, user: { uid: 'u1', username: 'ann', savedSpots: ['s1'] } });
    expect(r.state().needsUsername).toBeUndefined();
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('asks for a username when the doc has none', async () => {
    m.docs.set('users/u1', { savedSpots: [] });
    const r = recorder();
    await loadOrCreateUser(firebaseUser() as never, r.set);
    expect(r.state()).toMatchObject({ needsUsername: true, loading: false });
  });

  it('creates a missing doc with the current terms and a generated name', async () => {
    m.claim.mockResolvedValue({ data: { username: 'annlee7' } });
    const r = recorder();
    await loadOrCreateUser(firebaseUser() as never, r.set);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = m.setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1' });
    expect(data).toMatchObject({ uid: 'u1', email: 'u1@example.com', savedSpots: [], termsAcceptedAt: 'ts' });
    expect(data).not.toHaveProperty('username');
    expect(options).toEqual({ merge: true });
    expect(m.track).toHaveBeenCalledWith('sign_up');
    expect(m.markSignedUp).toHaveBeenCalled();
    expect(r.state()).toMatchObject({ needsUsername: true, newAccount: 'generated', user: { username: 'annlee7' } });
  });

  it('leaves the user to a sign-in flow that started meanwhile', async () => {
    m.docs.set('users/u1', { username: 'ann' });
    beginNewUserSetup();
    const r = recorder();
    await loadOrCreateUser(firebaseUser() as never, r.set);
    expect(r.updates).toEqual([]);
  });
});

describe('the new-user guard', () => {
  it('counts overlapping flows', () => {
    beginNewUserSetup();
    beginNewUserSetup();
    endNewUserSetup(() => {}, () => null, false);
    expect(isNewUserSetupRunning()).toBe(true);
    endNewUserSetup(() => {}, () => null, false);
    expect(isNewUserSetupRunning()).toBe(false);
    endNewUserSetup(() => {}, () => null, false);
    expect(isNewUserSetupRunning()).toBe(false);
  });

  it('loads the signed-in user when the last flow ends without it', async () => {
    m.docs.set('users/u1', { username: 'ann' });
    m.auth.currentUser = firebaseUser();
    beginNewUserSetup();
    const r = recorder();
    endNewUserSetup(r.set, () => null);
    await flush();
    expect(r.state()).toMatchObject({ user: { uid: 'u1', username: 'ann' } });
  });

  it('does not reload when the store already has that user, or recovery is off', async () => {
    m.docs.set('users/u1', { username: 'ann' });
    m.auth.currentUser = firebaseUser();
    const r = recorder();
    beginNewUserSetup();
    endNewUserSetup(r.set, () => ({ uid: 'u1' }) as never);
    beginNewUserSetup();
    endNewUserSetup(r.set, () => null, false);
    await flush();
    expect(r.updates).toEqual([]);
  });
});

describe('signInWithProvider', () => {
  it('signs a new account in with a generated name and asks for a username', async () => {
    m.signInWithPopup.mockResolvedValue({ user: firebaseUser('u2', 'Bo') });
    m.claim.mockResolvedValue({ data: { username: 'bo1' } });
    const r = recorder();
    await signInWithProvider(provider(), r.set, () => null);
    expect(r.state()).toMatchObject({ loading: false, needsUsername: true, newAccount: 'generated', user: { uid: 'u2', username: 'bo1' } });
    expect(isNewUserSetupRunning()).toBe(false);
  });

  it('updates lastLoginAt of an existing account and keeps its data', async () => {
    m.docs.set('users/u1', { username: 'ann', savedSpots: ['s9'] });
    m.signInWithPopup.mockResolvedValue({ user: firebaseUser() });
    const r = recorder();
    await signInWithProvider(provider(), r.set, () => null);
    expect(m.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { lastLoginAt: 'ts' });
    expect(m.claim).not.toHaveBeenCalled();
    expect(r.state()).toMatchObject({ needsUsername: false, newAccount: null, user: { username: 'ann', savedSpots: ['s9'] } });
  });

  it('claims a name for an existing account without one', async () => {
    m.docs.set('users/u1', { savedSpots: [] });
    m.signInWithPopup.mockResolvedValue({ user: firebaseUser() });
    m.claim.mockResolvedValue({ data: { username: 'annlee5' } });
    const r = recorder();
    await signInWithProvider(provider(), r.set, () => null);
    expect(r.state()).toMatchObject({ needsUsername: true, newAccount: null, user: { username: 'annlee5' } });
  });

  it.each(['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'])(
    'falls back to the redirect after %s',
    async (code) => {
      m.signInWithPopup.mockRejectedValue(httpsError(code));
      const r = recorder();
      await signInWithProvider(provider(), r.set, () => null);
      expect(m.signInWithRedirect).toHaveBeenCalledTimes(1);
      expect(r.updates).toEqual([]);
      expect(isNewUserSetupRunning()).toBe(false);
    },
  );

  it('stops loading and rethrows any other error', async () => {
    m.signInWithPopup.mockRejectedValue(httpsError('auth/network-request-failed'));
    const r = recorder();
    await expect(signInWithProvider(provider(), r.set, () => null)).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(m.signInWithRedirect).not.toHaveBeenCalled();
    expect(r.state()).toEqual({ loading: false });
    expect(isNewUserSetupRunning()).toBe(false);
  });
});
