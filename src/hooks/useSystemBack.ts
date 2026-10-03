import { useEffect, useRef } from 'react';

/** Adds the app's back entry: the same URL (and Next's state), one step deeper in the history. */
function pushBackEntry() {
  globalThis.history.pushState({ ...globalThis.history.state, spotonBack: true }, '');
}

/**
 * Makes the system back (the Android back gesture, the browser's Back button) step back inside the app
 * instead of leaving it. While `active`, one extra history entry (same URL) is kept on top; its popstate
 * runs `onBack`. `step` identifies what is shown, so after a back that leaves something open (for example
 * spot → profile) the entry is pushed again. When the app closes everything itself, the entry is
 * consumed with history.back(), and that popstate is ignored.
 */
export function useSystemBack(active: boolean, step: string, onBack: () => void) {
  const onBackRef = useRef(onBack);
  const activeRef = useRef(active);
  const pushed = useRef(false);
  const consuming = useRef(false);

  useEffect(() => {
    onBackRef.current = onBack;
    activeRef.current = active;
  });

  useEffect(() => {
    const onPop = () => {
      if (consuming.current) {
        consuming.current = false;
        // Something was opened while the entry was being consumed: it needs its own entry.
        if (activeRef.current && !pushed.current) {
          pushBackEntry();
          pushed.current = true;
        }
        return;
      }
      if (!pushed.current) return;
      pushed.current = false;
      onBackRef.current();
    };
    globalThis.addEventListener('popstate', onPop);
    return () => globalThis.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (active && !pushed.current && !consuming.current) {
      pushBackEntry();
      pushed.current = true;
    } else if (!active && pushed.current) {
      pushed.current = false;
      consuming.current = true;
      globalThis.history.back();
    }
  }, [active, step]);
}
