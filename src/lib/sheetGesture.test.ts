import { describe, expect, it } from 'vitest';
import { cardRelease, sheetAxis, sheetOffset, shouldDismissSheet } from './sheetGesture';

describe('sheetAxis', () => {
  it('waits inside the slop', () => {
    expect(sheetAxis(3, 6, true)).toBeNull();
  });
  it('drags only downward, mostly vertical, from the top of the content', () => {
    expect(sheetAxis(2, 20, true)).toBe('drag');
    expect(sheetAxis(2, 20, false)).toBe('ignore'); // the content scrolls instead
    expect(sheetAxis(20, 18, true)).toBe('ignore'); // diagonal / sideways never drags
    expect(sheetAxis(0, -20, true)).toBe('ignore'); // upward is a scroll
  });
});

describe('sheetOffset', () => {
  it('follows down, resists up', () => {
    expect(sheetOffset(100)).toBe(100);
    expect(sheetOffset(-80)).toBe(-10);
  });
});

describe('shouldDismissSheet', () => {
  it('needs a quarter of the height (at least 120 px) or a real flick', () => {
    expect(shouldDismissSheet(100, 0.1, 800)).toBe(false);
    expect(shouldDismissSheet(210, 0.1, 800)).toBe(true);
    expect(shouldDismissSheet(130, 0.1, 400)).toBe(true);
    expect(shouldDismissSheet(60, 0.8, 800)).toBe(true);
    expect(shouldDismissSheet(30, 2, 800)).toBe(false); // a twitch is not a flick
  });
});

describe('cardRelease', () => {
  it('expands on a pull up, dismisses on a pull down, else stays', () => {
    expect(cardRelease(-70, 0)).toBe('expand');
    expect(cardRelease(-20, -0.8)).toBe('expand');
    expect(cardRelease(90, 0)).toBe('dismiss');
    expect(cardRelease(20, 0.8)).toBe('dismiss');
    expect(cardRelease(-30, -0.1)).toBe('stay');
    expect(cardRelease(40, 0.1)).toBe('stay');
  });
});
