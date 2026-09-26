import { describe, expect, it } from 'vitest';
import { SWIPE_THRESHOLDS } from '@/lib/constants';
import {
  SWIPE_IDLE,
  swipeOffset,
  swipeReducer,
  swipeResult,
  type SwipeDirection,
  type SwipeState,
} from './useHorizontalSwipe';

/** Start at `start`, move through `moves`; returns the state just before touchend. */
function drag(direction: SwipeDirection, start: number, ...moves: number[]): SwipeState {
  let s = swipeReducer(SWIPE_IDLE, { type: 'start', x: start });
  for (const x of moves) s = swipeReducer(s, { type: 'move', x, direction });
  return s;
}

describe('swipeReducer', () => {
  it('starts dragging at the touch point', () => {
    expect(swipeReducer(SWIPE_IDLE, { type: 'start', x: 42 })).toEqual({ startX: 42, currentX: 42, dragging: true });
  });

  it('ignores moves and ends while not dragging', () => {
    expect(swipeReducer(SWIPE_IDLE, { type: 'move', x: 300, direction: 'both' })).toBe(SWIPE_IDLE);
    expect(swipeReducer(SWIPE_IDLE, { type: 'end' })).toBe(SWIPE_IDLE);
    expect(swipeResult(SWIPE_IDLE, 0, 'both')).toBeNull();
    expect(swipeOffset(SWIPE_IDLE, 'both')).toBe(0);
  });

  it('resets to the initial state on end', () => {
    expect(swipeReducer(drag('both', 100, 300), { type: 'end' })).toEqual(SWIPE_IDLE);
  });
});

describe("direction 'right' (Profile / Discovery)", () => {
  const t = SWIPE_THRESHOLDS.panel;

  it('ignores leftward moves: no update, offset stays 0, no swipe', () => {
    const s = drag('right', 500, 400);
    expect(s.currentX).toBe(500);
    expect(swipeOffset(s, 'right')).toBe(0);
    expect(swipeResult(s, t, 'right')).toBeNull();
  });

  it('keeps the last rightward position when the finger comes back left of the start', () => {
    const s = drag('right', 500, 700, 440);
    expect(s.currentX).toBe(700);
    expect(swipeOffset(s, 'right')).toBe(200);
    expect(swipeResult(s, t, 'right')).toBe('right');
  });

  it('follows a move back that stays right of the start', () => {
    const s = drag('right', 500, 700, 550);
    expect(swipeOffset(s, 'right')).toBe(50);
    expect(swipeResult(s, t, 'right')).toBeNull();
  });

  it('closes at 151 px but not at 150 px', () => {
    expect(t).toBe(150);
    expect(swipeResult(drag('right', 100, 251), t, 'right')).toBe('right');
    expect(swipeResult(drag('right', 100, 250), t, 'right')).toBeNull();
    expect(swipeOffset(drag('right', 100, 260), 'right')).toBe(160);
  });

  it('never swipes left', () => {
    expect(swipeResult(drag('right', 500, 100), 50, 'right')).toBeNull();
  });
});

describe("direction 'both' (SpotDetails panel)", () => {
  const t = SWIPE_THRESHOLDS.spotDetails;

  it('closes at -101 and +101 px but not at ±100 px', () => {
    expect(t).toBe(100);
    expect(swipeResult(drag('both', 500, 399), t, 'both')).toBe('left');
    expect(swipeResult(drag('both', 500, 601), t, 'both')).toBe('right');
    expect(swipeResult(drag('both', 500, 400), t, 'both')).toBeNull();
    expect(swipeResult(drag('both', 500, 600), t, 'both')).toBeNull();
  });

  it('always tracks the finger; the offset can be negative', () => {
    const s = drag('both', 500, 700, 460);
    expect(s.currentX).toBe(460);
    expect(swipeOffset(s, 'both')).toBe(-40);
    expect(swipeResult(s, t, 'both')).toBeNull();
  });
});

describe("direction 'both' (gallery)", () => {
  const t = SWIPE_THRESHOLDS.gallery;

  it('navigates at ±51 px but not at ±50 px', () => {
    expect(t).toBe(50);
    expect(swipeResult(drag('both', 300, 351), t, 'both')).toBe('right'); // previous image
    expect(swipeResult(drag('both', 300, 249), t, 'both')).toBe('left'); // next image
    expect(swipeResult(drag('both', 300, 350), t, 'both')).toBeNull();
    expect(swipeResult(drag('both', 300, 250), t, 'both')).toBeNull();
  });
});
