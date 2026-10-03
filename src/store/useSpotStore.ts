import { create } from 'zustand';
import {
  doc,
  updateDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { DateInput } from '@/lib/dates';
import { removeImage, type RemovableImageFields } from '@/lib/spotImages';
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
  /** Why an admin rejected it (item 4); only on rejected spots, removed on resubmit. */
  rejection?: { reason: string; at: Timestamp };
  /** A Timestamp; null while a local create waits for its serverTimestamp. */
  createdAt: DateInput;
  reviews?: Review[];
  averageRating?: number;
  highlighted?: {
    userId: string;
    highlightedAt: string;
    expiresAt: string;
  }[];
}

/** The fields an edit form changes directly (lib/moderation proposes them for approved spots instead). */
export type SpotFieldsPatch = Partial<Pick<Spot, 'name' | 'description' | 'category' | 'location'>>;

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  /** The uid whose own spots (all statuses) have fully loaded, else null (level counts wait for it). */
  ownLoadedFor: string | null;
  /** Starts the approved-spots listener (T30); resolves on its first snapshot (the loading gate). */
  startSpots: () => Promise<void>;
  /** Starts/stops the own-spots and all-spots listeners for the signed-in user (idempotent). */
  syncSpotScopes: (scope: SpotScope) => void;
  /** Stops every spots listener and clears the spots (unmount, T21). */
  stopSpots: () => void;
  toggleSpotImageLike: (spotId: string, imageId: string) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
  /** Direct field edits: admins on any spot, owners on a spot under review or rejected (the rules). */
  updateSpotFields: (spotId: string, fields: SpotFieldsPatch) => Promise<void>;
  deleteSpotImage: (spotId: string, imageUrl: string) => Promise<void>;
  setPrimaryImage: (spotId: string, imageIndex: number) => Promise<void>;
}

// Callables (T10, region europe-west3 via `functions`)
const toggleImageLikeCallable = httpsCallable<{ spotId: string; imageId: string }, unknown>(functions, 'toggleImageLike');
const approveSpotCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'approveSpot');

function updateSpotInState(
  set: (fn: (state: { spots: Spot[] }) => { spots: Spot[] }) => void,
  spotId: string,
  updater: (spot: Spot) => Spot
) {
  set((state) => ({
    spots: state.spots.map((spot) => (spot.id === spotId ? updater(spot) : spot)),
  }));
}

export const useSpotStore = create<SpotStore>((set) => ({
  spots: [],
  isLoading: false,
  ownLoadedFor: null,
  error: null,

  startSpots: () => startApprovedScope(set),

  syncSpotScopes: (scope) => syncScopes(scope, set),

  stopSpots: () => stopAllScopes(set),

  toggleSpotImageLike: async (spotId, imageId) => {
    await toggleImageLikeCallable({ spotId, imageId });
  },

  approveSpot: async (spotId) => {
    try {
      await approveSpotCallable({ spotId });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, status: 'approved' as const }));
    } catch (error) {
      console.error('Error approving spot:', error);
      throw error;
    }
  },

  updateSpotFields: async (spotId, fields) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { ...fields });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, ...fields }));
    } catch (error) {
      console.error('Error updating spot:', error);
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
    } catch (error) {
      console.error('Error deleting spot image:', error);
      throw error;
    }
  },

  setPrimaryImage: async (spotId, imageIndex) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), { primaryImageIndex: imageIndex });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, primaryImageIndex: imageIndex }));
    } catch (error) {
      console.error('Error setting primary image:', error);
      throw error;
    }
  },
}));
