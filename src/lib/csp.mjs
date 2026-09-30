// Content-Security-Policy builder (T15, nonce support T32). Pure ES module with JSDoc types, so that both
// next.config.mjs (plain Node) and src/proxy.ts can import it.
// - dev (`next dev`) adds 'unsafe-eval' (React debugging) and drops upgrade-insecure-requests;
// - emulator test builds (NEXT_PUBLIC_USE_EMULATORS=1) allow the local http/ws emulator endpoints and
//   must not upgrade http:// sub-resources;
// - nonce null: T15's static policy, byte for byte (kept for /api/*: the FCM service worker takes its CSP
//   from its own response and needs importScripts from gstatic);
// - nonce set: per-request page policy. script-src uses 'nonce-…' 'strict-dynamic' without 'unsafe-inline'.
//   The host allowlist stays as a CSP2 fallback (CSP3 browsers ignore it under 'strict-dynamic').
//   style-src gets no nonce on purpose: a nonce makes browsers ignore 'unsafe-inline', and SSR HTML
//   carries style= attributes (next/image fill, React style props).

/**
 * @param {{ nonce: string | null, isDev: boolean, useEmulators: boolean }} options
 * @returns {string}
 */
export function buildCsp({ nonce, isDev, useEmulators }) {
  const local = useEmulators ? ['http://127.0.0.1:*', 'http://localhost:*'] : [];
  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])]
    : ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])];
  /** @type {Record<string, string[]>} */
  const d = {
    'default-src': ["'self'"],
    'script-src': [...scriptSrc, 'https://apis.google.com', 'https://www.gstatic.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://api.mapbox.com', 'https://firebasestorage.googleapis.com', 'https://*.googleusercontent.com', ...local],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'https://api.mapbox.com', 'https://*.tiles.mapbox.com', 'https://events.mapbox.com', 'https://*.googleapis.com', 'https://*.cloudfunctions.net', 'https://apis.google.com', ...local, ...(useEmulators ? ['ws://127.0.0.1:*', 'ws://localhost:*'] : [])],
    'frame-src': ["'self'", 'https://*.firebaseapp.com', 'https://apis.google.com', 'https://accounts.google.com', ...local],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev && !useEmulators) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}
