import { create } from 'zustand';
import {
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { toMillis } from '@/lib/newSpots';
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
/** A built-in SpotCategory or the id of a categories/{id} doc the super admin created (item 7). */
export type CategoryId = string;

export interface Spot {
  id: string;
  name: string;
  category: CategoryId;
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
  /** Set by the approveSpot callable (spots approved before v2.2 have none). */
  approvedAt?: DateInput;
  /** The last owner edit or photo addition (approveSpot's version check); absent until then. */
  updatedAt?: DateInput;
  reviews?: Review[];
  averageRating?: number;
  /** Who liked the spot (the feed's thumb), oldest first, and how many; server-written (toggleSpotLike). */
  likedBy?: string[];
  likeCount?: number;
  /** The owner's special pin icon (item 6), server-written; normalise before use. */
  ownerPin?: string;
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
  /** Starts the approved-spots listener (T30); resolves on its first snapshot (the loading gate). */
  startSpots: () => Promise<void>;
  /** Starts/stops the own-spots and all-spots listeners for the signed-in user (idempotent). */
  syncSpotScopes: (scope: SpotScope) => void;
  /** Stops every spots listener and clears the spots (unmount, T21). */
  stopSpots: () => void;
  toggleSpotImageLike: (spotId: string, imageId: string) => Promise<void>;
  /** Likes or unlikes an approved spot (the toggleSpotLike callable). */
  toggleSpotLike: (spotId: string) => Promise<void>;
  approveSpot: (spotId: string) => Promise<void>;
  /** Direct field edits: admins on any spot, owners on a spot under review or rejected (the rules). */
  updateSpotFields: (spotId: string, fields: SpotFieldsPatch) => Promise<void>;
  deleteSpotImage: (spotId: string, imageUrl: string) => Promise<void>;
  setPrimaryImage: (spotId: string, imageIndex: number) => Promise<void>;
}

// Callables (T10, region europe-west3 via `functions`)
const toggleImageLikeCallable = httpsCallable<{ spotId: string; imageId: string }, unknown>(functions, 'toggleImageLike');
const toggleSpotLikeCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'toggleSpotLike');
/** approveSpot refused: the owner changed the spot after the admin saw it (shown as its own message). */
export const SPOT_CHANGED_ERROR = 'SPOT_CHANGED';

const approveSpotCallable = httpsCallable<{ spotId: string; seenAt: number | null }, unknown>(functions, 'approveSpot');

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

  toggleSpotLike: async (spotId) => {
    await toggleSpotLikeCallable({ spotId });
  },

  approveSpot: async (spotId) => {
    try {
      // The version the admin saw: the server refuses if the owner changed the spot since.
      const spot = get().spots.find((s) => s.id === spotId);
      const seenAt = spot ? toMillis(spot.updatedAt) ?? toMillis(spot.createdAt) : null;
      try {
        await approveSpotCallable({ spotId, seenAt });
      } catch (error) {
        if (error instanceof Error && error.message === SPOT_CHANGED_ERROR) throw new Error(SPOT_CHANGED_ERROR);
        throw error;
      }
      updateSpotInState(set, spotId, (spot) => ({ ...spot, status: 'approved' as const }));
    } catch (error) {
      console.error('Error approving spot:', error);
      throw error;
    }
  },

  updateSpotFields: async (spotId, fields) => {
    try {
      // updatedAt: the version approveSpot checks (rules require it on owner edits under review).
      await updateDoc(doc(db, 'spots', spotId), { ...fields, updatedAt: serverTimestamp() });
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
          updatedAt: serverTimestamp(),
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
      await updateDoc(doc(db, 'spots', spotId), { primaryImageIndex: imageIndex, updatedAt: serverTimestamp() });
      updateSpotInState(set, spotId, (spot) => ({ ...spot, primaryImageIndex: imageIndex }));
    } catch (error) {
      console.error('Error setting primary image:', error);
      throw error;
    }
  },
}));
