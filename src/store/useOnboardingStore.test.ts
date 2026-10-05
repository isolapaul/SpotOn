import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION, PENDING_USERNAME_STORAGE_KEY } from '@/lib/onboarding';

let storage: Map<string, string>;

function stubStorage(opts: { throws?: boolean } = {}) {
  storage = new Map();
  const guard = () => {
    if (opts.throws) throw new DOMException('denied', 'SecurityError');
  };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (guard(), storage.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(), void storage.set(k, v)),
    removeItem: (k: string) => (guard(), void storage.delete(k)),
  });
}

/** A fresh store module (its initial state reads storage and the address once, at creation). */
async function freshStore() {
  vi.resetModules();
  return (await import('./useOnboardingStore')).useOnboardingStore;
}

beforeEach(() => {
  stubStorage();
  vi.stubGlobal('location', { pathname: '/' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOnboardingStore', () => {
  it('is due on a first visit and records completion with the version', async () => {
    const store = await freshStore();
    expect(store.getState().completed).toBe(false);
    store.getState().complete();
    expect(store.getState().completed).toBe(true);
    expect(JSON.parse(storage.get(ONBOARDING_STORAGE_KEY) ?? '{}')).toMatchObject({ version: ONBOARDING_VERSION });
    expect((await freshStore()).getState().completed).toBe(true);
  });

  it('shows again after a version bump', async () => {
    storage.set(ONBOARDING_STORAGE_KEY, JSON.stringify({ version: ONBOARDING_VERSION - 1, completedAt: '2026-01-01T00:00:00.000Z' }));
    expect((await freshStore()).getState().completed).toBe(false);
  });

  it('without storage, completion holds in memory for the page load', async () => {
    stubStorage({ throws: true });
    const store = await freshStore();
    expect(store.getState().completed).toBe(false);
    store.getState().complete();
    expect(store.getState().completed).toBe(true);
    store.getState().setPendingUsername('anna');
    expect(store.getState().pendingUsername).toBe('anna');
  });

  it('waits on a shared spot link', async () => {
    vi.stubGlobal('location', { pathname: '/spot/abc' });
    const { selectTourBlocking } = await import('./useOnboardingStore');
    const store = await freshStore();
    expect(store.getState().sharedLink).toBe(true);
    expect(selectTourBlocking(store.getState())).toBe(false);
  });

  it('blocks the other prompts while due and while running', async () => {
    const store = await freshStore();
    const { selectTourBlocking } = await import('./useOnboardingStore');
    expect(selectTourBlocking(store.getState())).toBe(true);
    store.getState().start();
    store.getState().complete();
    expect(selectTourBlocking(store.getState())).toBe(true);
    store.getState().close();
    expect(selectTourBlocking(store.getState())).toBe(false);
  });

  it('persists the pending username sanitized, and clears it', async () => {
    const store = await freshStore();
    store.getState().setPendingUsername('Ádám_1');
    expect(storage.get(PENDING_USERNAME_STORAGE_KEY)).toBe('adam_1');
    expect((await freshStore()).getState().pendingUsername).toBe('adam_1');
    store.getState().setPendingUsername(null);
    expect(storage.has(PENDING_USERNAME_STORAGE_KEY)).toBe(false);
  });

  it('uses the install offer once', async () => {
    const store = await freshStore();
    expect(await store.getState().promptInstall()).toBe('unavailable');
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    store.getState().setInstallPrompt(event);
    expect(await store.getState().promptInstall()).toBe('accepted');
    expect(prompt).toHaveBeenCalledOnce();
    expect(store.getState().installPrompt).toBeNull();
  });
});
