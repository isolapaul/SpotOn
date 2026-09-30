import { create } from 'zustand';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { parseCustomCategory, type CustomCategory } from '@/lib/categories';
import type { CategoryIconId } from '@/lib/categoryIcons';

interface CategoryStore {
  /** The categories the super admin created (item 7); public, the same for everyone. */
  categories: CustomCategory[];
  /** Listens to categories/{id} (idempotent). */
  start: () => void;
  stop: () => void;
  /** Super admin only (the rules). */
  createCategory: (name: string, icon: CategoryIconId) => Promise<void>;
  updateCategory: (id: string, fields: { name: string; icon: CategoryIconId }) => Promise<void>;
  /** Super admin only; refused while a spot or a waiting change uses it (the callable). */
  deleteCategory: (id: string) => Promise<void>;
}

const deleteCategoryCallable = httpsCallable<{ id: string }, unknown>(functions, 'deleteCategory');

let unsubscribe: Unsubscribe | null = null;

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  start: () => {
    if (unsubscribe) return;
    unsubscribe = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const categories = snap.docs
          .map((d) => parseCustomCategory(d.id, d.data()))
          .filter((c): c is CustomCategory => c !== null);
        set({ categories });
      },
      (error) => console.error('Categories listener failed:', error),
    );
  },
  stop: () => {
    unsubscribe?.();
    unsubscribe = null;
  },
  createCategory: async (name, icon) => {
    await addDoc(collection(db, 'categories'), { name: name.trim(), icon, createdAt: serverTimestamp() });
  },
  updateCategory: async (id, { name, icon }) => {
    await updateDoc(doc(db, 'categories', id), { name: name.trim(), icon, updatedAt: serverTimestamp() });
  },
  deleteCategory: async (id) => {
    await deleteCategoryCallable({ id });
  },
}));
