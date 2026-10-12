// Cross-origin access to /api/feedback for the Android/iOS apps, which run the bundled web app from
// their own local origins (Capacitor: capacitor://localhost on iOS, https://localhost on Android) and
// send feedback to the live site. Browsers on the site itself are same-origin and need nothing. Pure.

/** The apps' web view origins (capacitor.config.ts: the default schemes). */
export const APP_ORIGINS: readonly string[] = ['capacitor://localhost', 'https://localhost'];

/** The CORS headers for a request from `origin`; none for any other origin. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !APP_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
