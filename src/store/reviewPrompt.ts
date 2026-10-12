// The native store rating prompt (growth plan §9): StoreKit on iOS, Play In-App Review on Android
// (@capacitor-community/in-app-review); never in a browser. The last ask is kept on the device.
import { isNativeApp } from '@/lib/nativeApp';
import { mayAskForReview } from '@/lib/reviewPrompt';
import { track } from './telemetry';

const KEY = 'spoton-review-asked';

function lastAsked(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const ms = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/** Asks for a rating when allowed (apps only, at most every 120 days). Silent on failure. */
export async function maybeAskForReview(now = Date.now()): Promise<void> {
  if (!isNativeApp() || !mayAskForReview(lastAsked(), now)) return;
  try {
    globalThis.localStorage?.setItem(KEY, String(now));
  } catch {
    // Storage blocked: the system's own limits still apply.
  }
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    track('review_prompt');
  } catch (error) {
    console.warn('Review prompt unavailable:', error);
  }
}
