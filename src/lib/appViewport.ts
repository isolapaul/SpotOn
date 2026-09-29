// Installed iPhone app (design 1A). With the see-through status bar, iOS 26 sizes the page one
// status bar short of the screen and leaves a strip below it that nothing can paint (WebKit bug
// 301108). Sizing <html> and <body> to the screen height makes iOS give the page the whole screen
// (verified on the owner's iPhone). Pure: the hook in hooks/useStandaloneFullHeight applies it.

export interface StandaloneSample {
  standalone: boolean;
  userAgent: string;
  /** env(safe-area-inset-top) in CSS px: 0 when the status bar is opaque (the page starts below it). */
  safeAreaTop: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * The height to give <html> and <body>, or null to leave the CSS default. Only the installed iPhone
 * app with the see-through status bar (the page starts under the status bar) needs it; with an
 * opaque one the page is already right, and a screen-tall document would scroll.
 */
export function standaloneDocumentHeight(v: StandaloneSample): number | null {
  if (!v.standalone || !/iPhone/.test(v.userAgent) || v.safeAreaTop <= 0) return null;
  return Math.max(v.screenWidth, v.screenHeight);
}
