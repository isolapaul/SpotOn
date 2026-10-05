import { useEffect, useRef, type RefObject } from 'react';
import { SWIPE_STEP } from '@/lib/onboarding';

interface StepSwipeOptions {
  enabled: boolean;
  /** Drags only follow the finger without reduced motion. */
  follow: boolean;
  canNext: boolean;
  canBack: boolean;
  onNext: () => void;
  onBack: () => void;
}

/** Elements a drag never starts on: text fields (caret and selection) and marked areas (menus, sheets). */
const NO_SWIPE = 'input, textarea, [data-no-swipe]';

/**
 * Story-style horizontal swipes between steps on `ref` (pointer events, so touch, pen and mouse).
 * While dragging, `--drag` (px) on the element lets the cards follow the finger and the scene
 * parallax; a drag where a step cannot go resists. A finished swipe swallows the click it ends with.
 */
export function useStepSwipe(ref: RefObject<HTMLElement | null>, opts: StepSwipeOptions) {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; id: number } | null = null;
    let active = false;
    let swallowClick = false;

    const reset = () => {
      start = null;
      active = false;
      el.dataset.dragging = 'false';
      el.style.setProperty('--drag', '0');
    };
    const down = (e: PointerEvent) => {
      if (!latest.current.enabled || !e.isPrimary || (e.target as Element).closest?.(NO_SWIPE)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!active) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        active = true;
        el.dataset.dragging = 'true';
      }
      const { follow, canNext, canBack } = latest.current;
      if (!follow) return;
      const blocked = (dx < 0 && !canNext) || (dx > 0 && !canBack);
      el.style.setProperty('--drag', String(Math.round(blocked ? dx * 0.25 : dx)));
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const swiped = active && Math.abs(dx) > SWIPE_STEP.distance && Math.abs(dx) > Math.abs(dy) * SWIPE_STEP.ratio;
      swallowClick = active;
      // The click (if any) follows pointerup in the same task; never swallow a later one.
      if (active) setTimeout(() => (swallowClick = false), 0);
      reset();
      if (!swiped) return;
      const { canNext, canBack, onNext, onBack } = latest.current;
      if (dx < 0 && canNext) onNext();
      if (dx > 0 && canBack) onBack();
    };
    const click = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    reset();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', reset);
      el.removeEventListener('click', click, true);
    };
  }, [ref]);
}
