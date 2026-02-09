import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import imageCompression from 'browser-image-compression';

// Store for admin emails (will be populated by Firestore listener)
let cachedAdminEmails: string[] = [];

export const setCachedAdminEmails = (emails: string[]) => {
  cachedAdminEmails = emails;
};

// Check if the user is Super Admin (from environment variable)
export const isSuperAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  const superAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!superAdminEmail) return false;
  return email.toLowerCase() === superAdminEmail.toLowerCase();
};

// Check if the user is any admin (Super Admin OR in Firestore admins collection)
export const isAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  
  // Check if super admin
  if (isSuperAdmin(email)) return true;
  
  // Check if in cached admin list
  return cachedAdminEmails.some(adminEmail => adminEmail.toLowerCase() === email.toLowerCase());
};

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
  userSpotsCount?: number; // Number of spots user had when creating review (for level color)
  customNameColor?: string; // Custom name color if user is level 5
  customNameFont?: string; // Custom name font if user is level 5
}

export type SpotCategory = 'scenic' | 'smoke-spot' | 'viewpoint' | 'other' | 'hiking' | 'random' | 'date-spot' | 'park' | 'part';

export interface Spot {
  id: string;
  name: string;
  category: SpotCategory;
  description: string;
  imageUrls: string[]; // Changed to array
  primaryImageIndex?: number; // Index of primary image
  location: {
    lat: number;
    lng: number;
  };
  createdBy: string;
  createdByName?: string;
  createdByPhoto?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  reviews?: Review[];
  averageRating?: number;
}

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  unsubscribeSpots: (() => void) | null;
  fetchSpots: () => Promise<void>;
  addSpot: (spotData: Omit<Spot, 'id' | 'imageUrls' | 'createdAt' | 'status' | 'primaryImageIndex'>, imageFiles: File[], primaryIndex: number, userId: string, userEmail?: string) => Promise<void>;
  addReview: (spotId: string, review: Omit<Review, 'id' | 'createdAt'>) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
}

export const useSpotStore = create<SpotStore>((set, get) => ({
  spots: [],
  isLoading: false,
  error: null,
  unsubscribeSpots: null,

  fetchSpots: () => {
    return new Promise<void>((resolve, reject) => {
      try {
        // Clean up existing listener if any
        const existingUnsubscribe = get().unsubscribeSpots;
        if (existingUnsubscribe) {
          existingUnsubscribe();
          set({ unsubscribeSpots: null });
        }

        set({ isLoading: true });
        const spotsRef = collection(db, 'spots');
        // Fetch ALL spots (both pending and approved) for admin filtering
        const q = query(
          spotsRef, 
          orderBy('createdAt', 'desc')
        );

        let isFirstSnapshot = true;

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const spotsList: Spot[] = [];
          snapshot.forEach((doc) => {
            spotsList.push({ id: doc.id, ...doc.data() } as Spot);
          });
          set({ spots: spotsList, isLoading: false, error: null });
          
          // Resolve promise on first snapshot
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            resolve();
          }
        }, (error) => {
          console.error('Error fetching spots:', error);
          set({ error: error.message, isLoading: false });
          reject(error);
        });

        // Store unsubscribe function for cleanup
        set({ unsubscribeSpots: unsubscribe });
      } catch (error: any) {
        console.error('Error setting up spots listener:', error);
        set({ error: error.message, isLoading: false });
        reject(error);
      }
    });
  },

  addSpot: async (spotData, imageFiles, primaryIndex, userId, userEmail) => {
    try {
      set({ isLoading: true, error: null });

      const imageUrls: string[] = [];

      // Compress and upload all images
      if (imageFiles && imageFiles.length > 0) {
        const options = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1280,
          useWebWorker: false,
        };

        // Upload each image
        for (const imageFile of imageFiles) {
          const compressedFile = await imageCompression(imageFile, options);

          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 10000);
          const fileName = `${timestamp}_${random}_${imageFile.name}`;
          const imageRef = ref(storage, `spot-images/${fileName}`);
          
          await uploadBytes(imageRef, compressedFile);
          const imageUrl = await getDownloadURL(imageRef);
          imageUrls.push(imageUrl);
        }
      } else {
        // No images provided - use placeholder
        imageUrls.push('/placeholder-spot.jpg');
      }
      
      // Check if user is admin - admins get instant approval
      const userIsAdmin = isAdmin(userEmail);
      const spotStatus = userIsAdmin ? 'approved' : 'pending';
      
      const spotDoc = {
        ...spotData,
        imageUrls,
        primaryImageIndex: imageUrls.length > 0 ? primaryIndex : 0,
        createdBy: userId,
        status: spotStatus,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'spots'), spotDoc);
      
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },

  addReview: async (spotId, review) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      const reviewWithTimestamp = {
        ...review,
        id: `${review.userId}_${Date.now()}`,
        createdAt: Timestamp.now(),
      };

      // Send to Firebase
      await updateDoc(spotRef, {
        reviews: arrayUnion(reviewWithTimestamp),
      });

      // Update local state immediately for better UX
      set((state) => ({
        spots: state.spots.map((spot) => {
          if (spot.id === spotId) {
            const updatedReviews = [...(spot.reviews || []), reviewWithTimestamp];
            const avgRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;
            return { 
              ...spot, 
              reviews: updatedReviews,
              averageRating: avgRating
            };
          }
          return spot;
        }),
      }));
    } catch (error: any) {
      console.error('Error adding review:', error);
      throw error;
    }
  },

  approveSpot: async (spotId) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      
      // Send to Firebase
      await updateDoc(spotRef, {
        status: 'approved',
      });

      // Update local state immediately for better UX
      set((state) => ({
        spots: state.spots.map((spot) =>
          spot.id === spotId ? { ...spot, status: 'approved' as const } : spot
        ),
      }));
    } catch (error: any) {
      console.error('Error approving spot:', error);
      throw error;
    }
  },
}));
