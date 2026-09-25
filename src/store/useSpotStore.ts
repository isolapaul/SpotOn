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
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase';
import { MAX_SPOT_IMAGES, PLACEHOLDER_URL, extForMime, realImageCount } from '@/lib/spotImages';
import imageCompression from 'browser-image-compression';

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
  userEmail?: string; // legacy, read-only; never written
  userSpotsCount?: number; // legacy, read-only; never written
  customNameColor?: string; // legacy, read-only; never written
  customNameFont?: string; // legacy, read-only; never written
}

/** The review fields the client sends; addReview adds `id` and `createdAt`. */
export type NewReview = {
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
};

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
  imageUrls: string[];
  spotImages?: SpotImage[];
  primaryImageIndex?: number;
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
    expiresAt: string;
  }[];
}

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  unsubscribeSpots: (() => void) | null;
  fetchSpots: () => Promise<void>;
  addSpot: (spotData: Omit<Spot, 'id' | 'imageUrls' | 'createdAt' | 'status' | 'primaryImageIndex'>, imageFiles: File[], primaryIndex: number, userId: string, isAdmin: boolean) => Promise<void>;
  addReview: (spotId: string, review: NewReview) => Promise<void>;
  addSpotImages: (spotId: string, imageFiles: File[], userId: string) => Promise<void>;
  toggleSpotImageLike: (spotId: string, imageId: string) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  updateSpotDescription: (spotId: string, description: string) => Promise<void>;
  updateSpotName: (spotId: string, name: string) => Promise<void>;
  deleteSpotImage: (spotId: string, imageUrl: string) => Promise<void>;
  setPrimaryImage: (spotId: string, imageIndex: number) => Promise<void>;
}

const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1280,
  useWebWorker: false,
};

// Callables (T10, region europe-west3 via `functions`)
const addSpotImagesCallable = httpsCallable<{ spotId: string; urls: string[] }, unknown>(functions, 'addSpotImages');
const toggleImageLikeCallable = httpsCallable<{ spotId: string; imageId: string }, unknown>(functions, 'toggleImageLike');

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

/**
 * Compresses and uploads one spot image to `spot-images/{uid}/{uuid}.{ext}` with an explicit
 * contentType. Output types the Storage rules do not accept (e.g. GIF) are re-encoded as JPEG.
 */
async function compressAndUpload(imageFile: File, userId: string): Promise<{ url: string; spotImage: SpotImage }> {
  let blob = await imageCompression(imageFile, IMAGE_COMPRESSION_OPTIONS);
  if (!extForMime(blob.type)) {
    blob = await imageCompression(imageFile, { ...IMAGE_COMPRESSION_OPTIONS, fileType: 'image/jpeg' });
  }
  const ext = extForMime(blob.type) ?? 'jpg';
  const imageRef = ref(storage, `spot-images/${userId}/${crypto.randomUUID()}.${ext}`);
  await uploadBytes(imageRef, blob, { contentType: blob.type });
  const url = await getDownloadURL(imageRef);
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    url,
    spotImage: {
      id: `${timestamp}_${random}`,
      url,
      addedBy: userId,
      addedAt: Timestamp.now(),
      likes: 0,
      likedBy: [],
    },
  };
}

function updateSpotInState(
  set: (fn: (state: { spots: Spot[] }) => { spots: Spot[] }) => void,
  spotId: string,
  updater: (spot: Spot) => Spot
) {
  set((state) => ({
    spots: state.spots.map((spot) => (spot.id === spotId ? updater(spot) : spot)),
  }));
}

