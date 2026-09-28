import { describe, expect, it } from 'vitest';
import { isActiveHighlight, isHighlightedBy } from './highlights';

const now = new Date('2026-01-10T12:00:00.000Z');
const entry = (userId: string, expiresAt: string) => ({ userId, highlightedAt: '2026-01-05T12:00:00.000Z', expiresAt });

describe('isActiveHighlight', () => {
  it('is active before expiresAt', () => {
    expect(isActiveHighlight(entry('u1', '2026-01-17T12:00:00.000Z'), now)).toBe(true);
  });

  it('is expired at or after expiresAt', () => {
    expect(isActiveHighlight(entry('u1', '2026-01-10T12:00:00.000Z'), now)).toBe(false);
    expect(isActiveHighlight(entry('u1', '2026-01-09T12:00:00.000Z'), now)).toBe(false);
  });

  it('treats an unparsable expiresAt as expired', () => {
    expect(isActiveHighlight(entry('u1', 'not a date'), now)).toBe(false);
  });

  it('defaults now to the current time', () => {
    expect(isActiveHighlight(entry('u1', new Date(Date.now() + 60_000).toISOString()))).toBe(true);
    expect(isActiveHighlight(entry('u1', new Date(Date.now() - 60_000).toISOString()))).toBe(false);
  });
});

describe('isHighlightedBy', () => {
  it('is true for an active entry by the user', () => {
    expect(isHighlightedBy({ highlighted: [entry('u1', '2026-01-17T12:00:00.000Z')] }, 'u1', now)).toBe(true);
  });

  it('is false for an expired entry by the user', () => {
    expect(isHighlightedBy({ highlighted: [entry('u1', '2026-01-01T12:00:00.000Z')] }, 'u1', now)).toBe(false);
  });

  it('is false for an active entry by another user', () => {
    expect(isHighlightedBy({ highlighted: [entry('u2', '2026-01-17T12:00:00.000Z')] }, 'u1', now)).toBe(false);
  });

  it('finds the active entry among expired and foreign ones', () => {
    const highlighted = [
      entry('u1', '2026-01-01T12:00:00.000Z'),
      entry('u2', '2026-01-17T12:00:00.000Z'),
      entry('u1', '2026-01-16T12:00:00.000Z'),
    ];
    expect(isHighlightedBy({ highlighted }, 'u1', now)).toBe(true);
  });

  it('is false when the array is missing or empty', () => {
    expect(isHighlightedBy({}, 'u1', now)).toBe(false);
    expect(isHighlightedBy({ highlighted: [] }, 'u1', now)).toBe(false);
  });
});
