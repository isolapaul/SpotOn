// Short interface sounds, synthesised with WebAudio (no audio files): the recipes. Pure; the
// store/useSoundStore plays them.

export type SoundName = 'spotAdded' | 'notification' | 'like' | 'favorite' | 'levelUp' | 'follow';

/** One oscillator note: starts `at` seconds into the sound, glides to `to` Hz if given. */
export interface SoundNote {
  type: OscillatorType;
  freq: number;
  to?: number;
  at: number;
  dur: number;
  gain: number;
}

/** Peak gain of the loudest note; everything stays quiet next to other apps' sounds. */
export const SOUND_MAX_GAIN = 0.1;
/** Two sounds closer than this: the second is skipped (a burst of notifications plays once). */
export const SOUND_THROTTLE_MS = 150;

const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const B6 = 1975.5;

export const SOUNDS: Readonly<Record<SoundName, readonly SoundNote[]>> = {
  // A bright two-step rise: the spot is out.
  spotAdded: [
    { type: 'sine', freq: C6, at: 0, dur: 0.12, gain: 0.08 },
    { type: 'sine', freq: G6, at: 0.09, dur: 0.22, gain: 0.08 },
  ],
  // A glassy chime.
  notification: [
    { type: 'triangle', freq: E6, at: 0, dur: 0.3, gain: 0.07 },
    { type: 'triangle', freq: B6, at: 0.06, dur: 0.3, gain: 0.05 },
  ],
  // A tiny upward blip.
  like: [{ type: 'sine', freq: 880, to: 1320, at: 0, dur: 0.07, gain: 0.07 }],
  // A soft low "thup".
  favorite: [{ type: 'sine', freq: 220, to: 160, at: 0, dur: 0.1, gain: 0.1 }],
  // C-E-G-C arpeggio.
  levelUp: [
    { type: 'triangle', freq: 523.25, at: 0, dur: 0.14, gain: 0.07 },
    { type: 'triangle', freq: 659.25, at: 0.1, dur: 0.14, gain: 0.07 },
    { type: 'triangle', freq: 783.99, at: 0.2, dur: 0.14, gain: 0.07 },
    { type: 'triangle', freq: C6, at: 0.3, dur: 0.3, gain: 0.08 },
  ],
  // Two quick notes up.
  follow: [
    { type: 'sine', freq: 660, at: 0, dur: 0.08, gain: 0.06 },
    { type: 'sine', freq: 990, at: 0.07, dur: 0.12, gain: 0.06 },
  ],
};

/** Total length of a sound in seconds. */
export function soundLength(notes: readonly SoundNote[]): number {
  return notes.reduce((max, n) => Math.max(max, n.at + n.dur), 0);
}

/** Whether a sound may play now (enabled, page visible, not right after the previous one). */
export function maySound(o: { enabled: boolean; hidden: boolean; now: number; last: number }): boolean {
  return o.enabled && !o.hidden && o.now - o.last >= SOUND_THROTTLE_MS;
}
