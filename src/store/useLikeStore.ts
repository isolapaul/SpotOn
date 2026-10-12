import { create } from 'zustand';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { PersonResult } from './useFollowStore';

const setSpotLikeCallable = httpsCallable<{ spotId: string; liked: boolean }, { liked: boolean }>(functions, 'setSpotLike');
const getSpotLikersCallable = httpsCallable<{ spotId: string }, { people: PersonResult[] }>(functions, 'getSpotLikers');

interface LikeStore {
  /** The spots the signed-in user likes (their own spotLikes docs, live). */
  liked: ReadonlySet<string>;
  sync: (uid: string | null) => void;
  /** Sets the like to `liked` (idempotent on the server: a repeat or a retry changes nothing). */
  setLike: (spotId: string, liked: boolean) => Promise<void>;
  /** Who liked a spot, newest first, without blocked people (the getSpotLikers callable). */
  getLikers: (spotId: string) => Promise<PersonResult[]>;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

/** Spot likes: the own liked set is listened to; every change and the likers go through callables. */
export const useLikeStore = create<LikeStore>((set) => ({
  liked: new Set(),
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ liked: new Set() });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'spotLikes'), where('uid', '==', uid)),
      (snap) => set({ liked: new Set(snap.docs.map((d) => String(d.get('spotId') ?? '')).filter(Boolean)) }),
      (error) => console.error('Likes listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  setLike: async (spotId, liked) => {
    await setSpotLikeCallable({ spotId, liked });
  },
  getLikers: async (spotId) => (await getSpotLikersCallable({ spotId })).data.people,
}));
