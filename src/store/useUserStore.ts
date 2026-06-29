import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, collection, query, onSnapshot, deleteDoc, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, googleProvider, storage } from '@/lib/firebase';
import { setCachedAdminEmails, isSuperAdmin } from '@/store/useSpotStore';
import imageCompression from 'browser-image-compression';

interface User {
  uid: string;
  username: string; // Only username, no separate display name
  email: string;
  photoURL?: string;
  profilePictureURL?: string;
  profileBannerURL?: string;
  savedSpots: string[];
  highlightedSpots?: string[]; // Array of spot IDs user highlighted (max based on level)
  customNameColor?: string; // Custom name color for level 5
  customNameFont?: string; // Custom font for level 5
  // Notification Settings
  notificationSettings?: {
    spotApproved: boolean; // Get notified when spot is approved
    spotReviewed: boolean; // Get notified when spot receives reviews or likes
    newPendingSpot: boolean; // Get notified for new pending spots (admins only)
  };
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  addedAt: any;
  addedBy: string;
}

interface UserStore {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
  adminEmails: string[];
  adminUsers: AdminUser[];
  setUser: (user: User | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
  toggleFavorite: (spotId: string) => Promise<void>;
  initAdminListener: () => () => void;
  addAdmin: (email: string) => Promise<void>;
  removeAdmin: (adminId: string) => Promise<void>;
  searchUserByEmail: (email: string) => Promise<User | null>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<void>;
  updateProfilePicture: (file: File) => Promise<void>;
  updateProfileBanner: (file: File) => Promise<void>;
  setNeedsUsername: (needs: boolean) => void;
  highlightSpot: (spotId: string, maxHighlights: number) => Promise<void>;
  unhighlightSpot: (spotId: string) => Promise<void>;
  updateCustomNameColor: (color: string) => Promise<void>;
  updateCustomNameFont: (font: string) => Promise<void>;
}

// Compress profile images before upload (max 1920px, ~1MB)
async function compressProfileImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: false,
  };
  return imageCompression(file, options);
}

// Generate a username from display name
function generateUsername(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
    .slice(0, 12);
  const suffix = Math.floor(Math.random() * 1000000);
  return `${base || 'user'}${suffix}`;
}

