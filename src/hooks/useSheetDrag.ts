import { useEffect, useRef, useState } from 'react';
import { sheetAxis, sheetOffset, shouldDismissSheet } from '@/lib/sheetGesture';

/** Whether every scrollable element between the touch target and the sheet is scrolled to the top. */
function scrolledToTop(target: Element | null, root: Element): boolean {
  for (let el = target; el && el !== root.parentElement; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Pull a full-screen sheet down to close it (owner: up/down only, never too sensitive; rules in
 * lib/sheetGesture). Touch listeners are native so the drag can stop the page from scrolling
 * (React's touchmove is passive). `ref` goes on the sheet; `offset` is its current translateY.
 */
export function useSheetDrag(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; atTop: boolean } | null = null;
    let mode: 'drag' | 'ignore' | null = null;
    let dy = 0;
    let sample = { y: 0, t: 0 };
    let velocity = 0;

    const onStart = (e: TouchEvent) => {
      const target = e.target as Element;
      if (e.touches.length !== 1 || target.closest('input, textarea, select, [data-no-sheet-drag]')) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, atTop: scrolledToTop(target, el) };
      mode = null;
      dy = 0;
      velocity = 0;
      sample = { y: t.clientY, t: e.timeStamp };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || mode === 'ignore') return;
      const t = e.touches[0];
      dy = t.clientY - start.y;
      if (mode === null) {
        mode = sheetAxis(t.clientX - start.x, dy, start.atTop);
        if (mode !== 'drag') return;
        setDragging(true);
      }
      e.preventDefault();
      const dt = e.timeStamp - sample.t;
      if (dt > 0) velocity = (t.clientY - sample.y) / dt;
      sample = { y: t.clientY, t: e.timeStamp };
      setOffset(sheetOffset(dy));
    };
    const onEnd = () => {
      if (mode === 'drag') {
        setDragging(false);
        if (shouldDismissSheet(dy, velocity, el.clientHeight)) {
          dismissRef.current();
          // If the panel stays open (e.g. it refused to close), settle back.
          setTimeout(() => setOffset(0), 600);
        } else {
          setOffset(0);
        }
      }
      start = null;
      mode = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { ref, offset, dragging };
}