export const useSpotStore = create<SpotStore>((set, get) => ({
  spots: [],
  isLoading: false,
  error: null,
  unsubscribeSpots: null,

  fetchSpots: () => {
    return new Promise<void>((resolve, reject) => {
      try {
        const existingUnsubscribe = get().unsubscribeSpots;
        if (existingUnsubscribe) {
          existingUnsubscribe();
          set({ unsubscribeSpots: null });
        }

        set({ isLoading: true });
        const q = query(collection(db, 'spots'), orderBy('createdAt', 'desc'));
        let isFirstSnapshot = true;

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const spotsList: Spot[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Spot));
          set({ spots: spotsList, isLoading: false, error: null });
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            resolve();
          }
        }, (error) => {
          console.error('Error fetching spots:', error);
          set({ error: error.message, isLoading: false });
          reject(error);
        });

        set({ unsubscribeSpots: unsubscribe });
      } catch (error: any) {
        console.error('Error setting up spots listener:', error);
        set({ error: error.message, isLoading: false });
        reject(error);
      }
    });
  },

  addSpot: async (spotData, imageFiles, primaryIndex, userId, isAdmin) => {
    try {
      set({ isLoading: true, error: null });

      let imageUrls: string[];
      let spotImages: SpotImage[];

      if (imageFiles && imageFiles.length > 0) {
        const uploaded = await Promise.all(imageFiles.map((f) => compressAndUpload(f, userId)));
        imageUrls = uploaded.map((u) => u.url);
        spotImages = uploaded.map((u) => u.spotImage);
      } else {
        imageUrls = [PLACEHOLDER_URL];
        spotImages = [{
          id: `${Date.now()}_placeholder`,
          url: PLACEHOLDER_URL,
          addedBy: userId,
          addedAt: Timestamp.now(),
          likes: 0,
          likedBy: [],
        }];
      }

      // Exactly the keys the T12 create rule allows.
      await addDoc(collection(db, 'spots'), {
        name: spotData.name,
        category: spotData.category,
        description: spotData.description,
        location: { lat: spotData.location.lat, lng: spotData.location.lng },
        createdBy: userId,
        createdByName: spotData.createdByName,
        createdByPhoto: spotData.createdByPhoto,
        imageUrls,
        spotImages,
        primaryImageIndex: imageUrls.length > 0 ? primaryIndex : 0,
        status: isAdmin ? 'approved' : 'pending',
        createdAt: serverTimestamp(),
      });

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  addReview: async (spotId, review) => {
    try {
      const reviewWithTimestamp: Review = {
        ...review,
        id: `${review.userId}_${Date.now()}`,
        createdAt: Timestamp.now(),
      };

      const cleanReview = Object.fromEntries(
        Object.entries(reviewWithTimestamp).filter(([, v]) => v !== undefined)
      );

      await updateDoc(doc(db, 'spots', spotId), { reviews: arrayUnion(cleanReview) });

      updateSpotInState(set, spotId, (spot) => {
        const updatedReviews = [...(spot.reviews || []), reviewWithTimestamp];
        return {
          ...spot,
          reviews: updatedReviews,
          averageRating: updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length,
        };
      });
    } catch (error: any) {
      console.error('Error adding review:', error);
      throw error;
    }
  },

  addSpotImages: async (spotId, imageFiles, userId) => {
    if (!imageFiles || imageFiles.length === 0) return;

    try {
      const spot = get().spots.find((item) => item.id === spotId);
      if ((spot ? realImageCount(spot) : 0) + imageFiles.length > MAX_SPOT_IMAGES) throw new Error('MAX_SPOT_IMAGES');

      const uploaded = await Promise.all(imageFiles.map((f) => compressAndUpload(f, userId)));
      const urls = uploaded.map((u) => u.url);

      // The server appends transactionally; the spots listener delivers the change.
      try {
        await addSpotImagesCallable({ spotId, urls });
      } catch (error) {
        if (errorCode(error) === 'functions/resource-exhausted') throw new Error('MAX_SPOT_IMAGES');
        throw error;
      }
    } catch (error: any) {
      console.error('Error adding spot images:', error);
      throw error;
    }
  },

  toggleSpotImageLike: async (spotId, imageId) => {
    await toggleImageLikeCallable({ spotId, imageId });
  },

  approveSpot: async (spotId) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { status: 'approved' });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, status: 'approved' as const }));
    } catch (error: any) {
      console.error('Error approving spot:', error);
      throw error;
    }
  },

  deleteSpot: async (spotId) => {
    try {
      await deleteDoc(doc(db, 'spots', spotId));
      set((state) => ({ spots: state.spots.filter((spot) => spot.id !== spotId) }));
    } catch (error: any) {
      console.error('Error deleting spot:', error);
      throw error;
    }
  },

  updateSpotDescription: async (spotId, description) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { description });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, description }));
    } catch (error: any) {
      console.error('Error updating spot description:', error);
      throw error;
    }
  },

  updateSpotName: async (spotId, name) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { name });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, name }));
    } catch (error: any) {
      console.error('Error updating spot name:', error);
      throw error;
    }
  },

  deleteSpotImage: async (spotId, imageUrl) => {
    try {
      const spot = get().spots.find((item) => item.id === spotId);
      if (!spot) throw new Error('Spot not found');

      let updatedImageUrls = (spot.imageUrls || []).filter((url) => url !== imageUrl);
      const updatedSpotImages = (spot.spotImages || []).filter((img) => img.url !== imageUrl);

      let newPrimaryIndex = Math.min(spot.primaryImageIndex || 0, Math.max(0, updatedImageUrls.length - 1));
      if (updatedImageUrls.length === 0) {
        updatedImageUrls = [PLACEHOLDER_URL];
        newPrimaryIndex = 0;
      }

      await updateDoc(doc(db, 'spots', spotId), {
        imageUrls: updatedImageUrls,
        spotImages: updatedSpotImages,
        primaryImageIndex: newPrimaryIndex,
      });

      updateSpotInState(set, spotId, (spot) => ({
        ...spot,
        imageUrls: updatedImageUrls,
        spotImages: updatedSpotImages,
        primaryImageIndex: newPrimaryIndex,
      }));
    } catch (error: any) {
      console.error('Error deleting spot image:', error);
      throw error;
    }
  },

  setPrimaryImage: async (spotId, imageIndex) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { primaryImageIndex: imageIndex });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, primaryImageIndex: imageIndex }));
    } catch (error: any) {
      console.error('Error setting primary image:', error);
      throw error;
    }
  },
}));
