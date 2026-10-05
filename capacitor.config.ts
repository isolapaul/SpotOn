import type { CapacitorConfig } from '@capacitor/cli';

// The Android and iOS apps (Capacitor). The native shell loads the live site, like the PWA and the
// earlier TWA plan: every web release reaches the apps without a store update. Native code covers what a
// WebView cannot do on its own: Google sign-in (Google blocks OAuth in embedded WebViews), push
// notifications (no Web Push in a WebView), the Android back button, app links and the share sheet.
// docs/deploy.md §17 is the runbook.
//
// CAP_SERVER_URL points a development build at another server (for example http://10.0.2.2:3000, the
// laptop's `npm run dev` from the Android emulator). It is read by `npx cap sync`, not at runtime.
const serverUrl = process.env.CAP_SERVER_URL || 'https://spoton.isolapaul.hu';

const config: CapacitorConfig = {
  appId: 'hu.isolapaul.spoton',
  appName: 'SpotOn',
  // Only the offline page (errorPath) and a fallback index.html: the app itself comes from serverUrl.
  webDir: 'mobile/www',
  backgroundColor: '#0E1013',
  // Lets the server and analytics tell the app apart from a browser ("… SpotOnApp").
  appendUserAgent: 'SpotOnApp',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    // Shown when the site cannot be loaded (offline, server down).
    errorPath: 'offline.html',
  },
  android: {
    path: 'mobile/android',
  },
  ios: {
    path: 'mobile/ios',
    // The page handles the safe areas itself (viewport-fit=cover, env(safe-area-inset-*)).
    contentInset: 'never',
  },
  plugins: {
    FirebaseAuthentication: {
      // Only the Google ID token is taken from the native side; the web SDK signs in with it
      // (src/store/nativeAuth.ts), so the web app keeps one Firebase session, as in the browser.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    FirebaseMessaging: {
      // In the foreground the notification centre shows the message instead (as on the web).
      presentationOptions: [],
    },
  },
  experimental: {
    ios: {
      spm: {
        // Package traits need Swift tools 6.1: only the Google Sign-In SDK, not the Facebook SDK.
        swiftToolsVersion: '6.1',
        packageTraits: { '@capacitor-firebase/authentication': ['Google'] },
        // Avoids a SwiftPM package identity collision with firebase-ios-sdk's own "messaging" (plugin README).
        packageOptions: { '@capacitor-firebase/messaging': { symlink: true } },
      },
    },
  },
};

export default config;
