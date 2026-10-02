import { NextResponse } from 'next/server';
import { SW_SOURCE } from './swBundle.generated';

// The FCM service worker: the Firebase config (public NEXT_PUBLIC_* values), then the bundled
// worker (src/sw/firebase-messaging-sw.ts, built by scripts/build-sw.mjs on the modular SDK).
export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const script = `self.FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};\n${SW_SOURCE}`;
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
