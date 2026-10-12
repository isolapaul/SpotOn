import { useEffect, useRef, type RefObject } from 'react';
import { useOverlayStore } from '@/store/useOverlayStore';

let nextId = 1;

/**
 * Registers an open sheet: the system back and Escape close it first (useOverlayStore), focus
 * moves into it while it is open and returns to where it was afterwards (screen readers, keys).
 */
export function useOverlay(close: () => void, focusRef?: RefObject<HTMLElement | null>) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const id = nextId++;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    useOverlayStore.getState().push({ id, close: () => closeRef.current() });
    focusRef?.current?.focus({ preventScroll: true });
    return () => {
      useOverlayStore.getState().remove(id);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
    // Once per open sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
