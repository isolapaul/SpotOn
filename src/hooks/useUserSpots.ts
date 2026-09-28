import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Spot } from '@/store/useSpotStore';

const NO_SPOTS: Spot[] = [];

/**
 * All spots created by `uid` (approved and pending), live while `enabled` (T26, moved from
 * ProfilePanel). Same query as before: no orderBy. Unsubscribes when uid/enabled change or on
 * unmount; the last list is kept while disabled, but never shown for a different uid.
 */
export function useUserSpots(uid?: string, enabled = true): Spot[] {
  const [loaded, setLoaded] = useState<{ uid?: string; spots: Spot[] }>({ spots: NO_SPOTS });

  useEffect(() => {
    if (!uid || !enabled) return;

    const q = query(collection(db, 'spots'), where('createdBy', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userSpots: Spot[] = [];
      snapshot.forEach((doc) => {
        userSpots.push({ id: doc.id, ...doc.data() } as Spot);
      });
      setLoaded({ uid, spots: userSpots });
    });

    return () => unsubscribe();
  }, [uid, enabled]);

  return uid && loaded.uid === uid ? loaded.spots : NO_SPOTS;
}
