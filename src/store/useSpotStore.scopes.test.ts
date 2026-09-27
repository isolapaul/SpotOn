import { beforeEach, describe, expect, it, vi } from 'vitest';

// T30: which spots queries the store issues per role, and how scope switches treat the data.
// firebase/firestore is mocked: query() returns a readable descriptor, onSnapshot() records listeners.

type Constraint = { type: 'where'; field: string; op: string; value: unknown } | { type: 'orderBy'; field: string; dir: string };
type Listener = {
  constraints: Constraint[];
  next: (snapshot: unknown) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const { listeners } = vi.hoisted(() => ({ listeners: [] as Listener[] }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  query: (_ref: unknown, ...constraints: Constraint[]) => ({ constraints }),
  where: (field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }),
  orderBy: (field: string, dir = 'asc') => ({ type: 'orderBy', field, dir }),
  onSnapshot: (q: { constraints: Constraint[] }, next: Listener['next'], error: Listener['error']) => {
    const unsubscribe = vi.fn();
    listeners.push({ constraints: q.constraints, next, error, unsubscribe });
    return unsubscribe;
  },
  addDoc: vi.fn(), doc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), arrayUnion: vi.fn(),
  serverTimestamp: vi.fn(), Timestamp: { now: vi.fn() },
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
vi.mock('@/lib/firebase', () => ({ db: {}, functions: {}, storage: {} }));
vi.mock('@/lib/imageCompression', () => ({ compressImage: vi.fn() }));
vi.mock('@/store/publicProfiles', () => ({ invalidatePublicProfile: vi.fn() }));

import { useSpotStore } from './useSpotStore';

const ORDER: Constraint = { type: 'orderBy', field: 'createdAt', dir: 'desc' };
const APPROVED = [{ type: 'where', field: 'status', op: '==', value: 'approved' }, ORDER];
const own = (uid: string) => [{ type: 'where', field: 'createdBy', op: '==', value: uid }, ORDER];
const ALL = [ORDER];

let seconds = 1000;
function spotDoc(id: string, status: string, createdBy: string) {
  const createdAt = { seconds: seconds--, nanoseconds: 0, toMillis: () => 0 };
  return { id, data: () => ({ name: id, status, createdBy, createdAt }) };
}
function emit(listener: Listener, docs: Array<ReturnType<typeof spotDoc>>) {
  listener.next({ docs });
}

const Q = spotDoc('q-approved', 'approved', 'bob');
const P_ALICE = spotDoc('p-alice', 'pending', 'alice');
const P_BOB = spotDoc('p-bob', 'pending', 'bob');

const store = () => useSpotStore.getState();
const ids = () => store().spots.map((s) => s.id).sort();
const active = () => listeners.filter((l) => l.unsubscribe.mock.calls.length === 0);
const find = (constraints: unknown[]) => listeners.find((l) => JSON.stringify(l.constraints) === JSON.stringify(constraints));

async function startSignedOut() {
  const ready = store().startSpots();
  store().syncSpotScopes({ uid: null, isAdmin: false });
  emit(find(APPROVED)!, [Q]);
  await ready;
}

beforeEach(() => {
  store().stopSpots();
  listeners.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('spots listener scopes (T30)', () => {
  it('signed out: only the approved query; startSpots resolves on its first snapshot', async () => {
    let resolved = false;
    const ready = store().startSpots().then(() => { resolved = true; });
    store().syncSpotScopes({ uid: null, isAdmin: false });
    expect(listeners.map((l) => l.constraints)).toEqual([APPROVED]);
    await Promise.resolve();
    expect(resolved).toBe(false);
    emit(listeners[0], [Q]);
    await ready;
    expect(resolved).toBe(true);
    expect(ids()).toEqual(['q-approved']);
    expect(store().isLoading).toBe(false);
  });

  it('signed-in non-admin: adds exactly the createdBy == uid query', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    expect(listeners.map((l) => l.constraints)).toEqual([APPROVED, own('alice')]);
    emit(find(own('alice'))!, [P_ALICE]);
    expect(ids()).toEqual(['p-alice', 'q-approved']);
    // idempotent
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    expect(listeners).toHaveLength(2);
    expect(active()).toHaveLength(2);
  });

  it('admin: adds the unfiltered query, keeps approved, and replaces own only after its first snapshot', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    const ownListener = find(own('alice'))!;
    emit(ownListener, [P_ALICE]);

    store().syncSpotScopes({ uid: 'alice', isAdmin: true });
    expect(listeners.map((l) => l.constraints)).toEqual([APPROVED, own('alice'), ALL]);
    expect(ownListener.unsubscribe).not.toHaveBeenCalled();
    expect(ids()).toEqual(['p-alice', 'q-approved']); // nothing emptied while admin loads

    emit(find(ALL)!, [Q, P_ALICE, P_BOB]);
    expect(ownListener.unsubscribe).toHaveBeenCalledTimes(1);
    expect(find(APPROVED)!.unsubscribe).not.toHaveBeenCalled();
    expect(ids()).toEqual(['p-alice', 'p-bob', 'q-approved']);
    expect(active().map((l) => l.constraints)).toEqual([APPROVED, ALL]);
  });

  it('admin from the start: no own query', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: true });
    expect(listeners.map((l) => l.constraints)).toEqual([APPROVED, ALL]);
  });

  it('sign-out drops the own and admin data immediately', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    emit(find(own('alice'))!, [P_ALICE]);
    store().syncSpotScopes({ uid: null, isAdmin: false });
    expect(find(own('alice'))!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['q-approved']);

    store().syncSpotScopes({ uid: 'bob', isAdmin: true });
    emit(find(ALL)!, [Q, P_ALICE, P_BOB]);
    store().syncSpotScopes({ uid: null, isAdmin: false });
    expect(find(ALL)!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['q-approved']);
    expect(active().map((l) => l.constraints)).toEqual([APPROVED]);
  });

  it('losing admin drops the admin data at once and starts own', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: true });
    emit(find(ALL)!, [Q, P_ALICE, P_BOB]);
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    expect(find(ALL)!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['q-approved']);
    emit(find(own('alice'))!, [P_ALICE]);
    expect(ids()).toEqual(['p-alice', 'q-approved']);
  });

  it('a different user never sees the previous user\'s own spots', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    emit(find(own('alice'))!, [P_ALICE]);
    store().syncSpotScopes({ uid: 'bob', isAdmin: false });
    expect(find(own('alice'))!.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['q-approved']);
    expect(find(own('bob'))).toBeDefined();
  });

  it('an own/admin error sets error but keeps the approved spots', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: false });
    emit(find(own('alice'))!, [P_ALICE]);
    find(own('alice'))!.error(new Error('denied'));
    expect(store().error).toBe('denied');
    expect(ids()).toEqual(['q-approved']);
  });

  it('stopSpots stops every listener and clears the spots', async () => {
    await startSignedOut();
    store().syncSpotScopes({ uid: 'alice', isAdmin: true });
    store().stopSpots();
    expect(active()).toHaveLength(0);
    expect(store().spots).toEqual([]);
  });
});
