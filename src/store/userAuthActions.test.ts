import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sign-in, sign-up, sign-out, the auth listener and account deletion (store/userAuthActions),
// against a small fake store. Firebase is mocked; docs live in a plain map.

type FbUser = { uid: string; email: string | null; photoURL: string | null; displayName: string | null };

const m = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  calls: [] as string[],
  claim: vi.fn(),
  deleteAccount: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn(),
  authListener: null as null | ((u: FbUser | null) => Promise<void> | void),
  unsubscribeAuth: vi.fn(),
  auth: { currentUser: null as null | FbUser },
  forgetDevice: vi.fn(),
  startAdmin: vi.fn(),
  stopAdmin: vi.fn(),
  clearNotifications: vi.fn(),
  markFeedSeen: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signInWithEmailAndPassword: m.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: m.createUserWithEmailAndPassword,
  getRedirectResult: m.getRedirectResult,
  signOut: m.signOut,
  onAuthStateChanged: (_auth: unknown, cb: (u: FbUser | null) => void) => {
    m.authListener = cb;
    return m.unsubscribeAuth;
  },
}));
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
vi.mock('firebase/functions', () => ({
  httpsCallable: (_f: unknown, name: string) => (name === 'deleteAccount' ? m.deleteAccount : m.claim),
}));
vi.mock('@/lib/firebase', () => ({ auth: m.auth, db: {}, functions: {}, googleProvider: {}, appleProvider: {} }));
vi.mock('@/lib/nativeApp', () => ({ isNativeApp: () => false }));
vi.mock('./nativeAuth', () => ({ signOutNative: vi.fn(), signInWithAppleNative: vi.fn(), signInWithGoogleNative: vi.fn() }));
vi.mock('./telemetry', () => ({ track: vi.fn() }));
vi.mock('./useReferralStore', () => ({ useReferralStore: { getState: () => ({ markSignedUp: vi.fn() }) } }));
vi.mock('./pushDevice', () => ({ forgetDevice: m.forgetDevice }));
vi.mock('./useNotificationStore', () => ({ useNotificationStore: { getState: () => ({ clearAll: m.clearNotifications }) } }));
vi.mock('./useFeedStore', () => ({ useFeedStore: { getState: () => ({ markSeen: m.markFeedSeen }) } }));
vi.mock('./userAdmin', () => ({ startAdminListeners: m.startAdmin, stopAdminListeners: m.stopAdmin }));

import { createAuthActions } from './userAuthActions';
import { endNewUserSetup, isNewUserSetupRunning } from './userAccount';
import type { UserStore } from './userStoreTypes';

const fbUser = (uid = 'u1', displayName: string | null = 'Ann'): FbUser => ({ uid, email: `${uid}@example.com`, photoURL: null, displayName });
const httpsError = (code: string) => Object.assign(new Error(code), { code });

function fakeStore() {
  let state = { user: null, loading: true, needsUsername: false, newAccount: null } as unknown as UserStore;
  const set = (partial: Partial<UserStore> | ((s: UserStore) => Partial<UserStore>)) => {
    state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
  };
  const get = () => state;
  return { actions: createAuthActions(set, get), get };
}

