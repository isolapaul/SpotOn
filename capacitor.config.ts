import type { CapacitorConfig } from '@capacitor/cli';

// The Android and iOS apps (Capacitor). The app is its own build: `npm run build:app` exports the web
// app statically (next.config.mjs, NEXT_PUBLIC_APP_BUILD=1) into out-app/, which is bundled into the
// native projects, so the app starts without the network, works offline as far as Firestore allows,
// and gets app-only extras (native sign-in, push, haptics, the Dynamic Island, quick actions, more
// animation). Data comes from Firebase; the few server routes (feedback) are called on the live site.
// A web change reaches the apps with the next app release. docs/deploy.md §17 is the runbook.
//
// CAP_SERVER_URL points a development build at a server instead (for example http://10.0.2.2:3000, the
// laptop's `npm run dev` from the Android emulator, for live reload). Read by `npx cap sync`.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'hu.isolapaul.spoton',
  appName: 'SpotOn',
  webDir: 'out-app',
  backgroundColor: '#0E1013',
  // Lets the server and analytics tell the app apart from a browser ("… SpotOnApp").
  appendUserAgent: 'SpotOnApp',
  ...(serverUrl ? { server: { url: serverUrl, cleartext: serverUrl.startsWith('http://') } } : {}),
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
      // Apple: Sign in with Apple in the iOS app (App Store 4.8), shown with NEXT_PUBLIC_APPLE_SIGN_IN.
      providers: ['google.com', 'apple.com'],
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
