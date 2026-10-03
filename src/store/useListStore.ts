import { create } from 'zustand';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseList, sortLists, type SpotList } from '@/lib/lists';

interface ListStore {
  lists: SpotList[];
  sync: (uid: string | null) => void;
  create: (name: string, firstSpotId?: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  setShared: (id: string, shared: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleSpot: (id: string, spotId: string, add: boolean) => Promise<void>;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;
const ref = (id: string) => doc(db, 'users', listening!.uid, 'lists', id);

/** The signed-in user's spot lists (users/{uid}/lists), live; written directly (the rules check). */
export const useListStore = create<ListStore>((set) => ({
  lists: [],
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ lists: [] });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'lists'),
      (snap) => set({ lists: sortLists(snap.docs.map((d) => parseList(d.id, d.data())).filter((l): l is SpotList => l !== null)) }),
      (error) => console.error('Lists listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  create: async (name, firstSpotId) => {
    if (!listening) throw new Error('NOT_AUTHENTICATED');
    await addDoc(collection(db, 'users', listening.uid, 'lists'), {
      name: name.trim(), spotIds: firstSpotId ? [firstSpotId] : [], shared: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  },
  rename: async (id, name) => {
    await updateDoc(ref(id), { name: name.trim(), updatedAt: serverTimestamp() });
  },
  setShared: async (id, shared) => {
    await updateDoc(ref(id), { shared, updatedAt: serverTimestamp() });
  },
  remove: async (id) => {
    await deleteDoc(ref(id));
  },
  toggleSpot: async (id, spotId, add) => {
    await updateDoc(ref(id), { spotIds: add ? arrayUnion(spotId) : arrayRemove(spotId), updatedAt: serverTimestamp() });
  },
}));
