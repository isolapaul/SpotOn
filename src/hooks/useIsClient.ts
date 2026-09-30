import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during the server render and hydration, true afterwards (and on every client-only render).
 * Replaces the `useEffect(() => setMounted(true), [])` pattern without a setState in an effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
