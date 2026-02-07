import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, collection, query, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { setCachedAdminEmails, isSuperAdmin } from '@/store/useSpotStore';

interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
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
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      adminEmails: [],
      adminUsers: [],
      
      setUser: (user) => set({ user, loading: false }),
      
      signInWithGoogle: async () => {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;
          
          // Create or update user document in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // Create new user document
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              savedSpots: [],
              createdAt: serverTimestamp(),
            });
          }
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            savedSpots: userSnap.exists() ? userSnap.data().savedSpots : [],
          };
          
          set({ user: userData, loading: false });
        } catch (error) {
          console.error('Error signing in with Google:', error);
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
            const userData: User = {
              uid: firebaseUser.uid,
              name: userSnap.data().name || 'User',
              email: firebaseUser.email || '',
              photoURL: userSnap.data().photoURL || '',
              savedSpots: userSnap.data().savedSpots || [],
            };
            set({ user: userData, loading: false });
          }
        } catch (error) {
          console.error('Error signing in with email:', error);
          set({ loading: false });
          throw error;
        }
      },

      signUpWithEmail: async (email: string, password: string, name: string) => {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = result.user;
          
          // Create user document in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            name: name || 'User',
            email: firebaseUser.email || '',
            photoURL: '',
            savedSpots: [],
            createdAt: serverTimestamp(),
          });
          
          // Set user in store
          const userData: User = {
            uid: firebaseUser.uid,
            name: name || 'User',
            email: firebaseUser.email || '',
            photoURL: '',
            savedSpots: [],
          };
          
          set({ user: userData, loading: false });
        } catch (error) {
          console.error('Error signing up with email:', error);
          set({ loading: false });
          throw error;
        }
      },
      
      signOut: async () => {
        try {
          await firebaseSignOut(auth);
          set({ user: null, loading: false });
        } catch (error) {
          console.error('Error signing out:', error);
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
                const userData: User = {
                  uid: firebaseUser.uid,
                  name: userSnap.data().name || firebaseUser.displayName || 'Anonymous',
                  email: firebaseUser.email || '',
                  photoURL: firebaseUser.photoURL || '',
                  savedSpots: userSnap.data().savedSpots || [],
                };
                set({ user: userData, loading: false });
              } else {
                set({ user: null, loading: false });
              }
            } else {
              // User is signed out
              set({ user: null, loading: false });
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
          console.error('Error toggling favorite:', error);
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
          
          console.log('Admin emails updated:', emailsList);
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
                email: userData.email,
                photoURL: userData.photoURL || '',
                savedSpots: userData.savedSpots || [],
              };
            }
          });
          
          return foundUser;
        } catch (error) {
          console.error('Error searching user:', error);
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

          console.log(`Admin added: ${email}`);
        } catch (error) {
          console.error('Error adding admin:', error);
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
          console.log(`Admin removed: ${adminId}`);
        } catch (error) {
          console.error('Error removing admin:', error);
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
