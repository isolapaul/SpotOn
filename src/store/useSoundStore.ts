import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { maySound, SOUNDS, type SoundName } from '@/lib/sound';
import { isNativeApp } from '@/lib/nativeApp';

const TAPS: ReadonlySet<SoundName> = new Set(['like', 'favorite', 'follow']);

interface SoundStore {
  /** Interface sounds on (default) or off; per device. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/** Interface sounds setting (Settings › Sounds), persisted on the device. */
export const useSoundStore = create<SoundStore>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    { name: 'spoton-sounds', partialize: (s) => ({ enabled: s.enabled }) },
  ),
);

let context: AudioContext | null = null;

/**
 * A matching tap of the phone: the Taptic Engine / vibrator through the native Haptics plugin in the
 * Android/iOS app, navigator.vibrate in Android browsers, nothing elsewhere.
 */
function haptic(name: SoundName) {
  const success = name === 'spotAdded' || name === 'levelUp';
  if (!TAPS.has(name) && !success) return;
  if (isNativeApp()) {
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle, NotificationType }) =>
        success ? Haptics.notification({ type: NotificationType.Success }) : Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => undefined);
    return;
  }
  if (TAPS.has(name) && 'vibrate' in navigator) navigator.vibrate?.(8);
}
let last = 0;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** The shared AudioContext, created on first use ('ambient' session: the iOS silent switch wins). */
function audio(): AudioContext | null {
  if (context) return context;
  const Ctor = typeof window === 'undefined' ? undefined : window.AudioContext;
  if (!Ctor) return null;
  try {
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * Plays one interface sound (lib/sound recipes) unless sounds are off, the page is hidden or
 * another sound just played. Never throws: a browser without audio simply stays silent.
 */
export function playSound(name: SoundName): void {
  const now = Date.now();
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (!maySound({ enabled: useSoundStore.getState().enabled, hidden, now, last })) return;
  const ctx = audio();
  if (!ctx) return;
  last = now;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const notes = SOUNDS[name];
    const start = ctx.currentTime + 0.01;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, start + n.at);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.at + n.dur);
      // A soft attack and an exponential decay: no clicks.
      gain.gain.setValueAtTime(0.0001, start + n.at);
      gain.gain.exponentialRampToValueAtTime(n.gain, start + n.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + n.at);
      osc.stop(start + n.at + n.dur + 0.02);
    }
    haptic(name);
  } catch (error) {
    console.warn('Sound failed:', error);
  }
}
