import { describe, expect, it, vi } from 'vitest';

// No React Testing Library in this repo: the hook's selector and toggle logic are tested directly.
vi.mock('@/store/useUserStore', () => ({ useUserStore: vi.fn() }));

import { runFavoriteToggle, selectCanToggle, selectIsFavorite } from './useFavoriteToggle';

describe('selectIsFavorite', () => {
  it('reads the store user savedSpots', () => {
    const state = { user: { savedSpots: ['s1', 's2'] } };
    expect(selectIsFavorite(state, 's1')).toBe(true);
    expect(selectIsFavorite(state, 's3')).toBe(false);
  });

  it('is false when signed out or savedSpots is missing', () => {
    expect(selectIsFavorite({ user: null }, 's1')).toBe(false);
    expect(selectIsFavorite({ user: {} as { savedSpots: string[] } }, 's1')).toBe(false);
  });

  it('follows store changes (no local copy, BUG-09)', () => {
    const before = { user: { savedSpots: [] as string[] } };
    const after = { user: { savedSpots: ['s1'] } };
    expect(selectIsFavorite(before, 's1')).toBe(false);
    expect(selectIsFavorite(after, 's1')).toBe(true);
  });
});

describe('selectCanToggle', () => {
  it('requires a signed-in user', () => {
    expect(selectCanToggle({ user: null })).toBe(false);
    expect(selectCanToggle({ user: { savedSpots: [] } })).toBe(true);
  });
});

describe('runFavoriteToggle', () => {
  it('calls the store toggle with the spot id', async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    await runFavoriteToggle(toggle, 's1', true);
    expect(toggle).toHaveBeenCalledWith('s1');
  });

  it('does nothing when signed out', async () => {
    const toggle = vi.fn();
    await runFavoriteToggle(toggle, 's1', false);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('logs a failure instead of throwing', async () => {
    const error = new Error('denied');
    const toggle = vi.fn().mockRejectedValue(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runFavoriteToggle(toggle, 's1', true)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Failed to toggle favorite:', error);
    log.mockRestore();
  });
});
