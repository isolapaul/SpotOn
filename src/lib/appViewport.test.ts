import { describe, expect, it } from 'vitest';
import { computeAppHeight } from './appViewport';

// iPhone 15: 393 x 852 screen; the installed app reports a viewport one status bar (47pt) short.
const iphone = { screenWidth: 393, screenHeight: 852 };

describe('computeAppHeight', () => {
  it('uses the screen height for the installed iOS app when the reported viewport is short', () => {
    expect(computeAppHeight({ standalone: true, innerWidth: 393, innerHeight: 805, ...iphone })).toBe(852);
  });

  it('keeps the page height when iOS already reports the full screen', () => {
    expect(computeAppHeight({ standalone: true, innerWidth: 393, innerHeight: 852, ...iphone })).toBe(852);
  });

  it('handles landscape (screen size is reported portrait)', () => {
    expect(computeAppHeight({ standalone: true, innerWidth: 852, innerHeight: 372, ...iphone })).toBe(393);
  });

  it('keeps the CSS default in a browser tab and on Android', () => {
    expect(computeAppHeight({ standalone: false, innerWidth: 393, innerHeight: 700, ...iphone })).toBeNull();
  });

  it('keeps the CSS default in iPad split view (window narrower than the screen)', () => {
    expect(computeAppHeight({ standalone: true, innerWidth: 507, innerHeight: 1024, screenWidth: 768, screenHeight: 1024 })).toBeNull();
  });
});
