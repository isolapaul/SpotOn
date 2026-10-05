// Google sign-in inside the Android/iOS app. Google refuses OAuth in embedded WebViews
// (disallowed_useragent), so the native Google SDK signs in and hands over its ID token; the web SDK
// then signs in with it, and the app keeps the same single Firebase session as in a browser
// (FirebaseAuthentication.skipNativeAuth in capacitor.config.ts).
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** Resolves with the signed-in credential; rejects with auth/popup-closed-by-user when the user cancels. */
export async function signInWithGoogleNative(): Promise<UserCredential> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  let idToken: string | undefined;
  try {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    idToken = result.credential?.idToken;
  } catch (error) {
    // The plugin reports a closed account picker as an error; the UI treats it like a closed popup.
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) throw Object.assign(new Error(message), { code: 'auth/popup-closed-by-user' });
    throw error;
  }
  if (!idToken) throw Object.assign(new Error('No Google ID token'), { code: 'auth/internal-error' });
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/** Signs the native Google SDK out too, so the next sign-in offers the account choice again. */
export async function signOutNative(): Promise<void> {
  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  } catch (error) {
    console.error('Native sign-out failed:', error);
  }
}
