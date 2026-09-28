import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIMEOUT, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('passes a result through', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('passes an error through', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });

  it('rejects with TIMEOUT when the promise hangs', async () => {
    vi.useFakeTimers();
    const hung = withTimeout(new Promise(() => {}), 60_000);
    const check = expect(hung).rejects.toThrow(TIMEOUT);
    await vi.advanceTimersByTimeAsync(60_000);
    await check;
  });
});
