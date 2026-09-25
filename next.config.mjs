const isDev = process.env.NODE_ENV !== 'production';
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

// Content-Security-Policy built from the hosts the app actually uses (T15).
// headers()/rewrites() are evaluated at build time, so every env var read here is a build-time input.
// - dev (`next dev`) adds 'unsafe-eval' (React Refresh) and drops upgrade-insecure-requests;
// - emulator test builds (NEXT_PUBLIC_USE_EMULATORS=1) allow the local http/ws emulator endpoints and
//   must not upgrade http:// sub-resources.
function buildCsp() {
  const local = useEmulators ? ['http://127.0.0.1:*', 'http://localhost:*'] : [];
  const d = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), 'https://apis.google.com', 'https://www.gstatic.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://*.basemaps.cartocdn.com', 'https://server.arcgisonline.com', 'https://firebasestorage.googleapis.com', 'https://*.googleusercontent.com', ...local],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'https://*.googleapis.com', 'https://*.cloudfunctions.net', 'https://apis.google.com', ...local, ...(useEmulators ? ['ws://127.0.0.1:*', 'ws://localhost:*'] : [])],
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

const HSTS = { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' };
const NOSNIFF = { key: 'X-Content-Type-Options', value: 'nosniff' };
const REFERRER = { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (T16).
  output: 'standalone',
  // Images are unoptimized; keep libvips out of the image (SEC-07).
  outputFileTracingExcludes: { '*': ['node_modules/sharp/**', 'node_modules/@img/**'] },
  // Keep them as real node_modules packages in the standalone output, so Trivy and the SBOM see them (T18).
  serverExternalPackages: ['nodemailer', 'jose'],
  // Separate output dir for emulator/E2E builds so they never overwrite a real .next build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Always inline a definite value so production bundles constant-fold the emulator branch away.
  env: {
    NEXT_PUBLIC_USE_EMULATORS: useEmulators ? '1' : '0',
  },
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", 
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com", 
      },
    ],
  },
  async headers() {
    return [
      {
        // Everything except the proxied Firebase auth paths: the SDK embeds /__/auth/iframe and the
        // handler page runs Firebase's own scripts, so our CSP / X-Frame-Options must never apply there.
        // (Next 16.3.6 sends no headers() entries on external-rewrite responses anyway; this exclusion
        // is defence in depth for future versions.) This also covers /api/firebase-messaging-sw: the
        // global CSP is the service worker's policy.
        source: '/:path((?!__/auth(?:/|$)|__/firebase/init\\.json$).*)',
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp() },
          NOSNIFF,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          REFERRER,
          HSTS,
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()' },
          // Not 'same-origin': that breaks the Google sign-in popup.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        // Upstream Firebase headers pass through on the proxied paths; only transport-level headers here
        // (applies to local /__/ responses and to future Next versions that header rewritten paths).
        source: '/__/:path*',
        headers: [HSTS, NOSNIFF, REFERRER],
      },
    ];
  },
  // Firebase auth proxy ("redirect best practices", option 3): /__/auth/* and /__/firebase/init.json are
  // proxied transparently (not redirected) to <project>.firebaseapp.com, so authDomain can be the app's
  // own host and signInWithRedirect works in browsers that block third-party storage (D6).
  // - In production, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must equal the serving host (spoton.isolapaul.hu;
  //   see D6 and docs/deploy.md). The OAuth redirect URI is then https://<host>/__/auth/handler.
  // - On Vercel it stays <project>.firebaseapp.com until Stage B (the proxy is then simply unused).
  // - src/lib/firebase.ts needs no change: it already reads authDomain from the env.
  // Disabled in emulator builds (the Auth emulator serves its own handler).
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId || useEmulators) return [];
    const upstream = `https://${projectId}.firebaseapp.com`;
    return [
      { source: '/__/auth/:path*', destination: `${upstream}/__/auth/:path*` },
      { source: '/__/firebase/init.json', destination: `${upstream}/__/firebase/init.json` },
    ];
  },
  // Service worker is now served from API route at /api/firebase-messaging-sw
};

export default nextConfig;
