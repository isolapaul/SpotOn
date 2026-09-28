import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Category {
  id: string;
  name: string;
  icon: string;
}

/**
 * The admin-managed `categories` collection (T27, moved from ProfilePanel unchanged): live while
 * `enabled` (ProfilePanel passes `isOpen && isSuperAdmin`); the last list is kept while disabled.
 * `addCategory` trims and writes one doc and rethrows on failure; the caller shows the toasts.
 */
export function useCategories(enabled: boolean) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const categoriesRef = collection(db, 'categories');
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        cats.push({ id: doc.id, name: data.name, icon: data.icon });
      });
      setCategories(cats);
    });

    return () => unsubscribe();
  }, [enabled]);

  const addCategory = useCallback(async (name: string, icon: string) => {
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'categories'), {
        name: name.trim(),
        icon: icon.trim(),
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsAdding(false);
    }
  }, []);

  return { categories, addCategory, isAdding };
}
