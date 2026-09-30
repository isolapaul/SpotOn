import { create } from 'zustand';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { profileLevel } from '@/lib/levelUtils';

interface MyLevelStore {
  /** The uid the values below belong to; null while signed out. */
  uid: string | null;
  xp: number;
  level: number;
  /** A server answer has arrived (not only the local cache), so the level is current. */
  loaded: boolean;
  /** Listens to the signed-in user's publicProfiles/{uid} (null stops). */
  sync: (uid: string | null) => void;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

const EMPTY = { uid: null, xp: 0, level: 1, loaded: false } as const;

/**
 * The signed-in user's XP and level (item 5), live from the server-maintained public profile.
 * Before the server has computed them, the level is the old spot-count one (profileLevel).
 * `loaded` waits for a server snapshot: a cached one may be stale, and level-up detection must
 * not record or celebrate a stale level.
 */
export const useMyLevelStore = create<MyLevelStore>((set) => ({
  ...EMPTY,
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ ...EMPTY, uid });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      doc(db, 'publicProfiles', uid),
      { includeMetadataChanges: true },
      (snap) => {
        const data = snap.data();
        const xp = typeof data?.xp === 'number' && data.xp >= 0 ? data.xp : 0;
        set((state) => ({
          xp,
          level: profileLevel(data),
          loaded: state.loaded || !snap.metadata.fromCache,
        }));
      },
      (error) => console.error('Level listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
}));