// Module-level variable to track the onAuthStateChanged unsubscribe function
// This prevents duplicate listeners when initAuth is called multiple times
let authListenerUnsub: (() => void) | null = null;

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      needsUsername: false,
      adminEmails: [],
      adminUsers: [],
      
      setUser: (user) => set({ user, loading: false }),
      setNeedsUsername: (needs) => set({ needsUsername: needs }),
      
      signInWithGoogle: async () => {
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
          
          let username: string | undefined;
          let profilePictureURL: string | undefined;
          let profileBannerURL: string | undefined;
          let needsUsernameSetup = false;
          
          if (userSnap.exists()) {
            // EXISTING USER: Only update lastLoginAt, preserve all other data
            const data = userSnap.data();
            username = data.username;
            profilePictureURL = data.profilePictureURL || data.photoURL || firebaseUser.photoURL || '';
            profileBannerURL = data.profileBannerURL || '';
            
            // If no custom username, set one and prompt to change it
            if (!username) {
              username = generateUsername(firebaseUser.displayName || 'user');
              await updateDoc(userRef, { 
                username,
                lastLoginAt: serverTimestamp() 
              });
              needsUsernameSetup = true;
            } else {
              // Just update the login timestamp for existing user
              await updateDoc(userRef, {
                lastLoginAt: serverTimestamp()
              });
            }
          } else {
            // NEW USER: Create the document with initial data
            username = generateUsername(firebaseUser.displayName || 'user');
            profilePictureURL = firebaseUser.photoURL || '';
            profileBannerURL = '';
            needsUsernameSetup = true;
            
            // Create new user document with merge option for safety
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              username,
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              profilePictureURL: profilePictureURL,
              profileBannerURL: '',
              savedSpots: [],
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            }, { merge: true });
          }
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            username,
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            profilePictureURL,
            profileBannerURL,
            savedSpots: userSnap.exists() ? userSnap.data().savedSpots : [],
            highlightedSpots: userSnap.exists() ? userSnap.data().highlightedSpots : [],
          };
          
          set({ user: userData, loading: false, needsUsername: needsUsernameSetup });
        } catch (error) {
          console.error('Google Sign-In error:', error);
          set({ loading: false });
          throw error;
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
            
            const userData: User = {
              uid: firebaseUser.uid,
              username: data.username || 'user',
              email: firebaseUser.email || '',
              photoURL: data.photoURL || '',
              profilePictureURL: data.profilePictureURL || data.photoURL || '',
              profileBannerURL: data.profileBannerURL || '',
              savedSpots: data.savedSpots || [],
              highlightedSpots: data.highlightedSpots || [],
            };
            
            // Check if username needs to be set
            if (!data.username) {
              set({ needsUsername: true });
            }
            
            set({ user: userData, loading: false });
          }
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      signUpWithEmail: async (email: string, password: string, username: string) => {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = result.user;
          
          // Create user document in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            username: username.trim().toLowerCase(),
            email: firebaseUser.email || '',
            photoURL: '',
            profilePictureURL: '',
            profileBannerURL: '',
            savedSpots: [],
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          }, { merge: true });
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            username: username.trim().toLowerCase(),
            email: firebaseUser.email || '',
            photoURL: '',
            profilePictureURL: '',
            profileBannerURL: '',
            savedSpots: [],
            highlightedSpots: [],
          };
          
          set({ user: userData, loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },
      
      signOut: async () => {
        try {
          await firebaseSignOut(auth);
          set({ user: null, loading: false });
        } catch (error) {
          throw error;
        }
      },
      
      initAuth: async () => {
        // Clean up existing listener to prevent duplicates
        if (authListenerUnsub) {
          authListenerUnsub();
          authListenerUnsub = null;
        }

        // Check for redirect result first (handles signInWithRedirect flow)
        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult) {
            // User signed in via redirect, handle the same way as popup
            const firebaseUser = redirectResult.user;
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              // Existing user - just update lastLoginAt
              await updateDoc(userRef, {
                lastLoginAt: serverTimestamp()
              });
            } else {
              // New user from redirect - create document
              const username = generateUsername(firebaseUser.displayName || 'user');
              await setDoc(userRef, {
                uid: firebaseUser.uid,
                username,
                email: firebaseUser.email || '',
                photoURL: firebaseUser.photoURL || '',
                profilePictureURL: firebaseUser.photoURL || '',
                profileBannerURL: '',
                savedSpots: [],
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
              }, { merge: true });
            }
          }
        } catch (error) {
          console.error('Error handling redirect result:', error);
        }
        
        return new Promise<void>((resolve) => {
          let isFirstCall = true;
          
          authListenerUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              // User is signed in
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const data = userSnap.data();
                const userData: User = {
                  uid: firebaseUser.uid,
                  username: data.username || 'user',
                  email: firebaseUser.email || '',
                  photoURL: firebaseUser.photoURL || '',
                  profilePictureURL: data.profilePictureURL || data.photoURL || firebaseUser.photoURL || '',
                  profileBannerURL: data.profileBannerURL || '',
                  savedSpots: data.savedSpots || [],
                  highlightedSpots: data.highlightedSpots || [],
                };
                
                // Check if username needs to be set
                if (!data.username) {
                  set({ needsUsername: true });
                }
                
                set({ user: userData, loading: false });
              } else {
                // User document doesn't exist yet (shouldn't happen normally)
                // Create it now to prevent issues
                const username = generateUsername(firebaseUser.displayName || 'user');
                await setDoc(userRef, {
                  uid: firebaseUser.uid,
                  username,
                  email: firebaseUser.email || '',
                  photoURL: firebaseUser.photoURL || '',
                  profilePictureURL: firebaseUser.photoURL || '',
                  profileBannerURL: '',
                  savedSpots: [],
                  createdAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp(),
                }, { merge: true });
                
                const userData: User = {
                  uid: firebaseUser.uid,
                  username,
                  email: firebaseUser.email || '',
                  photoURL: firebaseUser.photoURL || '',
                  profilePictureURL: firebaseUser.photoURL || '',
                  profileBannerURL: '',
                  savedSpots: [],
                  highlightedSpots: [],
                };
                
                set({ user: userData, loading: false, needsUsername: true });
              }
            } else {
              // User is signed out
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

      // Initialize listener for admin emails
      initAdminListener: () => {
        const adminsRef = collection(db, 'admins');
        const q = query(adminsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const adminsList: AdminUser[] = [];
          const emailsList: string[] = [];
          
          snapshot.forEach((doc) => {
            const adminData = { id: doc.id, ...doc.data() } as AdminUser;
            adminsList.push(adminData);
            emailsList.push(adminData.email);
          });
          
          set({ adminEmails: emailsList, adminUsers: adminsList });
          
          // Update cached admin emails in useSpotStore
          setCachedAdminEmails(emailsList);
        });

        return unsubscribe;
      },

      // Search for a user by email
      // Search for a user by email (only Super Admin can do this)
      searchUserByEmail: async (email: string) => {
        const { user } = get();
        if (!user || !isSuperAdmin(user.email)) {
          throw new Error('Only Super Admin can search users');
        }

        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef);
          const snapshot = await getDocs(q);
          
          let foundUser: User | null = null;
          snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.email?.toLowerCase() === email.toLowerCase()) {
              foundUser = {
                uid: doc.id,
                username: userData.username || 'user',
                email: userData.email,
                photoURL: userData.photoURL || '',
                profilePictureURL: userData.profilePictureURL || userData.photoURL || '',
                profileBannerURL: userData.profileBannerURL || '',
                savedSpots: userData.savedSpots || [],
              };
            }
          });
          
          return foundUser;
        } catch (error) {
          throw error;
        }
      },

      // Add a new admin (only Super Admin can do this)
      addAdmin: async (email: string) => {
        const { user } = get();
        if (!user || !isSuperAdmin(user.email)) {
          throw new Error('Only Super Admin can add admins');
        }

        try {
          // Check if user exists
          const targetUser = await get().searchUserByEmail(email);
          if (!targetUser) {
            throw new Error('User not found');
          }

          // Check if already admin
          const { adminEmails } = get();
          if (adminEmails.includes(email.toLowerCase()) || isSuperAdmin(email)) {
            throw new Error('User is already an admin');
          }

          // Add to Firestore admins collection using user's UID as document ID
          // This makes it easy to check in security rules: exists(/databases/.../admins/$(request.auth.uid))
          await setDoc(doc(db, 'admins', targetUser.uid), {
            email: targetUser.email,
            username: targetUser.username,
            photoURL: targetUser.photoURL || '',
            addedAt: serverTimestamp(),
            addedBy: user.uid,
          });
        } catch (error) {
          throw error;
        }
      },

      // Remove an admin (only Super Admin can do this)
      removeAdmin: async (adminId: string) => {
        const { user } = get();
        if (!user || !isSuperAdmin(user.email)) {
          throw new Error('Only Super Admin can remove admins');
        }

        try {
          await deleteDoc(doc(db, 'admins', adminId));
        } catch (error) {
          throw error;
        }
      },

      // Check if a username is available
      checkUsernameAvailable: async (username: string) => {
        try {
          const normalized = username.trim().toLowerCase();
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('username', '==', normalized));
          const snapshot = await getDocs(q);
          
          // If found docs, check if it's the current user's own username
          const { user } = get();
          if (snapshot.empty) return true;
          
          // Allow if it's the user's own current username
          let isOwnUsername = false;
          snapshot.forEach((docSnap) => {
            if (docSnap.id === user?.uid) {
              isOwnUsername = true;
            }
          });
          return isOwnUsername;
        } catch (error) {
          throw error;
        }
      },

      // Update the user's username
      updateUsername: async (username: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        const trimmed = username.trim().toLowerCase();
        if (trimmed.length < 3 || trimmed.length > 20) {
          throw new Error('Username must be 3-20 characters');
        }
        if (!/^[a-z0-9_]+$/.test(trimmed)) {
          throw new Error('Username can only contain letters, numbers, and underscores');
        }

        // Check uniqueness
        const available = await get().checkUsernameAvailable(trimmed);
        if (!available) {
          throw new Error('Username is already taken');
        }

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { username: trimmed });
          set({ user: { ...user, username: trimmed }, needsUsername: false });
        } catch (error) {
          throw error;
        }
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
          
          await uploadBytes(imageRef, compressed);
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
          
          await uploadBytes(imageRef, compressed);
          const downloadURL = await getDownloadURL(imageRef);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { profileBannerURL: downloadURL });
          
          set({ user: { ...user, profileBannerURL: downloadURL } });
        } catch (error) {
          throw error;
        }
      },
      
      // Highlight a spot (level 3+)
      highlightSpot: async (spotId: string, maxHighlights: number) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        const currentHighlights = user.highlightedSpots || [];
        
        // Check if already highlighted
        if (currentHighlights.includes(spotId)) {
          throw new Error('Spot is already highlighted');
        }
        
        // Check max highlights limit
        if (currentHighlights.length >= maxHighlights) {
          throw new Error(`Maximum ${maxHighlights} spots can be highlighted`);
        }

        try {
          // Create highlight entry (expires in 7 days for level-based highlights)
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const highlightEntry = {
            userId: user.uid,
            highlightedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          };

          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { 
            highlightedSpots: arrayUnion(spotId) 
          });
          
          // Update the spot document with highlight entry in the highlighted array
          const spotRef = doc(db, 'spots', spotId);
          await updateDoc(spotRef, { 
            isHighlighted: true,
            highlighted: arrayUnion(highlightEntry)
          });
          
          set({ 
            user: { 
              ...user, 
              highlightedSpots: [...currentHighlights, spotId] 
            } 
          });
        } catch (error) {
          console.error('Error highlighting spot:', error);
          throw error;
        }
      },
      
      // Unhighlight a spot
      unhighlightSpot: async (spotId: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { 
            highlightedSpots: arrayRemove(spotId) 
          });
          
          // Get the current spot data to find and remove the highlight entry
          const spotRef = doc(db, 'spots', spotId);
          const spotSnap = await getDoc(spotRef);
          
          if (spotSnap.exists()) {
            const spotData = spotSnap.data();
            const highlighted = spotData.highlighted || [];
            
            // Find the user's highlight entry
            const userHighlight = highlighted.find((h: any) => h.userId === user.uid);
            
            if (userHighlight) {
              await updateDoc(spotRef, { 
                highlighted: arrayRemove(userHighlight)
              });
            }
            
            // Check if there are any remaining highlights
            const remainingHighlights = highlighted.filter((h: any) => h.userId !== user.uid);
            if (remainingHighlights.length === 0) {
              await updateDoc(spotRef, { isHighlighted: false });
            }
          }
          
          const currentHighlights = user.highlightedSpots || [];
          set({ 
            user: { 
              ...user, 
              highlightedSpots: currentHighlights.filter(id => id !== spotId) 
            } 
          });
        } catch (error) {
          console.error('Error unhighlighting spot:', error);
          throw error;
        }
      },
      
      // Update custom name color (level 5 only)
      updateCustomNameColor: async (color: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { customNameColor: color });
          
          set({ user: { ...user, customNameColor: color } });
        } catch (error) {
          throw error;
        }
      },
      
      // Update custom name font (level 5 only)
      updateCustomNameFont: async (font: string) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { customNameFont: font });
          
          set({ user: { ...user, customNameFont: font } });
        } catch (error) {
          throw error;
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
