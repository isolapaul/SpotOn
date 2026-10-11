import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, GoogleAuthProvider, OAuthProvider, browserLocalPersistence,
  setPersistence, connectAuthEmulator, type Auth,
} from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import { isNativeApp } from './nativeApp';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Auth inside the Android/iOS app: no pop-up/redirect resolver (sign-in is native there) and IndexedDB
 * persistence. getAuth() would load the authDomain's iframe, which the app's local origin cannot use,
 * and on iOS the first auth state then never arrives.
 */
function authFor(app: FirebaseApp): Auth {
  if (!isNativeApp()) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch {
    return getAuth(app); // already initialised (hot reload)
  }
}

// Initialize Firebase (only once)
const initializeFirebase = () => {
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    return {
      app,
      auth: authFor(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  } else {
    const app = getApps()[0];
    return {
      app,
      auth: authFor(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  }
};

const { app, auth, db, storage } = initializeFirebase();

// Explicitly set persistence to browserLocalPersistence
// This ensures auth state persists across tabs, windows, and page reloads
// Critical for multi-device support - each device maintains its own independent session
if (globalThis.window !== undefined && !isNativeApp()) {
  void setPersistence(auth, browserLocalPersistence);
}

// Initialize Cloud Functions (europe-west3 region)
const functions = getFunctions(app, 'europe-west3');
// Emulators (tests only). next.config.mjs always inlines '1' or '0', so production
// bundles constant-fold this branch away (see T04).
if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Sign in with Apple (App Store guideline 4.8 next to Google). Shown only when the build enables it
// (NEXT_PUBLIC_APPLE_SIGN_IN=1) after the Apple provider is set up in Firebase Auth.
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export { app, auth, db, storage, functions, googleProvider, appleProvider };
