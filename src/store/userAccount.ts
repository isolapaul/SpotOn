import {
  signInWithPopup,
  signInWithRedirect,
  type User as FirebaseUser,
  type AuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/lib/firebase';
import { mapUserDoc, type User } from '@/lib/mapUserDoc';
import { generateUsername } from '@/lib/username';
import { TERMS_VERSION } from '@/lib/terms';
import { signInWithAppleNative, signInWithGoogleNative } from './nativeAuth';
import { isNativeApp } from '@/lib/nativeApp';
import { track } from './telemetry';
import { useReferralStore } from './useReferralStore';
import { errorCode } from './userErrors';
import type { SetState } from './userStoreTypes';

export const claimUsernameCallable = httpsCallable<{ username: string }, { username: string }>(functions, 'claimUsername');

export function authInfoOf(firebaseUser: FirebaseUser) {
  return { email: firebaseUser.email, photoURL: firebaseUser.photoURL };
}

// > 0 while a popup/redirect/email-signup flow may be creating a user; onAuthStateChanged
// then leaves user-doc creation and username claiming to that flow. A counter, so
// overlapping flows never clear each other's guard.
let newUserSetupDepth = 0;

/** Starts a new-user flow's guard (ended by endNewUserSetup). */
export function beginNewUserSetup() {
  newUserSetupDepth++;
}

/** Whether a sign-in flow that may create the user owns the user state right now. */
export function isNewUserSetupRunning(): boolean {
  return newUserSetupDepth > 0;
}

/**
 * Creates the new user's own doc (never with a username: that goes through claimUsername). Signing
 * up is the acceptance of the current terms (A1: the sign-in sheet says so), recorded here.
 */
export async function createUserDoc(firebaseUser: FirebaseUser): Promise<Record<string, unknown>> {
  const data = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    profilePictureURL: firebaseUser.photoURL || '',
    profileBannerURL: '',
    savedSpots: [],
    termsVersion: TERMS_VERSION,
  };
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    ...data,
    termsAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
  track('sign_up');
  useReferralStore.getState().markSignedUp();
  return data;
}

/** Claims a generated username, retrying with a fresh one on collision. Null on failure (logged). */
export async function claimGeneratedUsername(displayName: string): Promise<string | null> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await claimUsernameCallable({ username: generateUsername(displayName) });
      return result.data.username;
    } catch (error) {
      const code = errorCode(error);
      // invalid-argument: a rare too-short generated name (1-char base + 1-digit suffix)
      if (code === 'functions/already-exists' || code === 'functions/invalid-argument') continue;
      console.error('Failed to claim generated username:', error);
      return null;
    }
  }
  console.error('Failed to claim generated username: all candidates taken');
  return null;
}

export function withUsername(data: Record<string, unknown>, username: string | null): Record<string, unknown> {
  return username ? { ...data, username } : data;
}

/** Loads the signed-in user's doc into the store, creating it (plus a generated username) if missing. */
export async function loadOrCreateUser(firebaseUser: FirebaseUser, set: SetState): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (newUserSetupDepth > 0) {
    // A sign-in flow started meanwhile; it sets the user itself
    return;
  }

  if (userSnap.exists()) {
    const data = userSnap.data();

    // Check if username needs to be set
    if (!data.username) {
      set({ needsUsername: true });
    }

    set({ user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data), loading: false });
  } else {
    // User document doesn't exist yet (shouldn't happen normally)
    // Create it now to prevent issues
    let data = await createUserDoc(firebaseUser);
    data = withUsername(data, await claimGeneratedUsername(firebaseUser.displayName || 'user'));

    set({
      user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data),
      loading: false,
      needsUsername: true,
      newAccount: 'generated',
    });
  }
}

/**
 * Ends a new-user flow's guard. If the flow failed after Firebase Auth signed the user in,
 * the auth listener skipped that user, so load (or create) it now instead of leaving the
 * UI signed out while Auth is signed in.
 */
export function endNewUserSetup(set: SetState, getUser: () => User | null, recover = true) {
  newUserSetupDepth = Math.max(0, newUserSetupDepth - 1);
  const current = auth.currentUser;
  if (recover && newUserSetupDepth === 0 && current && getUser()?.uid !== current.uid) {
    loadOrCreateUser(current, set).catch((error) => {
      console.error('Failed to load signed-in user:', error);
    });
  }
}

/**
 * Sign-in through an OAuth provider (Google, Apple): pop-up first, the redirect as the fallback
 * (initAuth finishes it); a new account gets a generated username and is asked to pick one.
 */
export async function signInWithProvider(provider: AuthProvider, set: SetState, getUser: () => User | null): Promise<void> {
    newUserSetupDepth++;
    try {
      let result;
      
      // Try popup first, fallback to redirect for mobile browsers
      try {
        // The Android/iOS app: providers refuse WebView sign-in, the native SDKs sign in (nativeAuth.ts).
        if (isNativeApp()) {
          result = provider.providerId === 'apple.com' ? await signInWithAppleNative() : await signInWithGoogleNative();
        } else {
          result = await signInWithPopup(auth, provider);
        }
      } catch (popupError) {
        if (isNativeApp()) throw popupError;
        // If popup blocked or fails on mobile, try redirect
        const code = (popupError as { code?: string }).code;
        if (code === 'auth/popup-blocked' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request' ||
            code === 'auth/operation-not-supported-in-this-environment') {
          // Redirect flow - user will be redirected back and handled by initAuth
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }
      
      if (!result) return;
      
      const firebaseUser = result.user;
      
      // Create or update user document in Firestore (idempotent)
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      let data: Record<string, unknown>;
      let needsUsernameSetup = false;
      let newAccount: 'generated' | null = null;
      
      if (userSnap.exists()) {
        // EXISTING USER: Only update lastLoginAt, preserve all other data
        data = userSnap.data();
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp()
        });
        
        // If no custom username, claim one and prompt to change it
        if (!data.username) {
          data = withUsername(data, await claimGeneratedUsername(firebaseUser.displayName || 'user'));
          needsUsernameSetup = true;
        }
      } else {
        // NEW USER: Create the document, then claim a generated username
        data = await createUserDoc(firebaseUser);
        data = withUsername(data, await claimGeneratedUsername(firebaseUser.displayName || 'user'));
        needsUsernameSetup = true;
        newAccount = 'generated';
      }
      
      set({
        user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data),
        loading: false,
        needsUsername: needsUsernameSetup,
        newAccount,
      });
    } catch (error) {
      console.error('Sign-in error:', error);
      set({ loading: false });
      throw error;
    } finally {
      endNewUserSetup(set, getUser);
    }
}
