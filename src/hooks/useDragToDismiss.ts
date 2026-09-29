import { useRef, useState, type PointerEvent } from 'react';

/** Distance (px) or release speed (px/ms) that dismisses a card dragged down (design 1E). */
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

/**
 * Drag a bottom card down to dismiss it. `offset` is the current downward drag (0 when idle; the
 * card follows the finger, upward drags are resisted), `handlers` go on the card.
 */
export function useDragToDismiss(onDismiss: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number; id: number } | null>(null);

  const end = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    setDragging(false);
    const dy = e.clientY - s.y;
    const velocity = dy / Math.max(1, e.timeStamp - s.t);
    setOffset(0);
    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onDismiss();
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      // Buttons and links keep their taps.
      if ((e.target as Element).closest('button, a')) return;
      start.current = { y: e.clientY, t: e.timeStamp, id: e.pointerId };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current || start.current.id !== e.pointerId) return;
      const dy = e.clientY - start.current.y;
      setOffset(dy > 0 ? dy : dy / 6);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  return { offset, dragging, handlers };
}
