import { create } from 'zustand';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { invalidatePublicProfile } from './publicProfiles';

export type ReportKind = 'spot' | 'photo' | 'review' | 'reply' | 'profile';
export type ReportReason = 'spam' | 'offensive' | 'wrong_place' | 'dangerous' | 'privacy' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['spam', 'offensive', 'wrong_place', 'dangerous', 'privacy', 'other'];

/** What is reported: a spot (targetId = spotId), a photo (its URL), a review or reply (its id), a profile (uid). */
export interface ReportTarget {
  kind: ReportKind;
  spotId?: string;
  targetId: string;
}

const reportCallable = httpsCallable<ReportTarget & { reason: ReportReason; text: string }, unknown>(functions, 'reportContent');
const blockCallable = httpsCallable<{ uid: string }, unknown>(functions, 'blockUser');
const unblockCallable = httpsCallable<{ uid: string }, unknown>(functions, 'unblockUser');

interface SafetyStore {
  /** The users the signed-in user blocked: their reviews and replies are hidden from them. */
  blocked: Set<string>;
  sync: (uid: string | null) => void;
  report: (target: ReportTarget, reason: ReportReason, text: string) => Promise<void>;
  block: (me: string, uid: string) => Promise<void>;
  unblock: (uid: string) => Promise<void>;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

/** Reports and blocks (Play UGC requirement); every change goes through the callables. */
export const useSafetyStore = create<SafetyStore>((set) => ({
  blocked: new Set(),
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ blocked: new Set() });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'blocks'), where('blocker', '==', uid)),
      (snap) => set({ blocked: new Set(snap.docs.map((d) => String(d.get('blocked') ?? '')).filter(Boolean)) }),
      (error) => console.error('Blocks listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  report: async (target, reason, text) => {
    await reportCallable({ ...target, reason, text: text.trim() });
  },
  block: async (me, uid) => {
    await blockCallable({ uid });
    invalidatePublicProfile(me);
    invalidatePublicProfile(uid);
  },
  unblock: async (uid) => {
    await unblockCallable({ uid });
  },
}));

/** Whether content by `uid` is hidden for the signed-in user. */
export const useIsBlocked = () => {
  const blocked = useSafetyStore((s) => s.blocked);
  return (uid: string | undefined) => !!uid && blocked.has(uid);
};
