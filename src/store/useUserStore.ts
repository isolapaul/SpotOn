import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  savedSpots: string[];
}

interface UserStore {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => void;
  toggleFavorite: (spotId: string) => Promise<void>;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      
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
        });
        
        return unsubscribe;
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
    }),
    {
      name: 'spoton-user',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
