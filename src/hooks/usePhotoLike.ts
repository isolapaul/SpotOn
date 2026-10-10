import { useState } from 'react';
import { useSpotStore } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';
import { useT } from './useT';
import { actionErrorKey } from '@/lib/callableErrors';
import type { FeedPhoto } from '@/lib/feed';

/**
 * Liking a spot photo (the toggleImageLike callable) with an optimistic count: the tap shows at
 * once, the spots listener confirms it, a failure puts it back. Signed out: the sign-in sheet.
 */
export function usePhotoLike(spotId: string, photo: FeedPhoto | undefined) {
  const t = useT();
  const uid = useUserStore((s) => s.user?.uid ?? null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const id = photo?.imageId ?? null;
  const base = !!uid && !!photo?.likedBy.includes(uid);
  const liked = id !== null && id in optimistic ? optimistic[id] : base;
  const likes = Math.max(0, (photo?.likes ?? 0) + (liked === base ? 0 : liked ? 1 : -1));

  const set = async (next: boolean) => {
    if (!uid) return useUiStore.getState().openPanel('auth');
    if (id === null || next === liked) return;
    setOptimistic((o) => ({ ...o, [id]: next }));
    if (next) playSound('like');
    try {
      await useSpotStore.getState().toggleSpotImageLike(spotId, id);
    } catch (error) {
      console.error('Photo like failed:', error);
      setOptimistic((o) => ({ ...o, [id]: !next }));
      useToastStore.getState().showToast(t(actionErrorKey(error)), 'error');
    }
  };

  return { canLike: id !== null, liked, likes, toggle: () => set(!liked), like: () => set(true) };
}
