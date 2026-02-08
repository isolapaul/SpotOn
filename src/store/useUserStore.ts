import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithPopup,
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
  name: string;
  username?: string;
  email: string;
  photoURL?: string;
  profilePictureURL?: string;
  profileBannerURL?: string;
  savedSpots: string[];
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
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
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
}

// Compress profile images before upload (max 1920px, ~1MB)
async function compressProfileImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  return imageCompression(file, options);
}

// Generate a username from display name
function generateUsername(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  const suffix = Math.floor(Math.random() * 1000000);
  return `${base || 'user'}${suffix}`;
}

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
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;
          
          // Create or update user document in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          let username: string | undefined;
          let profilePictureURL: string | undefined;
          let profileBannerURL: string | undefined;
          
          if (!userSnap.exists()) {
            // Generate a unique username for new users
            username = generateUsername(firebaseUser.displayName || 'user');
            profilePictureURL = firebaseUser.photoURL || '';
            
            // Create new user document
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              username,
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              profilePictureURL: profilePictureURL,
              profileBannerURL: '',
              savedSpots: [],
              createdAt: serverTimestamp(),
            });
            
            // New user needs to set username
            set({ needsUsername: true });
          } else {
            const data = userSnap.data();
            username = data.username;
            profilePictureURL = data.profilePictureURL || data.photoURL || firebaseUser.photoURL || '';
            profileBannerURL = data.profileBannerURL || '';
            
            // If no custom username, prompt to set one
            if (!username) {
              username = generateUsername(firebaseUser.displayName || 'user');
              await updateDoc(userRef, { username });
              set({ needsUsername: true });
            }
          }
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous',
            username,
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            profilePictureURL,
            profileBannerURL,
            savedSpots: userSnap.exists() ? userSnap.data().savedSpots : [],
          };
          
          set({ user: userData, loading: false });
        } catch (error) {
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
            const userData: User = {
              uid: firebaseUser.uid,
              name: data.name || 'User',
              username: data.username,
              email: firebaseUser.email || '',
              photoURL: data.photoURL || '',
              profilePictureURL: data.profilePictureURL || data.photoURL || '',
              profileBannerURL: data.profileBannerURL || '',
              savedSpots: data.savedSpots || [],
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

      signUpWithEmail: async (email: string, password: string, name: string) => {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = result.user;
          
          // Generate username from name
          const username = generateUsername(name || 'user');
          
          // Create user document in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            name: name || 'User',
            username,
            email: firebaseUser.email || '',
            photoURL: '',
            profilePictureURL: '',
            profileBannerURL: '',
            savedSpots: [],
            createdAt: serverTimestamp(),
          });
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            name: name || 'User',
            username,
            email: firebaseUser.email || '',
            photoURL: '',
            profilePictureURL: '',
            profileBannerURL: '',
            savedSpots: [],
          };
          
          // Prompt to customize username
          set({ user: userData, loading: false, needsUsername: true });
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
      
      initAuth: () => {
        return new Promise<void>((resolve) => {
          let isFirstCall = true;
          
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              // User is signed in
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const data = userSnap.data();
                const userData: User = {
                  uid: firebaseUser.uid,
                  name: data.name || firebaseUser.displayName || 'Anonymous',
                  username: data.username,
                  email: firebaseUser.email || '',
                  photoURL: firebaseUser.photoURL || '',
                  profilePictureURL: data.profilePictureURL || data.photoURL || firebaseUser.photoURL || '',
                  profileBannerURL: data.profileBannerURL || '',
                  savedSpots: data.savedSpots || [],
                };
                
                // Check if username needs to be set
                if (!data.username) {
                  set({ needsUsername: true });
                }
                
                set({ user: userData, loading: false });
              } else {
                set({ user: null, loading: false });
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
          
          return unsubscribe;
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
                name: userData.name || 'Unknown',
                username: userData.username,
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
            name: targetUser.name,
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
    }),
    {
      name: 'spoton-user',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
