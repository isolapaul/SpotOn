import { create } from 'zustand';
import {
  collection, deleteDoc, deleteField, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import {
  isEmptyProposal, mergeProposal, parsePhotoSubmission, parseSpotEdit,
  type EditProposal, type PhotoSubmission, type SpotEdit,
} from '@/lib/moderation';
import { groupReports, parseReport, type ReportGroup, type ReportItem } from '@/lib/reports';
import { invalidatePublicProfile } from '@/store/publicProfiles';
import type { Spot } from '@/store/useSpotStore';

const rejectSpotCallable = httpsCallable<{ spotId: string; reason: string }, unknown>(functions, 'rejectSpot');
const removeSpotCallable = httpsCallable<{ spotId: string; reason: string }, unknown>(functions, 'removeSpot');
const reviewSpotEditCallable = httpsCallable<{ spotId: string; approve: boolean; seenAt: number; reason?: string }, unknown>(
  functions,
  'reviewSpotEdit',
);
const resolveReportCallable = httpsCallable<{ key: string; action: 'remove' | 'dismiss'; reason?: string }, unknown>(
  functions,
  'resolveReport',
);
const reviewPhotoCallable = httpsCallable<{ submissionId: string; approve: boolean; reason?: string }, unknown>(
  functions,
  'reviewPhotoSubmission',
);

/** Who is signed in, as far as the moderation listeners are concerned. */
export interface ModerationScope {
  uid: string | null;
  isAdmin: boolean;
}

interface ModerationStore {
  /** The signed-in user's own proposals by spot id (waiting or rejected). */
  ownEdits: Record<string, SpotEdit>;
  /** Admins: proposals waiting for review. */
  editQueue: SpotEdit[];
  /** Admins: photos waiting for review. */
  photoQueue: PhotoSubmission[];
  /** Admins: reported things, each with its reports. */
  reportQueue: ReportGroup[];
  sync: (scope: ModerationScope) => void;

  /** Owner, approved spot: adds `patch` to the waiting proposal (or starts one); false when nothing changes. */
  proposeEdit: (spot: Spot, patch: EditProposal) => Promise<boolean>;
  /** Owner: withdraws a waiting proposal or dismisses a rejected one. */
  dropEdit: (spotId: string) => Promise<void>;
  /** Owner: a rejected spot goes back to the review queue. */
  resubmitSpot: (spotId: string) => Promise<void>;

  rejectSpot: (spotId: string, reason: string) => Promise<void>;
  /** Deletes the spot (its photos and pending moderation go too); `ownerId` refreshes their profile. */
  removeSpot: (spotId: string, ownerId: string, reason: string) => Promise<void>;
  reviewEdit: (edit: Pick<SpotEdit, 'spotId' | 'createdAtMs'>, approve: boolean, reason?: string) => Promise<void>;
  reviewPhoto: (submissionId: string, approve: boolean, reason?: string) => Promise<void>;
  /** Dismisses the reports of a thing, or removes the thing with a reason. */
  resolveReport: (key: string, remove: boolean, reason?: string) => Promise<void>;
}

// Module-level listeners, like the spots scopes (store/spotListeners).
let listeners: { key: string; stop: Unsubscribe[] } | null = null;

/**
 * Moderation (item 4): the owner's edit proposals and, for admins, the edit and photo queues, plus
 * the actions on them. The callables enforce admin rights and reasons; the rules the owner's writes.
 */
export const useModerationStore = create<ModerationStore>((set, get) => ({
  ownEdits: {},
  editQueue: [],
  photoQueue: [],
  reportQueue: [],

  sync: ({ uid, isAdmin }) => {
    const key = uid ? `${uid}|${isAdmin}` : '';
    if (listeners?.key === key) return;
    listeners?.stop.forEach((stop) => stop());
    listeners = null;
    set({ ownEdits: {}, editQueue: [], photoQueue: [], reportQueue: [] });
    if (!uid) return;
    const fail = (what: string) => (error: unknown) => console.error(`Moderation listener (${what}) failed:`, error);
    const stop: Unsubscribe[] = [
      onSnapshot(query(collection(db, 'spotEdits'), where('ownerId', '==', uid)), (snap) => {
        const ownEdits: Record<string, SpotEdit> = {};
        for (const d of snap.docs) {
          const edit = parseSpotEdit(d.id, d.data());
          if (edit) ownEdits[edit.spotId] = edit;
        }
        set({ ownEdits });
      }, fail('own edits')),
    ];
    if (isAdmin) {
      stop.push(
        onSnapshot(query(collection(db, 'spotEdits'), where('status', '==', 'pending')), (snap) => {
          set({ editQueue: snap.docs.map((d) => parseSpotEdit(d.id, d.data())).filter((e): e is SpotEdit => e !== null) });
        }, fail('edit queue')),
        onSnapshot(collection(db, 'photoSubmissions'), (snap) => {
          set({
            photoQueue: snap.docs
              .map((d) => parsePhotoSubmission(d.id, d.data()))
              .filter((p): p is PhotoSubmission => p !== null),
          });
        }, fail('photo queue')),
        onSnapshot(collection(db, 'reports'), (snap) => {
          set({ reportQueue: groupReports(snap.docs.map((d) => parseReport(d.id, d.data())).filter((r): r is ReportItem => r !== null)) });
        }, fail('reports')),
      );
    }
    listeners = { key, stop };
  },

  proposeEdit: async (spot, patch) => {
    const existing = get().ownEdits[spot.id];
    const base = existing?.status === 'pending' ? existing.proposed : undefined;
    const proposed = mergeProposal(spot, base, patch);
    if (isEmptyProposal(proposed)) {
      if (base) await deleteDoc(doc(db, 'spotEdits', spot.id));
      return false;
    }
    // Written whole: a new proposal replaces a rejected one (the rules require every field).
    await setDoc(doc(db, 'spotEdits', spot.id), {
      spotId: spot.id,
      spotName: spot.name,
      ownerId: spot.createdBy,
      status: 'pending',
      proposed,
      createdAt: serverTimestamp(),
    });
    return true;
  },
  dropEdit: async (spotId) => {
    await deleteDoc(doc(db, 'spotEdits', spotId));
  },
  resubmitSpot: async (spotId) => {
    await updateDoc(doc(db, 'spots', spotId), { status: 'pending', rejection: deleteField() });
  },

  rejectSpot: async (spotId, reason) => {
    await rejectSpotCallable({ spotId, reason });
  },
  removeSpot: async (spotId, ownerId, reason) => {
    await removeSpotCallable({ spotId, reason });
    // The server recounts the owner's spots; the next profile read should see it (T26).
    invalidatePublicProfile(ownerId);
  },
  reviewEdit: async ({ spotId, createdAtMs }, approve, reason) => {
    await reviewSpotEditCallable({ spotId, approve, seenAt: createdAtMs, ...(reason ? { reason } : {}) });
  },
  resolveReport: async (key, remove, reason) => {
    await resolveReportCallable({ key, action: remove ? 'remove' : 'dismiss', ...(reason ? { reason } : {}) });
  },
  reviewPhoto: async (submissionId, approve, reason) => {
    await reviewPhotoCallable({ submissionId, approve, ...(reason ? { reason } : {}) });
  },
}));
