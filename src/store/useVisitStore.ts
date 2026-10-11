import { create } from 'zustand';
import { collection, limit, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { TranslationKey } from '@/lib/translations';
import { useLocationStore } from './useLocationStore';
import { track } from './telemetry';

export interface Visit {
  spotId: string;
  spotName: string;
  visitedAt: number;
}

interface VisitStore {
  /** The own visits, newest first (live while signed in). */
  visits: Visit[];
  listen: (uid: string | null) => void;
  /**
   * "I was here": takes a fresh device position and asks the server (markVisited). Resolves true
   * when recorded; throws with a message key otherwise.
   */
  markVisited: (spotId: string) => Promise<boolean>;
}

const markVisitedCallable = httpsCallable<{ spotId: string; position: { lat: number; lng: number } }, { visited: boolean; already: boolean }>(
  functions, 'markVisited',
);

export class VisitError extends Error {
  constructor(readonly key: TranslationKey) {
    super(key);
  }
}

/** markVisited's failures → texts. */
export function visitErrorKey(error: unknown): TranslationKey {
  if (error instanceof VisitError) return error.key;
  const message = (error as { message?: unknown } | null)?.message;
  if (message === 'VISIT_TOO_FAR') return 'visitTooFar';
  if (typeof message === 'string' && /RATE_LIMIT/.test(message)) return 'rateLimited';
  return 'genericError';
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

/** "I was here" (growth plan §4): the own visits and the check-in. */
export const useVisitStore = create<VisitStore>((set) => ({
  visits: [],
  listen: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ visits: [] });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'users', uid, 'visits'), orderBy('visitedAt', 'desc'), limit(500)),
      (snap) => set({
        visits: snap.docs.map((d) => {
          const at = d.get('visitedAt') as { toMillis?: () => number } | null;
          return { spotId: d.id, spotName: String(d.get('spotName') ?? ''), visitedAt: typeof at?.toMillis === 'function' ? at.toMillis() : Date.now() };
        }),
      }),
      (error) => console.error('Visits listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  markVisited: async (spotId) => {
    const result = await useLocationStore.getState().request();
    const position = useLocationStore.getState().location;
    if (result !== 'granted' || !position) throw new VisitError('visitNeedsLocation');
    const { data } = await markVisitedCallable({ spotId, position: { lat: position.lat, lng: position.lng } });
    if (!data.already) track('visit');
    return data.visited;
  },
}));
