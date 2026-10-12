import { describe, expect, it } from 'vitest';
import { badgesOf, CHALLENGE_STEPS, doneCount, FOUNDER_XP, LAUNCH_END_MS, seasonOpen } from './challenge';
import * as server from '../../functions/src/lib/challenge';

describe('challenge', () => {
  it('matches the server', () => {
    expect([...CHALLENGE_STEPS]).toEqual([...server.CHALLENGE_STEPS]);
    expect(LAUNCH_END_MS).toBe(server.LAUNCH_END_MS);
    expect(FOUNDER_XP).toBe(server.FOUNDER_XP);
  });
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
