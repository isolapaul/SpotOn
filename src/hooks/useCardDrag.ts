import { useRef, useState, type PointerEvent } from 'react';
import { cardRelease, sheetOffset } from '@/lib/sheetGesture';

/**
 * The place card's drag (design 1E; owner: pull up to open the spot). Down dismisses, up opens the
 * details (rules in lib/sheetGesture). `offset` is the current drag (up is damped), `handlers` go on
 * the card.
 */
export function useCardDrag(onDismiss: () => void, onExpand: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; id: number } | null>(null);
  const sample = useRef({ y: 0, t: 0, v: 0 });

  const end = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    setDragging(false);
    setOffset(0);
    const result = cardRelease(e.clientY - s.y, sample.current.v);
    if (result === 'dismiss') onDismiss();
    else if (result === 'expand') onExpand();
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      // Buttons and links keep their taps.
      if ((e.target as Element).closest('button, a')) return;
      start.current = { y: e.clientY, id: e.pointerId };
      sample.current = { y: e.clientY, t: e.timeStamp, v: 0 };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current || start.current.id !== e.pointerId) return;
      const dt = e.timeStamp - sample.current.t;
      if (dt > 0) sample.current = { y: e.clientY, t: e.timeStamp, v: (e.clientY - sample.current.y) / dt };
      const dy = e.clientY - start.current.y;
      // Up: a gentle lift that hints the card opens; down: follows the finger.
      setOffset(dy >= 0 ? dy : sheetOffset(dy) * 2);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  return { offset, dragging, handlers };
}
