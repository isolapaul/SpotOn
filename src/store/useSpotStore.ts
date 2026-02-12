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
  deleteDoc,
  arrayUnion,
  Timestamp,
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

export interface SpotImage {
  id: string;
  url: string;
  addedBy?: string;
  addedAt: Timestamp;
  likes: number;
  likedBy: string[];
}

export type SpotCategory = 'scenic' | 'smoke-spot' | 'viewpoint' | 'other' | 'hiking' | 'random' | 'date-spot' | 'park' | 'part';

export interface Spot {
  id: string;
  name: string;
  category: SpotCategory;
  description: string;
  imageUrls: string[]; // Changed to array
  spotImages?: SpotImage[];
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
  highlighted?: {
    userId: string;
    highlightedAt: string;
    expiresAt: string; // 7 days from highlight date
  }[]; // Array of active highlights from quest bonus
}

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  unsubscribeSpots: (() => void) | null;
  fetchSpots: () => Promise<void>;
  addSpot: (spotData: Omit<Spot, 'id' | 'imageUrls' | 'createdAt' | 'status' | 'primaryImageIndex'>, imageFiles: File[], primaryIndex: number, userId: string, userEmail?: string) => Promise<void>;
  addReview: (spotId: string, review: Omit<Review, 'id' | 'createdAt'>) => Promise<void>;
  addSpotImages: (spotId: string, imageFiles: File[], userId: string) => Promise<void>;
  migrateSpotImages: (spotId: string) => Promise<void>;
  toggleSpotImageLike: (spotId: string, imageId: string, userId: string) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  updateSpotDescription: (spotId: string, description: string) => Promise<void>;
  updateSpotName: (spotId: string, name: string) => Promise<void>;
  deleteSpotImage: (spotId: string, imageUrl: string) => Promise<void>;
  setPrimaryImage: (spotId: string, imageIndex: number) => Promise<void>;
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
      const spotImages: SpotImage[] = [];

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
          spotImages.push({
            id: `${timestamp}_${random}`,
            url: imageUrl,
            addedBy: userId,
            addedAt: Timestamp.now(),
            likes: 0,
            likedBy: [],
          });
        }
      } else {
        // No images provided - use placeholder
        imageUrls.push('/placeholder-spot.jpg');
        spotImages.push({
          id: `${Date.now()}_placeholder`,
          url: '/placeholder-spot.jpg',
          addedBy: userId,
          addedAt: Timestamp.now(),
          likes: 0,
          likedBy: [],
        });
      }
      
      // Check if user is admin - admins get instant approval
      const userIsAdmin = isAdmin(userEmail);
      const spotStatus = userIsAdmin ? 'approved' : 'pending';
      
      const spotDoc = {
        ...spotData,
        imageUrls,
        spotImages,
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

      // Remove undefined values that Firestore doesn't accept
      const cleanReview = Object.fromEntries(
        Object.entries(reviewWithTimestamp).filter(([, v]) => v !== undefined)
      );

      // Send to Firebase
      await updateDoc(spotRef, {
        reviews: arrayUnion(cleanReview),
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

  addSpotImages: async (spotId, imageFiles, userId) => {
    if (!imageFiles || imageFiles.length === 0) return;

    try {
      const maxImages = 20;
      const spot = get().spots.find((item) => item.id === spotId);
      const existingUrls = spot?.imageUrls || [];
      const baseUrls =
        existingUrls.length === 1 && existingUrls[0] === '/placeholder-spot.jpg'
          ? []
          : existingUrls;
      const baseSpotImages = (spot?.spotImages || []).filter(
        (image) => image.url !== '/placeholder-spot.jpg'
      );

      if (baseUrls.length + imageFiles.length > maxImages) {
        throw new Error('MAX_SPOT_IMAGES');
      }

      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1280,
        useWebWorker: false,
      };

      const newUrls: string[] = [];
      const newSpotImages: SpotImage[] = [];
      for (const imageFile of imageFiles) {
        const compressedFile = await imageCompression(imageFile, options);
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const fileName = `${timestamp}_${random}_${imageFile.name}`;
        const imageRef = ref(storage, `spot-images/${fileName}`);
        await uploadBytes(imageRef, compressedFile);
        const imageUrl = await getDownloadURL(imageRef);
        newUrls.push(imageUrl);
        newSpotImages.push({
          id: `${timestamp}_${random}`,
          url: imageUrl,
          addedBy: userId,
          addedAt: Timestamp.now(),
          likes: 0,
          likedBy: [],
        });
      }

      const updatedImageUrls = [...baseUrls, ...newUrls];
      const updatedSpotImages = [...baseSpotImages, ...newSpotImages];
      const updatePayload: { imageUrls: string[]; primaryImageIndex?: number } = {
        imageUrls: updatedImageUrls,
      };

      if (updatedSpotImages.length > 0) {
        (updatePayload as { spotImages?: SpotImage[] }).spotImages = updatedSpotImages;
      }

      if (!baseUrls.length) {
        updatePayload.primaryImageIndex = 0;
      }

      const spotRef = doc(db, 'spots', spotId);
      await updateDoc(spotRef, updatePayload);

      set((state) => ({
        spots: state.spots.map((item) =>
          item.id === spotId
            ? {
                ...item,
                imageUrls: updatedImageUrls,
                spotImages: updatedSpotImages,
                primaryImageIndex: updatePayload.primaryImageIndex ?? item.primaryImageIndex,
              }
            : item
        ),
      }));
    } catch (error: any) {
      console.error('Error adding spot images:', error);
      throw error;
    }
  },

  migrateSpotImages: async (spotId) => {
    const spot = get().spots.find((item) => item.id === spotId);
    if (!spot || spot.spotImages?.length) return;

    const urls = spot.imageUrls || [];
    if (urls.length === 0) return;

    const spotImages: SpotImage[] = urls.map((url, index) => ({
      id: `${spotId}_${index}`,
      url,
      addedAt: Timestamp.now(),
      likes: 0,
      likedBy: [],
    }));

    const spotRef = doc(db, 'spots', spotId);
    await updateDoc(spotRef, { spotImages });

    set((state) => ({
      spots: state.spots.map((item) =>
        item.id === spotId ? { ...item, spotImages } : item
      ),
    }));
  },

  toggleSpotImageLike: async (spotId, imageId, userId) => {
    const spot = get().spots.find((item) => item.id === spotId);
    if (!spot || !spot.spotImages || spot.spotImages.length === 0) return;

    const updatedImages = spot.spotImages.map((image) => {
      if (image.id !== imageId) return image;
      const alreadyLiked = image.likedBy.includes(userId);
      return {
        ...image,
        likes: Math.max(0, image.likes + (alreadyLiked ? -1 : 1)),
        likedBy: alreadyLiked
          ? image.likedBy.filter((id) => id !== userId)
          : [...image.likedBy, userId],
      };
    });

    const spotRef = doc(db, 'spots', spotId);
    await updateDoc(spotRef, { spotImages: updatedImages });

    set((state) => ({
      spots: state.spots.map((item) =>
        item.id === spotId ? { ...item, spotImages: updatedImages } : item
      ),
    }));
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

  deleteSpot: async (spotId) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      await deleteDoc(spotRef);
      set((state) => ({
        spots: state.spots.filter((spot) => spot.id !== spotId),
      }));
    } catch (error: any) {
      console.error('Error deleting spot:', error);
      throw error;
    }
  },

  updateSpotDescription: async (spotId, description) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      await updateDoc(spotRef, { description });
      set((state) => ({
        spots: state.spots.map((spot) =>
          spot.id === spotId ? { ...spot, description } : spot
        ),
      }));
    } catch (error: any) {
      console.error('Error updating spot description:', error);
      throw error;
    }
  },

  updateSpotName: async (spotId, name) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      await updateDoc(spotRef, { name });
      set((state) => ({
        spots: state.spots.map((spot) =>
          spot.id === spotId ? { ...spot, name } : spot
        ),
      }));
    } catch (error: any) {
      console.error('Error updating spot name:', error);
      throw error;
    }
  },

  deleteSpotImage: async (spotId, imageUrl) => {
    try {
      const spot = get().spots.find((item) => item.id === spotId);
      if (!spot) throw new Error('Spot not found');

      const updatedImageUrls = (spot.imageUrls || []).filter((url) => url !== imageUrl);
      const updatedSpotImages = (spot.spotImages || []).filter((img) => img.url !== imageUrl);

      // If we deleted the primary image, reset to 0
      let newPrimaryIndex = spot.primaryImageIndex || 0;
      if (newPrimaryIndex >= updatedImageUrls.length) {
        newPrimaryIndex = 0;
      }

      // If no images left, add placeholder
      if (updatedImageUrls.length === 0) {
        updatedImageUrls.push('/placeholder-spot.jpg');
        newPrimaryIndex = 0;
      }

      const spotRef = doc(db, 'spots', spotId);
      await updateDoc(spotRef, {
        imageUrls: updatedImageUrls,
        spotImages: updatedSpotImages,
        primaryImageIndex: newPrimaryIndex,
      });

      set((state) => ({
        spots: state.spots.map((item) =>
          item.id === spotId
            ? { ...item, imageUrls: updatedImageUrls, spotImages: updatedSpotImages, primaryImageIndex: newPrimaryIndex }
            : item
        ),
      }));
    } catch (error: any) {
      console.error('Error deleting spot image:', error);
      throw error;
    }
  },

  setPrimaryImage: async (spotId, imageIndex) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      await updateDoc(spotRef, { primaryImageIndex: imageIndex });
      set((state) => ({
        spots: state.spots.map((spot) =>
          spot.id === spotId ? { ...spot, primaryImageIndex: imageIndex } : spot
        ),
      }));
    } catch (error: any) {
      console.error('Error setting primary image:', error);
      throw error;
    }
  },
}));
