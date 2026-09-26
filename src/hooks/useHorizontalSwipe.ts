import { useReducer } from 'react';
import type { TouchEvent } from 'react';

// T25 (DUP-02): one horizontal swipe gesture for the panels and the gallery. The state
// transitions are a pure reducer so they are unit-testable without a DOM.

/** `right`: only rightward drags count (Profile/Discovery). `both`: either direction (SpotDetails, gallery). */
export type SwipeDirection = 'right' | 'both';
export type SwipeSide = 'left' | 'right';

export interface SwipeState {
  startX: number;
  currentX: number;
  dragging: boolean;
}

export const SWIPE_IDLE: SwipeState = { startX: 0, currentX: 0, dragging: false };

export type SwipeAction =
  | { type: 'start'; x: number }
  | { type: 'move'; x: number; direction: SwipeDirection }
  | { type: 'end' };

export function swipeReducer(state: SwipeState, action: SwipeAction): SwipeState {
  switch (action.type) {
    case 'start':
      return { startX: action.x, currentX: action.x, dragging: true };
    case 'move':
      if (!state.dragging) return state;
      // `right` keeps the last rightward position: a move back left of the start is ignored.
      if (action.direction === 'right' && action.x - state.startX <= 0) return state;
      return { ...state, currentX: action.x };
    case 'end':
      return state.dragging ? SWIPE_IDLE : state;
  }
}

/** Translate (px) to apply while dragging; never negative for `right`. */
export function swipeOffset(state: SwipeState, direction: SwipeDirection): number {
  if (!state.dragging) return 0;
  const dx = state.currentX - state.startX;
  return direction === 'right' ? Math.max(0, dx) : dx;
}

/** Which side the finished drag swiped to, or null below the threshold (strictly greater than). */
export function swipeResult(state: SwipeState, threshold: number, direction: SwipeDirection): SwipeSide | null {
  if (!state.dragging) return null;
  const dx = state.currentX - state.startX;
  if (dx > threshold) return 'right';
  if (direction === 'both' && dx < -threshold) return 'left';
  return null;
}

export interface HorizontalSwipeOptions {
  threshold: number;
  direction: SwipeDirection;
  onSwipe: (side: SwipeSide) => void;
  /** When false, drags still move (offset) but `onSwipe` is not called. Default true. */
  enabled?: boolean;
}

export interface HorizontalSwipe {
  dragging: boolean;
  offset: number;
  handlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function useHorizontalSwipe({ threshold, direction, onSwipe, enabled = true }: HorizontalSwipeOptions): HorizontalSwipe {
  const [state, dispatch] = useReducer(swipeReducer, SWIPE_IDLE);

  // Like the hand-rolled handlers this replaces, move/end read the last rendered state.
  const onTouchStart = (e: TouchEvent) => {
    dispatch({ type: 'start', x: e.touches[0].clientX });
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!state.dragging) return;
    dispatch({ type: 'move', x: e.touches[0].clientX, direction });
  };
  const onTouchEnd = () => {
    if (!state.dragging) return;
    const side = swipeResult(state, threshold, direction);
    if (side && enabled) onSwipe(side);
    dispatch({ type: 'end' });
  };

  return {
    dragging: state.dragging,
    offset: swipeOffset(state, direction),
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
