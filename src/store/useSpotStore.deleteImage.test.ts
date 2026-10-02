import { beforeEach, describe, expect, it, vi } from 'vitest';

// deleteSpotImage computes the removal from the fresh doc read inside a transaction, never from the
// (possibly stale) listener copy, and writes only the three image fields and updatedAt (the version
// approveSpot checks).
// firebase/firestore is mocked: runTransaction() runs the callback against `fresh`.

const { tx, state } = vi.hoisted(() => ({
  tx: { get: vi.fn(), update: vi.fn() },
  state: { fresh: undefined as Record<string, unknown> | undefined },
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  runTransaction: async (_db: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  collection: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), arrayUnion: vi.fn(),
  serverTimestamp: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  Timestamp: { now: vi.fn() },
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
vi.mock('@/lib/firebase', () => ({ db: {}, functions: {}, storage: {} }));
vi.mock('@/lib/imageCompression', () => ({ compressImage: vi.fn() }));
vi.mock('@/store/publicProfiles', () => ({ invalidatePublicProfile: vi.fn() }));

import { useSpotStore, type Spot } from './useSpotStore';

const img = (url: string, likes = 0, likedBy: string[] = []) => ({ id: `id-${url}`, url, likes, likedBy });

beforeEach(() => {
  tx.get.mockReset().mockImplementation(async () => ({
    exists: () => state.fresh !== undefined,
    data: () => state.fresh,
  }));
  tx.update.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // The listener copy is stale: no /c, no like on /a.
  useSpotStore.setState({
    spots: [{
      id: 's1', imageUrls: ['/a', '/b'], spotImages: [img('/a'), img('/b')], primaryImageIndex: 1,
    } as unknown as Spot],
  });
});

describe('deleteSpotImage', () => {
  it('keeps an image and a like another user added meanwhile (fresh doc, not the listener copy)', async () => {
    state.fresh = {
      name: 'S', status: 'approved',
      imageUrls: ['/a', '/b', '/c'],
      spotImages: [img('/a', 1, ['u2']), img('/b'), img('/c')],
      primaryImageIndex: 1,
    };
    await useSpotStore.getState().deleteSpotImage('s1', '/b');

    expect(tx.get).toHaveBeenCalledWith({ path: 'spots/s1' });
    expect(tx.update).toHaveBeenCalledTimes(1);
    const [ref, data] = tx.update.mock.calls[0];
    expect(ref).toEqual({ path: 'spots/s1' });
    expect(data).toEqual({
      imageUrls: ['/a', '/c'],
      spotImages: [img('/a', 1, ['u2']), img('/c')],
      primaryImageIndex: 1,
    });
    expect(Object.keys(data).sort()).toEqual(['imageUrls', 'primaryImageIndex', 'spotImages', 'updatedAt']);

    const local = useSpotStore.getState().spots[0];
    expect(local.imageUrls).toEqual(['/a', '/c']);
    expect(local.primaryImageIndex).toBe(1);
  });

  it('legacy doc (only imageUrls): last image → placeholder, spotImages []', async () => {
    state.fresh = { imageUrls: ['/a'] };
    await useSpotStore.getState().deleteSpotImage('s1', '/a');
    expect(tx.update.mock.calls[0][1]).toEqual({ imageUrls: ['/placeholder-spot.jpg'], spotImages: [], primaryImageIndex: 0 });
  });

  it('a missing spot throws and writes nothing', async () => {
    state.fresh = undefined;
    await expect(useSpotStore.getState().deleteSpotImage('s1', '/a')).rejects.toThrow('Spot not found');
    expect(tx.update).not.toHaveBeenCalled();
  });
});
