import { describe, expect, it } from 'vitest';
import { maySound, SOUND_MAX_GAIN, SOUNDS, soundLength } from './sound';

describe('sounds', () => {
  it('are short and quiet', () => {
    for (const notes of Object.values(SOUNDS)) {
      expect(notes.length).toBeGreaterThan(0);
      expect(soundLength(notes)).toBeLessThanOrEqual(0.7);
      for (const n of notes) expect(n.gain).toBeLessThanOrEqual(SOUND_MAX_GAIN);
    }
  });
  it('play only when enabled, visible and not right after another', () => {
    expect(maySound({ enabled: true, hidden: false, now: 1000, last: 0 })).toBe(true);
    expect(maySound({ enabled: false, hidden: false, now: 1000, last: 0 })).toBe(false);
    expect(maySound({ enabled: true, hidden: true, now: 1000, last: 0 })).toBe(false);
    expect(maySound({ enabled: true, hidden: false, now: 1000, last: 900 })).toBe(false);
  });
});
