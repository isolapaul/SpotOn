// Sheet gestures (owner: close panels with a careful up/down drag, never sideways). Pure decisions
// for hooks/useSheetDrag and the place card. Values follow common sheet libraries: vaul closes a
// drawer past 25% of its height or on a flick of ~0.4 px/ms; iOS locks a gesture's axis after a
// ~10 pt slop. Ours are a little stricter so a scroll never closes a panel by accident.

/** Movement (px) before the gesture picks an axis. */
export const SHEET_SLOP = 10;
/** Vertical must beat horizontal by this factor to count as a sheet drag. */
export const SHEET_AXIS_RATIO = 1.3;
/** Dismiss past this share of the sheet height (never less than SHEET_MIN_DISTANCE). */
export const SHEET_CLOSE_FRACTION = 0.25;
export const SHEET_MIN_DISTANCE = 120;
/** A downward flick this fast (px/ms) dismisses once it has travelled SHEET_FLICK_DISTANCE. */
export const SHEET_FLICK_VELOCITY = 0.5;
export const SHEET_FLICK_DISTANCE = 50;
/** Place card: an upward drag this far (px) or this fast opens the details. */
export const CARD_EXPAND_DISTANCE = 60;
export const CARD_EXPAND_VELOCITY = 0.5;

/**
 * Which way a touch goes: null while inside the slop, 'drag' for a downward pull that starts with
 * the content scrolled to the top, else 'ignore' (the content scrolls, or it is a sideways swipe).
 */
export function sheetAxis(dx: number, dy: number, atTop: boolean): 'drag' | 'ignore' | null {
  if (Math.abs(dx) < SHEET_SLOP && Math.abs(dy) < SHEET_SLOP) return null;
  return atTop && dy > 0 && dy > Math.abs(dx) * SHEET_AXIS_RATIO ? 'drag' : 'ignore';
}

/** The sheet follows the finger down; upward it barely moves (rubber band). */
export function sheetOffset(dy: number): number {
  return dy >= 0 ? dy : dy / 8;
}

/** Whether a released drag dismisses the sheet. `velocity` in px/ms, positive downward. */
export function shouldDismissSheet(dy: number, velocity: number, height: number): boolean {
  if (dy > Math.max(SHEET_MIN_DISTANCE, height * SHEET_CLOSE_FRACTION)) return true;
  return velocity > SHEET_FLICK_VELOCITY && dy > SHEET_FLICK_DISTANCE;
}

/** Place card release: 'expand' (open details), 'dismiss' (close) or 'stay'. */
export function cardRelease(dy: number, velocity: number): 'expand' | 'dismiss' | 'stay' {
  if (dy < -CARD_EXPAND_DISTANCE || (velocity < -CARD_EXPAND_VELOCITY && dy < -SHEET_SLOP)) return 'expand';
  if (dy > 80 || (velocity > SHEET_FLICK_VELOCITY && dy > SHEET_SLOP)) return 'dismiss';
  return 'stay';
}
