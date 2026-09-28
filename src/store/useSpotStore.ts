import { create } from 'zustand';
import {
  doc,
  updateDoc,
  deleteDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { removeImage, type RemovableImageFields } from '@/lib/spotImages';
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

/** The review fields the client sends; spotUploads.buildReview adds `id` and `createdAt`. */
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
  toggleSpotImageLike: (spotId: string, imageId: string) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  updateSpotDescription: (spotId: string, description: string) => Promise<void>;
  updateSpotName: (spotId: string, name: string) => Promise<void>;
  deleteSpotImage: (spotId: string, imageUrl: string) => Promise<void>;
  setPrimaryImage: (spotId: string, imageIndex: number) => Promise<void>;
}

// Callables (T10, region europe-west3 via `functions`)
const toggleImageLikeCallable = httpsCallable<{ spotId: string; imageId: string }, unknown>(functions, 'toggleImageLike');

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
