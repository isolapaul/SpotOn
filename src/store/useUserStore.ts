import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { app, auth, db, functions, googleProvider, storage } from '@/lib/firebase';
import { mapUserDoc, type User } from '@/lib/mapUserDoc';
import { generateUsername, normalizeUsername } from '@/lib/username';
import { extForMime } from '@/lib/spotImages';
import imageCompression from 'browser-image-compression';

export type { User } from '@/lib/mapUserDoc';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  addedAt: any;
  addedBy: string;
  role?: string;
}

export interface LookedUpUser {
  uid: string;
  email: string;
  username: string;
  photoURL: string;
}

interface UserStore {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminUsers: AdminUser[];
  setUser: (user: User | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
  toggleFavorite: (spotId: string) => Promise<void>;
  addAdmin: (email: string) => Promise<void>;
  removeAdmin: (adminId: string) => Promise<void>;
  lookupUserByEmail: (email: string) => Promise<LookedUpUser | null>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<void>;
  updateProfilePicture: (file: File) => Promise<void>;
  updateProfileBanner: (file: File) => Promise<void>;
  setNeedsUsername: (needs: boolean) => void;
  highlightSpot: (spotId: string) => Promise<void>;
  unhighlightSpot: (spotId: string) => Promise<void>;
  updateCustomNameColor: (color: string) => Promise<void>;
  updateCustomNameFont: (font: string) => Promise<void>;
  rememberFcmToken: (token: string) => void;
}

type SetState = (partial: Partial<UserStore>) => void;

// Compress profile images before upload (max 1920px, ~1MB). Output types the Storage rules
// do not accept (e.g. GIF) are re-encoded as JPEG.
async function compressProfileImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: false,
  };
  const compressed = await imageCompression(file, options);
  if (extForMime(compressed.type)) return compressed;
  return imageCompression(file, { ...options, fileType: 'image/jpeg' });
}

// Callables (T08/T09, region europe-west3 via `functions`)
const claimUsernameCallable = httpsCallable<{ username: string }, { username: string }>(functions, 'claimUsername');
const lookupUserByEmailCallable = httpsCallable<{ email: string }, LookedUpUser>(functions, 'lookupUserByEmail');
const addAdminCallable = httpsCallable<{ email: string }, unknown>(functions, 'addAdmin');
const removeAdminCallable = httpsCallable<{ uid: string }, unknown>(functions, 'removeAdmin');
const updateNameStyleCallable = httpsCallable<{ color?: string; font?: string }, unknown>(functions, 'updateNameStyle');
// T10: highlights are written server-side only.
const highlightSpotCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'highlightSpot');
const unhighlightSpotCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'unhighlightSpot');

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

function authInfoOf(firebaseUser: FirebaseUser) {
  return { email: firebaseUser.email, photoURL: firebaseUser.photoURL };
}

/** The current client-side message for an invalid username, or null when it is valid. */
function usernameValidationError(name: string): string | null {
  if (name.length < 3 || name.length > 20) return 'Username must be 3-20 characters';
  if (!/^[a-z0-9_]+$/.test(name)) return 'Username can only contain letters, numbers, and underscores';
  return null;
}

// Module-level variable to track the onAuthStateChanged unsubscribe function
// This prevents duplicate listeners when initAuth is called multiple times
let authListenerUnsub: (() => void) | null = null;

// > 0 while a popup/redirect/email-signup flow may be creating a user; onAuthStateChanged
// then leaves user-doc creation and username claiming to that flow. A counter, so
// overlapping flows never clear each other's guard.
let newUserSetupDepth = 0;

// Admin identity listeners: own admins/{uid} doc, plus the admins list while admin.
let adminDocUnsub: (() => void) | null = null;
let adminListUnsub: (() => void) | null = null;
let adminListenerUid: string | null = null;

function stopAdminList(set: SetState) {
  if (adminListUnsub) {
    adminListUnsub();
    adminListUnsub = null;
  }
  set({ adminUsers: [] });
}

function stopAdminListeners(set: SetState) {
  if (adminDocUnsub) {
    adminDocUnsub();
    adminDocUnsub = null;
  }
  adminListenerUid = null;
  stopAdminList(set);
  set({ isAdmin: false, isSuperAdmin: false });
}

