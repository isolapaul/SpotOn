import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, limit, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/lib/firebase';
import type { TranslationKey } from '@/lib/translations';
import { useUserStore } from './useUserStore';
import { track } from './telemetry';
import { callableReason } from '@/lib/callableErrors';

export interface Invitee {
  uid: string;
  createdAt: number;
  spotApproved: boolean;
}

interface ReferralStore {
  /** The code of an invite link opened on this device, until it is claimed or dismissed (persisted). */
  pendingCode: string | null;
  setPendingCode: (code: string | null) => void;
  /** Accounts on this device that said "skip" to "Who invited you?" (persisted). */
  dismissed: string[];
  dismiss: (uid: string) => void;
  /** An account was created in this session: ask who invited them. */
  justSignedUp: boolean;
  markSignedUp: () => void;
  /** Names the inviter (claimReferral); throws with a translated message key. */
  claim: (code: string) => Promise<void>;
  /** The people who joined with the own invite, newest first (live). */
  invitees: Invitee[];
  listen: (uid: string | null) => void;
}

const claimCallable = httpsCallable<{ code: string }, { referrer: string }>(functions, 'claimReferral');

/** claimReferral's error messages → texts. */
const CLAIM_ERRORS: Record<string, TranslationKey> = {
  INVITE_CODE_INVALID: 'inviteCodeInvalid',
  INVITE_CODE_UNKNOWN: 'inviteCodeUnknown',
  INVITE_SELF: 'inviteSelf',
  INVITE_TOO_LATE: 'inviteTooLate',
  INVITE_ALREADY_CLAIMED: 'inviteAlreadyClaimed',
};

export function claimErrorKey(error: unknown): TranslationKey {
  const reason = callableReason(error);
  return (reason && CLAIM_ERRORS[reason]) || 'genericError';
}

/** When the signed-in account was created (Firebase Auth), ms. */
export function accountCreatedAt(): number | undefined {
  const created = auth.currentUser?.metadata.creationTime;
  const ms = created ? Date.parse(created) : Number.NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

/** The referral program on the device (growth plan §2). */
export const useReferralStore = create<ReferralStore>()(
  persist(
    (set) => ({
      pendingCode: null,
      setPendingCode: (pendingCode) => set({ pendingCode }),
      dismissed: [],
      dismiss: (uid) => set((s) => ({ dismissed: s.dismissed.includes(uid) ? s.dismissed : [...s.dismissed, uid].slice(-20), pendingCode: null })),
      justSignedUp: false,
      markSignedUp: () => set({ justSignedUp: true }),
      claim: async (code) => {
        const { data } = await claimCallable({ code });
        const { user, setUser } = useUserStore.getState();
        if (user) setUser({ ...user, referredBy: data.referrer });
        set({ pendingCode: null, justSignedUp: false });
        track('invite_claimed');
      },
      invitees: [],
      listen: (uid) => {
        if (listening?.uid === uid) return;
        listening?.unsubscribe();
        listening = null;
        set({ invitees: [] });
        if (!uid) return;
        const q = query(collection(db, 'referrals'), where('referrer', '==', uid), orderBy('createdAt', 'desc'), limit(100));
        const unsubscribe = onSnapshot(
          q,
          (snap) => set({
            invitees: snap.docs.map((d) => {
              const at = d.get('createdAt') as { toMillis?: () => number } | null;
              return { uid: d.id, createdAt: typeof at?.toMillis === 'function' ? at.toMillis() : Date.now(), spotApproved: d.get('spotApproved') === true };
            }),
          }),
          (error) => console.error('Invitees listener failed:', error),
        );
        listening = { uid, unsubscribe };
      },
    }),
    {
      name: 'spoton-invite',
      partialize: (s) => ({ pendingCode: s.pendingCode, dismissed: s.dismissed }),
    },
  ),
);
