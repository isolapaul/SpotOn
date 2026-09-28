// App height for the installed iOS app (design 1A). Pure.
//
// In iOS standalone mode with the black-translucent status bar the page is drawn from the very
// top of the screen, but the viewport iOS reports (and so 100vh/100dvh and position:fixed) is about
// one status bar shorter than the screen. The strip below it showed the black page background.
// A full-screen app window is exactly the screen, so there the screen height is the app height.

export interface ViewportSample {
  /** navigator.standalone (iOS only; true for a home-screen app). */
  standalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * The app height in CSS px, or null to keep the CSS default (100dvh): browsers, Android, and
 * iPad split view / Stage Manager, where the window is narrower than the screen.
 */
export function computeAppHeight(v: ViewportSample): number | null {
  if (!v.standalone) return null;
  const long = Math.max(v.screenWidth, v.screenHeight);
  const short = Math.min(v.screenWidth, v.screenHeight);
  const portrait = v.innerHeight >= v.innerWidth;
  const [fullWidth, fullHeight] = portrait ? [short, long] : [long, short];
  if (Math.abs(v.innerWidth - fullWidth) >= 2) return null;
  // Never shorter than what the page already has (a future iOS may report the full height).
  return Math.max(v.innerHeight, fullHeight);
}
