'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';

// Quest configuration
export const QUEST_START = new Date('2026-02-10T00:00:00');
export const QUEST_END = new Date('2026-02-24T23:59:59');
export const QUEST_REQUIREMENT = 5;

interface QuestProgress {
  count: number;
  isLoading: boolean;
  isCompleted: boolean;
  error: string | null;
}

/**
 * Hook to get real-time Valentine's Quest progress by querying the spots collection.
 * Counts approved spots created by the user within the quest date range.
 */
export function useQuestProgress(): QuestProgress {
  const { user } = useUserStore();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create Firestore query for qualifying spots
    // Query: spots where createdBy == user.uid AND status == 'approved' AND createdAt within quest dates
    const spotsRef = collection(db, 'spots');
    
    // Convert dates to Firestore Timestamps
    const startTimestamp = Timestamp.fromDate(QUEST_START);
    const endTimestamp = Timestamp.fromDate(QUEST_END);

    // Note: Firestore requires a composite index for this query
    // The index will be created automatically or can be created via the link in console error
    const q = query(
      spotsRef,
      where('createdBy', '==', user.uid),
      where('status', '==', 'approved'),
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching quest progress:', err);
        setError(err.message);
        setIsLoading(false);
        
        // If index error, fallback to a simpler query
        if (err.code === 'failed-precondition') {
          console.warn(
            'Firestore index required. Create a composite index for: ' +
            'spots collection with fields: createdBy (Ascending), status (Ascending), createdAt (Ascending)'
          );
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return {
    count,
    isLoading,
    isCompleted: count >= QUEST_REQUIREMENT,
    error,
  };
}

/**
 * Returns whether the quest is currently active (within date range)
 */
export function isQuestActive(): boolean {
  const now = Date.now();
  return now >= QUEST_START.getTime() && now < QUEST_END.getTime();
}
