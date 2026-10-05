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

/** 'android' | 'ios' inside the native app, else null. */
export function nativePlatform(scope: object = globalThis): 'android' | 'ios' | null {
  if (!isNativeApp(scope)) return null;
  const platform = capacitorOf(scope)?.getPlatform?.();
  return platform === 'android' || platform === 'ios' ? platform : null;
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
