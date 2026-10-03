import { describe, expect, it } from 'vitest';
import { NEW_SPOT_WINDOW_MS, isNewThisWeek, publishedAt, toMillis } from './newSpots';

const NOW = Date.UTC(2026, 8, 30, 12);
const ts = (ms: number) => ({ toDate: () => new Date(ms) });

describe('newSpots', () => {
  it('reads Timestamps, dates, numbers and strings; null for missing or invalid', () => {
    expect(toMillis(ts(NOW))).toBe(NOW);
    expect(toMillis(new Date(NOW))).toBe(NOW);
    expect(toMillis(NOW)).toBe(NOW);
    expect(toMillis(new Date(NOW).toISOString())).toBe(NOW);
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis('not a date')).toBeNull();
  });
  it('prefers the approval time over the creation time', () => {
    expect(publishedAt({ approvedAt: ts(NOW), createdAt: ts(NOW - 10 * NEW_SPOT_WINDOW_MS) })).toBe(NOW);
    expect(publishedAt({ createdAt: ts(NOW - 5) })).toBe(NOW - 5);
  });
  it('is new for 7 days after it appeared', () => {
    expect(isNewThisWeek({ createdAt: ts(NOW - NEW_SPOT_WINDOW_MS) }, NOW)).toBe(true);
    expect(isNewThisWeek({ createdAt: ts(NOW - NEW_SPOT_WINDOW_MS - 1) }, NOW)).toBe(false);
    // Created long ago, approved yesterday: new.
    expect(isNewThisWeek({ approvedAt: ts(NOW - 86_400_000), createdAt: ts(0) }, NOW)).toBe(true);
    expect(isNewThisWeek({ createdAt: null }, NOW)).toBe(false);
  });
});
