// T30 spots listeners, extracted from useSpotStore (behaviour unchanged). The store's startSpots,
// syncSpotScopes and stopSpots delegate to startApprovedScope, syncScopes and stopAllScopes.
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mergeSpotSources } from '@/lib/mergeSpots';
import type { Spot } from '@/store/useSpotStore';

/** Who is signed in, as far as the spots listeners are concerned (T30). */
export interface SpotScope {
  uid: string | null;
  isAdmin: boolean;
}

type ScopeName = 'approved' | 'own' | 'admin';
interface ScopeSlot {
  /** The uid the listener was started for ('' for approved). */
  uid: string;
  unsubscribe: () => void;
  /** null until the first snapshot. */
  spots: Spot[] | null;
}
/** The store fields the listeners write (the store's `set`). */
type SpotSet = (partial: Partial<{ spots: Spot[]; isLoading: boolean; error: string | null }>) => void;

// T30: up to three spots listeners, so pending spots only reach their owner and admins:
// `approved` (always), `own` (signed in, not admin), `admin` (all spots). `spots` is their merge.
// Module-level, like the admin listeners in useUserStore.
const slots: Partial<Record<ScopeName, ScopeSlot>> = {};

function recompute(set: SpotSet, extra: Parameters<SpotSet>[0] = {}) {
  set({
    spots: mergeSpotSources({
      admin: slots.admin?.spots ?? [],
      own: slots.own?.spots ?? [],
      approved: slots.approved?.spots ?? [],
    }),
    ...extra,
  });
}

/** Stops one listener and forgets its data (the caller recomputes). Returns whether it was running. */
function stopScope(name: ScopeName): boolean {
  const slot = slots[name];
  if (!slot) return false;
  delete slots[name];
  slot.unsubscribe();
  return true;
}

function scopeQuery(name: ScopeName, uid: string) {
  const spots = collection(db, 'spots');
  if (name === 'approved') return query(spots, where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
  if (name === 'own') return query(spots, where('createdBy', '==', uid), orderBy('createdAt', 'desc'));
  return query(spots, orderBy('createdAt', 'desc'));
}

function startScope(
  name: ScopeName,
  uid: string,
  set: SpotSet,
  hooks: { first?: () => void; failed?: (error: Error) => void } = {},
) {
  const slot: ScopeSlot = { uid, spots: null, unsubscribe: () => {} };
  slots[name] = slot;
  slot.unsubscribe = onSnapshot(
    scopeQuery(name, uid),
    (snapshot) => {
      if (slots[name] !== slot) return; // stopped meanwhile
      const first = slot.spots === null;
      slot.spots = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Spot);
      // `admin` supersedes `own` only once it has data, so the switch never empties anything.
      if (name === 'admin' && first) stopScope('own');
      recompute(set, name === 'approved' ? { isLoading: false, error: null } : {});
      if (first) hooks.first?.();
    },
    (error) => {
      if (slots[name] !== slot) return;
      console.error(`Error fetching spots (${name}):`, error);
      if (name === 'approved') {
        // Keep the last approved spots, as before T30.
        set({ error: error.message, isLoading: false });
      } else {
        // The listener is dead: drop only its data; the approved spots stay.
        delete slots[name];
        recompute(set, { error: error.message });
      }
      hooks.failed?.(error);
    },
  );
}

export function startApprovedScope(set: SpotSet): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      stopScope('approved');
      set({ isLoading: true });
      startScope('approved', '', set, { first: resolve, failed: reject });
    } catch (error) {
      console.error('Error setting up spots listener:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      reject(error);
    }
  });
}

export function syncScopes({ uid, isAdmin }: SpotScope, set: SpotSet) {
  let dropped = false;
  // Data of a previous user (or of a signed-in user after sign-out) is dropped at once.
  for (const name of ['own', 'admin'] as const) {
    if (slots[name] && slots[name].uid !== uid) dropped = stopScope(name) || dropped;
  }
  if (uid && isAdmin) {
    // `own` keeps its data until the new `admin` listener's first snapshot (see startScope).
    if (!slots.admin) startScope('admin', uid, set);
  } else {
    dropped = stopScope('admin') || dropped;
    if (uid && !slots.own) startScope('own', uid, set);
  }
  if (dropped) recompute(set);
}

export function stopAllScopes(set: SpotSet) {
  stopScope('admin');
  stopScope('own');
  stopScope('approved');
  set({ spots: [] });
}
