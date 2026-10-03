import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Reply {
  id: string;
  reviewId: string;
  userId: string;
  text: string;
  createdAt: number;
  edited: boolean;
}

/** The replies of a spot's reviews (questions and answers), live while the spot is open; oldest first. */
export function useReplies(spotId: string, enabled: boolean): Reply[] {
  const [state, setState] = useState<{ spotId: string; replies: Reply[] }>({ spotId, replies: [] });
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, 'spots', spotId, 'replies'), orderBy('createdAt', 'asc')),
      (snap) => {
        const replies = snap.docs.map((d) => {
          const at = d.get('createdAt') as { toMillis?: () => number } | null;
          return {
            id: d.id,
            reviewId: String(d.get('reviewId') ?? ''),
            userId: String(d.get('userId') ?? ''),
            text: String(d.get('text') ?? ''),
            createdAt: at?.toMillis?.() ?? Date.now(),
            edited: d.get('editedAt') != null,
          };
        });
        setState({ spotId, replies });
      },
      (error) => console.error('Replies listener failed:', error),
    );
  }, [spotId, enabled]);
  return state.spotId === spotId ? state.replies : [];
}