beforeEach(() => {
  m.docs.clear();
  m.calls.length = 0;
  for (const fn of [m.claim, m.deleteAccount, m.setDoc, m.updateDoc, m.signInWithEmailAndPassword, m.createUserWithEmailAndPassword,
    m.getRedirectResult, m.signOut, m.unsubscribeAuth, m.forgetDevice, m.startAdmin, m.stopAdmin, m.clearNotifications, m.markFeedSeen]) fn.mockReset();
  m.auth.currentUser = null;
  m.authListener = null;
  while (isNewUserSetupRunning()) endNewUserSetup(() => {}, () => null, false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('signInWithEmail', () => {
  it('loads the user doc and records the login', async () => {
    m.docs.set('users/u1', { username: 'ann', savedSpots: [] });
    m.signInWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    const s = fakeStore();
    await s.actions.signInWithEmail('u1@example.com', 'secret');
    expect(m.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { lastLoginAt: 'ts' });
    expect(s.get()).toMatchObject({ loading: false, needsUsername: false, user: { uid: 'u1', username: 'ann' } });
  });

  it('asks for a username when the doc has none', async () => {
    m.docs.set('users/u1', { savedSpots: [] });
    m.signInWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    const s = fakeStore();
    await s.actions.signInWithEmail('u1@example.com', 'secret');
    expect(s.get().needsUsername).toBe(true);
  });

  it('stops loading and rethrows a failed sign-in', async () => {
    m.signInWithEmailAndPassword.mockRejectedValue(httpsError('auth/invalid-credential'));
    const s = fakeStore();
    await expect(s.actions.signInWithEmail('x@example.com', 'bad')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(s.get().loading).toBe(false);
  });
});

describe('signUpWithEmail', () => {
  it('creates the doc and claims the chosen name', async () => {
    m.createUserWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    m.claim.mockResolvedValue({ data: { username: 'ann_lee' } });
    const s = fakeStore();
    await s.actions.signUpWithEmail('u1@example.com', 'secret', 'Ann_Lee');
    expect(m.claim).toHaveBeenCalledWith({ username: 'ann_lee' });
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(s.get()).toMatchObject({ loading: false, needsUsername: false, newAccount: 'chosen', user: { username: 'ann_lee' } });
    expect(isNewUserSetupRunning()).toBe(false);
  });

  it('falls back to a generated name when the chosen one is taken, and asks again', async () => {
    m.createUserWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    m.claim.mockRejectedValueOnce(httpsError('functions/already-exists')).mockResolvedValueOnce({ data: { username: 'ann123' } });
    const s = fakeStore();
    await s.actions.signUpWithEmail('u1@example.com', 'secret', 'taken');
    expect(s.get()).toMatchObject({ needsUsername: true, newAccount: 'chosen', user: { username: 'ann123' } });
  });

  it('signs the user in without a name when the callable is unavailable', async () => {
    m.createUserWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    m.claim.mockRejectedValue(httpsError('functions/unavailable'));
    const s = fakeStore();
    await s.actions.signUpWithEmail('u1@example.com', 'secret', 'ann');
    expect(m.claim).toHaveBeenCalledTimes(1);
    expect(s.get()).toMatchObject({ needsUsername: true, user: { uid: 'u1' } });
  });

  it('stops loading and rethrows when the account cannot be created', async () => {
    m.createUserWithEmailAndPassword.mockRejectedValue(httpsError('auth/email-already-in-use'));
    const s = fakeStore();
    await expect(s.actions.signUpWithEmail('u1@example.com', 'secret', 'ann')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(s.get().loading).toBe(false);
    expect(isNewUserSetupRunning()).toBe(false);
  });
});

describe('signing out and deleting the account', () => {
  it('signOut forgets the device for the user, then signs out', async () => {
    const s = fakeStore();
    m.docs.set('users/u1', { username: 'ann' });
    m.signInWithEmailAndPassword.mockResolvedValue({ user: fbUser() });
    await s.actions.signInWithEmail('u1@example.com', 'secret');
    m.forgetDevice.mockImplementation(async () => { m.calls.push('forget'); });
    m.signOut.mockImplementation(async () => { m.calls.push('signOut'); });
    await s.actions.signOut();
    expect(m.forgetDevice).toHaveBeenCalledWith('u1');
    expect(m.calls).toEqual(['forget', 'signOut']);
    expect(m.stopAdmin).toHaveBeenCalled();
    expect(s.get()).toMatchObject({ user: null, loading: false });
    // The device's notification list stays (only account deletion clears it).
    expect(m.clearNotifications).not.toHaveBeenCalled();
  });

  it('deleteAccount deletes on the server first, then clears this device', async () => {
    m.deleteAccount.mockImplementation(async () => { m.calls.push('delete'); });
    m.forgetDevice.mockImplementation(async () => { m.calls.push('forget'); });
    m.signOut.mockImplementation(async () => { m.calls.push('signOut'); });
    const s = fakeStore();
    await s.actions.deleteAccount('ann');
    expect(m.deleteAccount).toHaveBeenCalledWith({ confirmUsername: 'ann' });
    expect(m.calls).toEqual(['delete', 'forget', 'signOut']);
    // The users doc is gone already: no uid to unregister from.
    expect(m.forgetDevice).toHaveBeenCalledWith(null);
    expect(m.clearNotifications).toHaveBeenCalled();
    expect(m.markFeedSeen).toHaveBeenCalledWith(0);
    expect(s.get().user).toBeNull();
  });

  it('deleteAccount keeps the user signed in when the server refuses', async () => {
    m.deleteAccount.mockRejectedValue(httpsError('functions/permission-denied'));
    const s = fakeStore();
    await expect(s.actions.deleteAccount('wrong')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect(m.signOut).not.toHaveBeenCalled();
    expect(m.forgetDevice).not.toHaveBeenCalled();
  });
});

describe('initAuth', () => {
  it('resolves on the first auth state and loads the signed-in user', async () => {
    m.getRedirectResult.mockResolvedValue(null);
    m.docs.set('users/u1', { username: 'ann' });
    const s = fakeStore();
    const ready = s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    await m.authListener!(fbUser());
    await ready;
    expect(m.startAdmin).toHaveBeenCalledWith('u1', expect.any(Function));
    expect(s.get()).toMatchObject({ loading: false, user: { username: 'ann' } });
  });

  it('a signed-out state clears the user and the prompts', async () => {
    m.getRedirectResult.mockResolvedValue(null);
    const s = fakeStore();
    const ready = s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    await m.authListener!(null);
    await ready;
    expect(m.stopAdmin).toHaveBeenCalled();
    expect(s.get()).toMatchObject({ user: null, loading: false, needsUsername: false, newAccount: null });
  });

  it('finishes a redirect sign-in of a new account first', async () => {
    m.getRedirectResult.mockResolvedValue({ user: fbUser('u3', 'Cy') });
    m.claim.mockResolvedValue({ data: { username: 'cy9' } });
    const s = fakeStore();
    void s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(s.get()).toMatchObject({ needsUsername: true, newAccount: 'generated', user: { uid: 'u3', username: 'cy9' } });
  });

  it('never blocks startup on a failed profile read', async () => {
    m.getRedirectResult.mockRejectedValue(new Error('offline'));
    const s = fakeStore();
    const ready = s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    // No users doc and the write that would create it fails, as offline.
    m.setDoc.mockRejectedValue(new Error('offline'));
    await m.authListener!(fbUser('u4'));
    await ready;
    expect(s.get().loading).toBe(false);
  });

  it('replaces an earlier auth listener', async () => {
    m.getRedirectResult.mockResolvedValue(null);
    const s = fakeStore();
    void s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    const before = m.unsubscribeAuth.mock.calls.length;
    m.authListener = null;
    void s.actions.initAuth();
    await vi.waitFor(() => expect(m.authListener).not.toBeNull());
    expect(m.unsubscribeAuth.mock.calls.length).toBe(before + 1);
  });
});
