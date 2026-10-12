import { describe, expect, it } from 'vitest';
import { badgesOf, doneCount, LAUNCH_END_MS, seasonOpen } from './challenge';

describe('challenge', () => {
  it('runs until the configured or built-in end', () => {
    expect(seasonOpen(LAUNCH_END_MS, null)).toBe(true);
    expect(seasonOpen(LAUNCH_END_MS + 1, null)).toBe(false);
    expect(seasonOpen(5, 4)).toBe(false);
  });
  it('counts steps and badges', () => {
    expect(doneCount({ spot: true, review: true, follow: false, visit: false, favorite: true })).toBe(3);
    expect(badgesOf(['founder', 'x', 1])).toEqual(['founder']);
  });
});
