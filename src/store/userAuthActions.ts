import {
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { appleProvider, auth, db, functions, googleProvider } from '@/lib/firebase';
import { mapUserDoc } from '@/lib/mapUserDoc';
import { normalizeUsername } from '@/lib/username';
import { TERMS_VERSION } from '@/lib/terms';
import { forgetDevice } from './pushDevice';
import { useNotificationStore } from './useNotificationStore';
import { useFeedStore } from './useFeedStore';
import { signOutNative } from './nativeAuth';
import { isNativeApp } from '@/lib/nativeApp';
import {
  authInfoOf,
  beginNewUserSetup,
  claimGeneratedUsername,
  claimUsernameCallable,
  createUserDoc,
  endNewUserSetup,
  isNewUserSetupRunning,
  loadOrCreateUser,
  signInWithProvider,
  withUsername,
} from './userAccount';
import { startAdminListeners, stopAdminListeners } from './userAdmin';
import { errorCode } from './userErrors';
import type { StoreGet, StoreSet, UserStore } from './userStoreTypes';

// Deleting touches every spot and several Storage folders: allow more than the default 70 s.
const deleteAccountCallable = httpsCallable<{ confirmUsername: string }, unknown>(functions, 'deleteAccount', {
  timeout: 300_000,
});

// Module-level variable to track the onAuthStateChanged unsubscribe function
// This prevents duplicate listeners when initAuth is called multiple times
let authListenerUnsub: (() => void) | null = null;

type AuthActions = Pick<
  UserStore,
  'signInWithGoogle' | 'signInWithApple' | 'signInWithEmail' | 'signUpWithEmail' | 'deleteAccount' | 'acceptTerms' | 'signOut' | 'initAuth' | 'getIdToken'
>;

/** Sign-in, sign-up, sign-out, the auth listener and account deletion. */
export function createAuthActions(set: StoreSet, get: StoreGet): AuthActions {
  return {
    signInWithGoogle: () => signInWithProvider(googleProvider, set, () => get().user),
    signInWithApple: () => signInWithProvider(appleProvider, set, () => get().user),

    signInWithEmail: async (email: string, password: string) => {
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;
        
        // Get user document from Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          
          // Update lastLoginAt for existing user
          await updateDoc(userRef, {
            lastLoginAt: serverTimestamp()
          });
          
          // Check if username needs to be set
          if (!data.username) {
            set({ needsUsername: true });
          }
          
          set({ user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data), loading: false });
        }
      } catch (error) {
        set({ loading: false });
        throw error;
      }
    },

    signUpWithEmail: async (email: string, password: string, username: string) => {
      beginNewUserSetup();
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;
        
        // Create user document in Firestore (without username), then claim the chosen name
        let data = await createUserDoc(firebaseUser);
        let needsUsernameSetup = false;
        try {
          const claimed = await claimUsernameCallable({ username: normalizeUsername(username) });
          data = withUsername(data, claimed.data.username);
        } catch (error) {
          const code = errorCode(error);
          if (code === 'functions/already-exists' || code === 'functions/invalid-argument') {
            // Chosen name unavailable: claim a generated one and let the username modal ask again
            data = withUsername(data, await claimGeneratedUsername(firebaseUser.displayName || 'user'));
          } else {
            // Claim failed otherwise (e.g. callable unavailable): the doc exists, so sign the
            // user in and let the username modal ask again
            console.error('Failed to claim username:', error);
          }
          needsUsernameSetup = true;
        }
        
        set({
          user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data),
          loading: false,
          needsUsername: needsUsernameSetup,
          newAccount: 'chosen',
        });
      } catch (error) {
        set({ loading: false });
        throw error;
      } finally {
        endNewUserSetup(set, () => get().user);
      }
    },
    
    deleteAccount: async (confirmUsername: string) => {
      await deleteAccountCallable({ confirmUsername });
      // The users doc is gone already: only the device is unregistered.
      await forgetDevice(null);
      stopAdminListeners(set);
      await firebaseSignOut(auth);
      if (isNativeApp()) await signOutNative();
      // The device's notification list belongs to the account (the next one must not see it).
      useNotificationStore.getState().clearAll();
      useFeedStore.getState().markSeen(0);
      set({ user: null, loading: false });
    },

    acceptTerms: async () => {
      const { user } = get();
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid), {
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: serverTimestamp(),
      });
      set({ user: { ...user, termsVersion: TERMS_VERSION } });
    },

    signOut: async () => {
      const { user } = get();
      // This device's push registration leaves the user doc and FCM (SEC-14).
      await forgetDevice(user?.uid ?? null);

      stopAdminListeners(set);

      await firebaseSignOut(auth);
      if (isNativeApp()) await signOutNative();
      set({ user: null, loading: false });
    },
    
    initAuth: async () => {
      // Clean up existing listener to prevent duplicates
      if (authListenerUnsub) {
        authListenerUnsub();
        authListenerUnsub = null;
      }

      // Check for redirect result first (handles signInWithRedirect flow)
      beginNewUserSetup();
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          // User signed in via redirect, handle the same way as popup
          const firebaseUser = redirectResult.user;
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          let data: Record<string, unknown>;
          let newAccount: 'generated' | null = null;
          if (userSnap.exists()) {
            // Existing user - just update lastLoginAt
            data = userSnap.data();
            await updateDoc(userRef, {
              lastLoginAt: serverTimestamp()
            });
          } else {
            // New user from redirect - create document, then claim a generated username
            data = await createUserDoc(firebaseUser);
            data = withUsername(data, await claimGeneratedUsername(firebaseUser.displayName || 'user'));
            newAccount = 'generated';
          }
          // A new account (or one without a name) picks its username, as after the popup sign-in.
          const needsName = newAccount !== null || typeof data.username !== 'string' || !data.username;
          set({ user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data), newAccount, ...(needsName ? { needsUsername: true } : {}) });
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
      } finally {
        // No recovery needed: the auth listener registered below loads the signed-in user
        endNewUserSetup(set, () => get().user, false);
      }
      
      return new Promise<void>((resolve) => {
        let isFirstCall = true;
        
        authListenerUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            // User is signed in
            startAdminListeners(firebaseUser.uid, set);

            // A sign-in flow that may create the user owns the user state while it runs
            if (!isNewUserSetupRunning()) {
              try {
                await loadOrCreateUser(firebaseUser, set);
              } catch (error) {
                // Never block startup on a failed profile read (e.g. offline).
                console.error('Error loading user profile:', error);
                set({ loading: false });
              }
            }
          } else {
            // User is signed out
            stopAdminListeners(set);
            set({ user: null, loading: false, needsUsername: false, newAccount: null });
          }
          
          // Resolve promise on first auth state change
          if (isFirstCall) {
            isFirstCall = false;
            resolve();
          }
        });
      });
    },

    getIdToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  };
}
