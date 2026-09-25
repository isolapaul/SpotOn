const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
// Test-only: local emulator endpoints, added to the CSP only in emulator builds.
const emulatorConnectSrc = useEmulators
  ? ' http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199 http://127.0.0.1:5001'
  : '';
const emulatorFrameSrc = useEmulators ? ' http://127.0.0.1:9099' : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.firebaseio.com https://www.gstatic.com https://apis.google.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://fcm.googleapis.com https://apis.google.com https://accounts.google.com https://*.openstreetmap.org https://*.basemaps.cartocdn.com https://tile.openstreetmap.fr https://server.arcgisonline.com" + emulatorConnectSrc,
              "frame-src 'self' https://*.google.com https://*.firebaseapp.com https://accounts.google.com" + emulatorFrameSrc,
              "worker-src 'self' blob:",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // Service worker is now served from API route at /api/firebase-messaging-sw
};

export default nextConfig;