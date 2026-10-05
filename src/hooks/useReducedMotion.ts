import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = globalThis.matchMedia?.(QUERY);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

/** The user asked for reduced motion (live): JS-driven motion (counters, drag parallax) stops. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}
