import { create } from 'zustand';
import { addDoc, collection, deleteField, doc, onSnapshot, serverTimestamp, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { parseCustomCategory, type CustomCategory } from '@/lib/categories';
import type { CategoryIconId } from '@/lib/categoryIcons';

/** The names (Hungarian required; empty English/German fall back to it) and the icon. */
export interface CategoryFields {
  name: string;
  nameEn: string;
  nameDe: string;
  icon: CategoryIconId;
}

/** The document fields: trimmed names, empty optional names left out (create) or deleted (update). */
function docFields(f: CategoryFields, emptyAs: 'omit' | 'delete'): Record<string, unknown> {
  const out: Record<string, unknown> = { name: f.name.trim(), icon: f.icon };
  for (const key of ['nameEn', 'nameDe'] as const) {
    const value = f[key].trim();
    if (value) out[key] = value;
    else if (emptyAs === 'delete') out[key] = deleteField();
  }
  return out;
}

interface CategoryStore {
  /** The categories the super admin created (item 7); public, the same for everyone. */
  categories: CustomCategory[];
  /** Listens to categories/{id} (idempotent). */
  start: () => void;
  stop: () => void;
  /** Super admin only (the rules). */
  createCategory: (fields: CategoryFields) => Promise<void>;
  updateCategory: (id: string, fields: CategoryFields) => Promise<void>;
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
  createCategory: async (fields) => {
    await addDoc(collection(db, 'categories'), { ...docFields(fields, 'omit'), createdAt: serverTimestamp() });
  },
  updateCategory: async (id, fields) => {
    await updateDoc(doc(db, 'categories', id), { ...docFields(fields, 'delete'), updatedAt: serverTimestamp() });
  },
  deleteCategory: async (id) => {
    await deleteCategoryCallable({ id });
  },
}));
