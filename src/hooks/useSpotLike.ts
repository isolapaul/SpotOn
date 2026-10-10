import { useState } from 'react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';
import { useT } from './useT';
import { actionErrorKey } from '@/lib/callableErrors';
import { spotLikeState } from '@/lib/spotLikes';

/**
 * Liking a spot (the toggleSpotLike callable) with an optimistic count: the tap shows at once,
 * the spots listener confirms it, a failure puts it back. Signed out: the sign-in sheet.
 */
export function useSpotLike(spot: Pick<Spot, 'id' | 'likedBy' | 'likeCount' | 'status'>) {
  const t = useT();
  const uid = useUserStore((s) => s.user?.uid ?? null);
  // The tap, against the stored state it was made on: once the listener delivers a change, it
  // no longer applies (so a like or unlike from another device shows too).
  const [tap, setTap] = useState<{ liked: boolean; on: boolean } | null>(null);
  const stored = spotLikeState(spot, uid, null).liked;
  const state = spotLikeState(spot, uid, tap && tap.on === stored ? tap.liked : null);
  const setOptimistic = (liked: boolean) => setTap({ liked, on: stored });

  const set = async (next: boolean) => {
    if (!uid) return useUiStore.getState().openPanel('auth');
    if (next === state.liked || spot.status !== 'approved') return;
    setOptimistic(next);
    if (next) playSound('like');
    try {
      await useSpotStore.getState().toggleSpotLike(spot.id);
    } catch (error) {
      console.error('Spot like failed:', error);
      setOptimistic(!next);
      useToastStore.getState().showToast(t(actionErrorKey(error)), 'error');
    }
  };

  return { ...state, canLike: spot.status === 'approved', toggle: () => set(!state.liked), like: () => set(true) };
}
