import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_PROFILE_TTL_MS } from '@/lib/constants';

const { getDocMock } = vi.hoisted(() => ({ getDocMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: getDocMock,
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import {
  __resetPublicProfileCacheForTests,
  fetchPublicProfile,
  fetchPublicProfiles,
  invalidatePublicProfile,
  peekPublicProfile,
} from './publicProfiles';

function snap(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data ?? undefined };
}

const DOC_A = { username: 'alice', profilePictureURL: 'a.png', customNameColor: 'text-cyan-300', customNameFont: null, spotsCount: 4, isAdmin: true };
const PROFILE_A = { username: 'alice', profilePictureURL: 'a.png', customNameColor: 'text-cyan-300', customNameFont: null, spotsCount: 4, isAdmin: true };

/** A getDoc result that resolves only when `resolve` is called. */
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  __resetPublicProfileCacheForTests();
  getDocMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchPublicProfile cache', () => {
  it('maps the document and reads publicProfiles/{uid}', async () => {
    getDocMock.mockResolvedValueOnce(snap({ ...DOC_A, extra: 'ignored', spotsCount: '4' }));
    expect(await fetchPublicProfile('a')).toEqual({
      username: 'alice', profilePictureURL: 'a.png', customNameColor: 'text-cyan-300', customNameFont: null, isAdmin: true,
    });
    expect(getDocMock).toHaveBeenCalledWith({ path: 'publicProfiles/a' });
  });

  it('shares one getDoc between two concurrent calls', async () => {
    const d = deferred();
    getDocMock.mockReturnValueOnce(d.promise);
    const first = fetchPublicProfile('a');
    const second = fetchPublicProfile('a');
    expect(second).toBe(first);
    d.resolve(snap(DOC_A));
    expect(await Promise.all([first, second])).toEqual([PROFILE_A, PROFILE_A]);
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it('serves a hit within the TTL without a call, and reads again after it', async () => {
    vi.useFakeTimers();
    getDocMock.mockResolvedValue(snap(DOC_A));
    await fetchPublicProfile('a');
    expect(getDocMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(PUBLIC_PROFILE_TTL_MS - 1);
    expect(await fetchPublicProfile('a')).toEqual(PROFILE_A);
    expect(peekPublicProfile('a')).toEqual(PROFILE_A);
    expect(getDocMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(peekPublicProfile('a')).toBeUndefined();
    await fetchPublicProfile('a');
    expect(getDocMock).toHaveBeenCalledTimes(2);
  });

  it('caches null for a missing document', async () => {
    getDocMock.mockResolvedValueOnce(snap(null));
    expect(await fetchPublicProfile('ghost')).toBeNull();
    expect(peekPublicProfile('ghost')).toBeNull();
    expect(await fetchPublicProfile('ghost')).toBeNull();
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejected getDoc: rethrows, and the next call retries', async () => {
    const error = new Error('unavailable');
    getDocMock.mockRejectedValueOnce(error).mockResolvedValueOnce(snap(DOC_A));
    await expect(fetchPublicProfile('a')).rejects.toBe(error);
    expect(peekPublicProfile('a')).toBeUndefined();
    expect(await fetchPublicProfile('a')).toEqual(PROFILE_A);
    expect(getDocMock).toHaveBeenCalledTimes(2);
  });

  it('shares the rejection between concurrent callers', async () => {
    const d = deferred();
    getDocMock.mockReturnValueOnce(d.promise);
    const first = fetchPublicProfile('a');
    const second = fetchPublicProfile('a');
    d.reject(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it('invalidatePublicProfile forces the next read', async () => {
    getDocMock.mockResolvedValueOnce(snap(DOC_A)).mockResolvedValueOnce(snap({ ...DOC_A, spotsCount: 5 }));
    await fetchPublicProfile('a');
    invalidatePublicProfile('a');
    expect(peekPublicProfile('a')).toBeUndefined();
    expect((await fetchPublicProfile('a'))?.spotsCount).toBe(5);
    expect(getDocMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a read that was in flight when the uid was invalidated', async () => {
    const d = deferred();
    getDocMock.mockReturnValueOnce(d.promise).mockResolvedValueOnce(snap({ ...DOC_A, spotsCount: 5 }));
    const stale = fetchPublicProfile('a');
    invalidatePublicProfile('a');
    d.resolve(snap(DOC_A));
    expect((await stale)?.spotsCount).toBe(4);
    expect(peekPublicProfile('a')).toBeUndefined();
    expect((await fetchPublicProfile('a'))?.spotsCount).toBe(5);
  });
});

describe('fetchPublicProfiles', () => {
  it('de-duplicates uids and reuses the per-uid cache', async () => {
    getDocMock.mockImplementation(async ({ path }: { path: string }) =>
      snap(path === 'publicProfiles/b' ? null : { ...DOC_A, username: path.split('/')[1] }),
    );
    await fetchPublicProfile('a');
    const profiles = await fetchPublicProfiles(['a', 'b', 'a', 'c']);
    expect(Object.keys(profiles).sort()).toEqual(['a', 'b', 'c']);
    expect(profiles.a?.username).toBe('a');
    expect(profiles.b).toBeNull();
    expect(profiles.c?.username).toBe('c');
    // a: 1 (before), b: 1, c: 1
    expect(getDocMock).toHaveBeenCalledTimes(3);
  });
});
