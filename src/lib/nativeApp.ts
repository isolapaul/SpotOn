// The Android/iOS app (Capacitor, capacitor.config.ts): its native bridge defines window.Capacitor
// before the page's own scripts run, so the check needs no import and works on the first render.
// Pure: no React, no Firebase, no plugin imports (those are loaded on demand by the callers).

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitorOf(scope: object): CapacitorGlobal | undefined {
  return (scope as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the native app shell, false in every browser (including the installed PWA). */
export function isNativeApp(scope: object = globalThis): boolean {
  return capacitorOf(scope)?.isNativePlatform?.() === true;
}

/** 'ios' or 'android' inside the app, null in a browser. */
export function nativePlatform(scope: object = globalThis): 'ios' | 'android' | null {
  if (!isNativeApp(scope)) return null;
  const platform = capacitorOf(scope)?.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : null;
}

/**
 * Whether Sign in with Apple is offered: the build enables it (NEXT_PUBLIC_APPLE_SIGN_IN) and this is
 * a browser or the iOS app (the Android app keeps Google and e-mail; Apple requires it only on iOS).
 */
export function offersAppleSignIn(enabled: boolean, scope: object = globalThis): boolean {
  return enabled && nativePlatform(scope) !== 'android';
}

/** Error code of a native sign-in the user closed (the account picker): not an error to show. */
export const SIGN_IN_CANCELLED = 'app/sign-in-cancelled';

/** True for a sign-in the user cancelled in the app's native account picker. */
export function isSignInCancelled(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === SIGN_IN_CANCELLED;
}

/**
 * The in-app address of a link that opened the app (Android App Links: a shared spot link), or null
 * for a link to another site or an unparsable one. Only the app's own origin is followed.
 */
export function appLinkPath(url: string, origin: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
