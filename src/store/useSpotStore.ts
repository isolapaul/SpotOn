import { create } from 'zustand';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase';
import { MAX_SPOT_IMAGES, PLACEHOLDER_URL, extForMime, realImageCount, removeImage, type RemovableImageFields } from '@/lib/spotImages';
import { compressImage } from '@/lib/imageCompression';
import { invalidatePublicProfile } from '@/store/publicProfiles';
import { startApprovedScope, stopAllScopes, syncScopes, type SpotScope } from '@/store/spotListeners';

export type { SpotScope } from '@/store/spotListeners';

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
  /** Starts the approved-spots listener (T30); resolves on its first snapshot (the loading gate). */
  startSpots: () => Promise<void>;
  /** Starts/stops the own-spots and all-spots listeners for the signed-in user (idempotent). */
  syncSpotScopes: (scope: SpotScope) => void;
  /** Stops every spots listener and clears the spots (unmount, T21). */
  stopSpots: () => void;
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
  let blob = await compressImage(imageFile, 'spot');
  if (!extForMime(blob.type)) {
    blob = await compressImage(imageFile, 'spot', 'image/jpeg');
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

  startSpots: () => startApprovedScope(set),

  syncSpotScopes: (scope) => syncScopes(scope, set),

  stopSpots: () => stopAllScopes(set),

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
      // The server bumps spotsCount; drop the cached profile so the next read sees it (T26).
      invalidatePublicProfile(userId);

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

      // No local append: the spots listener already delivers the new review (BUG-25).
      await updateDoc(doc(db, 'spots', spotId), { reviews: arrayUnion(cleanReview) });
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
      const createdBy = get().spots.find((spot) => spot.id === spotId)?.createdBy;
      await deleteDoc(doc(db, 'spots', spotId));
      if (createdBy) invalidatePublicProfile(createdBy);
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
      // Computed from the fresh doc inside a transaction, so an image or like another user added
      // meanwhile is kept (the listener copy may be stale); writes only the three image fields.
      const updated = await runTransaction(db, async (tx) => {
        const spotRef = doc(db, 'spots', spotId);
        const snap = await tx.get(spotRef);
        if (!snap.exists()) throw new Error('Spot not found');
        const next = removeImage(snap.data() as RemovableImageFields, imageUrl);
        tx.update(spotRef, {
          imageUrls: next.imageUrls,
          spotImages: next.spotImages,
          primaryImageIndex: next.primaryImageIndex,
        });
        return next;
      });

      updateSpotInState(set, spotId, (spot) => ({ ...spot, ...updated }));
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