function startAdminListeners(uid: string, set: SetState) {
  if (adminDocUnsub && adminListenerUid === uid) return;
  stopAdminListeners(set);
  adminListenerUid = uid;
  adminDocUnsub = onSnapshot(
    doc(db, 'admins', uid),
    (snap) => {
      const isAdmin = snap.exists();
      const isSuperAdmin = isAdmin && snap.data().role === 'super';
      set({ isAdmin, isSuperAdmin });
      if (!isAdmin) {
        stopAdminList(set);
      } else if (!adminListUnsub) {
        adminListUnsub = onSnapshot(
          collection(db, 'admins'),
          (snapshot) => {
            const adminUsers = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }) as AdminUser)
              .filter((a) => a.role !== 'super');
            set({ adminUsers });
          },
          (error) => {
            console.error('Admin list listener error:', error);
            adminListUnsub = null; // dead after an error; allow a restart on the next admin snapshot
            set({ isAdmin: false, isSuperAdmin: false });
          },
        );
      }
    },
    (error) => {
      console.error('Admin listener error:', error);
      set({ isAdmin: false, isSuperAdmin: false });
    },
  );
}

/** Creates the new user's own doc (never with a username: that goes through claimUsername). */
async function createUserDoc(firebaseUser: FirebaseUser): Promise<Record<string, unknown>> {
  const data = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    profilePictureURL: firebaseUser.photoURL || '',
    profileBannerURL: '',
    savedSpots: [],
  };
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    ...data,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
  return data;
}

/** Claims a generated username, retrying with a fresh one on collision. Null on failure (logged). */
async function claimGeneratedUsername(displayName: string): Promise<string | null> {
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

function withUsername(data: Record<string, unknown>, username: string | null): Record<string, unknown> {
  return username ? { ...data, username } : data;
}

/** Loads the signed-in user's doc into the store, creating it (plus a generated username) if missing. */
async function loadOrCreateUser(firebaseUser: FirebaseUser, set: SetState): Promise<void> {
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
    });
  }
}

/**
 * Ends a new-user flow's guard. If the flow failed after Firebase Auth signed the user in,
 * the auth listener skipped that user, so load (or create) it now instead of leaving the
 * UI signed out while Auth is signed in.
 */
function endNewUserSetup(set: SetState, getUser: () => User | null, recover = true) {
  newUserSetupDepth = Math.max(0, newUserSetupDepth - 1);
  const current = auth.currentUser;
  if (recover && newUserSetupDepth === 0 && current && getUser()?.uid !== current.uid) {
    loadOrCreateUser(current, set).catch((error) => {
      console.error('Failed to load signed-in user:', error);
    });
  }
}

// This device's FCM token, remembered so sign-out can remove it (SEC-14).
const FCM_TOKEN_KEY = 'spoton-fcm-token';
let rememberedFcmToken: string | null = null;

function readRememberedFcmToken(): string | null {
  if (rememberedFcmToken) return rememberedFcmToken;
  try {
    return globalThis.localStorage?.getItem(FCM_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function clearRememberedFcmToken() {
  rememberedFcmToken = null;
  try {
    globalThis.localStorage?.removeItem(FCM_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

/** Deletes this device's FCM registration. Never prompts for permission. */
async function deleteDeviceFcmToken() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!(await isSupported())) return;
    if (!('serviceWorker' in navigator)) return;
    // The FCM service worker is registered with scope '/' by usePushNotifications.
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return;
    const messaging = getMessaging(app);
    await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    await deleteToken(messaging);
  } catch (error) {
    console.error('Failed to delete FCM token:', error);
  }
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      needsUsername: false,
      isAdmin: false,
      isSuperAdmin: false,
      adminUsers: [],
      
      setUser: (user) => set({ user, loading: false }),
      setNeedsUsername: (needs) => set({ needsUsername: needs }),
      
      signInWithGoogle: async () => {
        newUserSetupDepth++;
        try {
          let result;
          
          // Try popup first, fallback to redirect for mobile browsers
          try {
            result = await signInWithPopup(auth, googleProvider);
          } catch (popupError: any) {
            // If popup blocked or fails on mobile, try redirect
            if (popupError.code === 'auth/popup-blocked' || 
                popupError.code === 'auth/popup-closed-by-user' ||
                popupError.code === 'auth/cancelled-popup-request' ||
                popupError.code === 'auth/operation-not-supported-in-this-environment') {
              // Redirect flow - user will be redirected back and handled by initAuth
              await signInWithRedirect(auth, googleProvider);
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
          }
          
          set({
            user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data),
            loading: false,
            needsUsername: needsUsernameSetup,
          });
        } catch (error) {
          console.error('Google Sign-In error:', error);
          set({ loading: false });
          throw error;
        } finally {
          endNewUserSetup(set, () => get().user);
        }
      },

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
        newUserSetupDepth++;
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
          });
        } catch (error) {
          set({ loading: false });
          throw error;
        } finally {
          endNewUserSetup(set, () => get().user);
        }
      },
      
      signOut: async () => {
        const { user } = get();
        const token = readRememberedFcmToken();

        // Remove this device's push token from the user doc (primary cleanup, SEC-14)
        if (token && user) {
          try {
            await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(token) });
          } catch (error) {
            console.error('Failed to remove FCM token:', error);
          }
        }
        if (token) {
          await deleteDeviceFcmToken();
        }
        clearRememberedFcmToken();

        stopAdminListeners(set);

        await firebaseSignOut(auth);
        set({ user: null, loading: false });
      },
      
      initAuth: async () => {
        // Clean up existing listener to prevent duplicates
        if (authListenerUnsub) {
          authListenerUnsub();
          authListenerUnsub = null;
        }

        // Check for redirect result first (handles signInWithRedirect flow)
        newUserSetupDepth++;
        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult) {
            // User signed in via redirect, handle the same way as popup
            const firebaseUser = redirectResult.user;
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            
            let data: Record<string, unknown>;
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
            }
            set({ user: mapUserDoc(firebaseUser.uid, authInfoOf(firebaseUser), data) });
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
              if (newUserSetupDepth === 0) {
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
              set({ user: null, loading: false, needsUsername: false });
            }
            
            // Resolve promise on first auth state change
            if (isFirstCall) {
              isFirstCall = false;
              resolve();
            }
          });
        });
      },

      toggleFavorite: async (spotId: string) => {
        const { user } = useUserStore.getState();
        if (!user) return;

        try {
          const userRef = doc(db, 'users', user.uid);
          const isFavorite = user.savedSpots.includes(spotId);

          if (isFavorite) {
            // Remove from favorites
            await updateDoc(userRef, {
              savedSpots: arrayRemove(spotId),
            });
            set({
              user: {
                ...user,
                savedSpots: user.savedSpots.filter((id) => id !== spotId),
              },
            });
          } else {
            // Add to favorites
            await updateDoc(userRef, {
              savedSpots: arrayUnion(spotId),
            });
            set({
              user: {
                ...user,
                savedSpots: [...user.savedSpots, spotId],
              },
            });
          }
        } catch (error) {
          throw error;
        }
      },


      // Look up a user by email (super admin only; enforced by the callable)
      lookupUserByEmail: async (email: string) => {
        try {
          const result = await lookupUserByEmailCallable({ email });
          return result.data;
        } catch (error) {
          const code = errorCode(error);
          // invalid-argument: not an email address (e.g. "bob"); shown as "User not found" as before
          if (code === 'functions/not-found' || code === 'functions/invalid-argument') return null;
          throw error;
        }
      },

      // Add a new admin (only Super Admin can do this; enforced by the callable)
      addAdmin: async (email: string) => {
        if (!get().isSuperAdmin) {
          throw new Error('Only Super Admin can add admins');
        }
        await addAdminCallable({ email });
      },

      // Remove an admin (only Super Admin can do this; enforced by the callable)
      removeAdmin: async (adminId: string) => {
        if (!get().isSuperAdmin) {
          throw new Error('Only Super Admin can remove admins');
        }
        await removeAdminCallable({ uid: adminId });
      },

      // Check if a username is available (usernames/{name} registry)
      checkUsernameAvailable: async (username: string) => {
        const snap = await getDoc(doc(db, 'usernames', normalizeUsername(username)));
        if (!snap.exists()) return true;
        // Allow if it's the user's own current username
        return snap.data().uid === get().user?.uid;
      },

      // Update the user's username (claimed server-side, transactional)
      updateUsername: async (username: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        const trimmed = normalizeUsername(username);
        const validationError = usernameValidationError(trimmed);
        if (validationError) {
          throw new Error(validationError);
        }

        let claimed: string;
        try {
          const result = await claimUsernameCallable({ username: trimmed });
          claimed = result.data.username;
        } catch (error) {
          const code = errorCode(error);
          if (code === 'functions/already-exists') {
            throw new Error('Username is already taken');
          }
          if (code === 'functions/invalid-argument') {
            throw new Error(
              usernameValidationError(trimmed) ?? 'Username can only contain letters, numbers, and underscores',
            );
          }
          throw error;
        }

        set({ user: { ...user, username: claimed }, needsUsername: false });
      },

      // Upload and update profile picture with compression
      updateProfilePicture: async (file: File) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          const compressed = await compressProfileImage(file);
          const timestamp = Date.now();
          const fileName = `${timestamp}_${file.name}`;
          const imageRef = ref(storage, `profile-pictures/${user.uid}/${fileName}`);
          
          await uploadBytes(imageRef, compressed, { contentType: compressed.type });
          const downloadURL = await getDownloadURL(imageRef);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { 
            profilePictureURL: downloadURL,
            photoURL: downloadURL,
          });
          
          set({ 
            user: { 
              ...user, 
              profilePictureURL: downloadURL,
              photoURL: downloadURL,
            } 
          });
        } catch (error) {
          throw error;
        }
      },

      // Upload and update profile banner with compression
      updateProfileBanner: async (file: File) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          const compressed = await compressProfileImage(file);
          const timestamp = Date.now();
          const fileName = `${timestamp}_${file.name}`;
          const imageRef = ref(storage, `profile-banners/${user.uid}/${fileName}`);
          
          await uploadBytes(imageRef, compressed, { contentType: compressed.type });
          const downloadURL = await getDownloadURL(imageRef);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { profileBannerURL: downloadURL });
          
          set({ user: { ...user, profileBannerURL: downloadURL } });
        } catch (error) {
          throw error;
        }
      },
      
      // Highlight a spot (level 3+; allowance, expiry and writes are enforced by the callable)
      highlightSpot: async (spotId: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        await highlightSpotCallable({ spotId });

        const current = get().user ?? user;
        set({
          user: {
            ...current,
            highlightedSpots: [...new Set([...(current.highlightedSpots ?? []), spotId])],
          },
        });
      },

      // Unhighlight a spot (server-side)
      unhighlightSpot: async (spotId: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        await unhighlightSpotCallable({ spotId });

        const current = get().user ?? user;
        set({
          user: {
            ...current,
            highlightedSpots: (current.highlightedSpots ?? []).filter((id) => id !== spotId),
          },
        });
      },

      // Update custom name color (level 5 only; enforced by the callable)
      updateCustomNameColor: async (color: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        await updateNameStyleCallable({ color });
        set({ user: { ...user, customNameColor: color } });
      },
      
      // Update custom name font (level 5 only; enforced by the callable)
      updateCustomNameFont: async (font: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        await updateNameStyleCallable({ font });
        set({ user: { ...user, customNameFont: font } });
      },

      // Remember this device's FCM token so signOut can remove it
      rememberFcmToken: (token: string) => {
        rememberedFcmToken = token;
        try {
          globalThis.localStorage?.setItem(FCM_TOKEN_KEY, token);
        } catch {
          // storage unavailable: the in-memory copy still works this session
        }
      },
    }),
    {
      name: 'spoton-user',
      partialize: (state) => ({ user: state.user }),
      // When store rehydrates from localStorage, ensure loading stays true
      // so the app waits for initAuth/onAuthStateChanged to set the real state.
      // This prevents stale cached user data from causing issues on multi-device login.
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.loading = true;
          }
        };
      },
    }
  )
);
