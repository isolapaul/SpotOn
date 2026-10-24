import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useLikeStore } from '@/store/useLikeStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';
import { useT } from './useT';
import { actionErrorKey } from '@/lib/callableErrors';
import { liveLikeTap, spotLikeState, type LikeTap } from '@/lib/spotLikes';

/**
 * Liking a spot (the setSpotLike callable) with an optimistic count: the tap shows at once, the
 * listeners confirm it, a failure puts it back. The server sets the asked state, so a repeat, a
 * retry or a stale screen never flips it. Signed out: the sign-in sheet.
 */
export function useSpotLike(spot: Pick<Spot, 'id' | 'likeCount' | 'status'>) {
  const t = useT();
  const uid = useUserStore((s) => s.user?.uid ?? null);
  const stored = useLikeStore((s) => s.liked.has(spot.id));
  const [tap, setTap] = useState<LikeTap | null>(null);
  // A spent tap is dropped (adjusting state while rendering), so it can never apply again.
  const live = liveLikeTap(tap, spot.id, stored);
  if (tap && !live) setTap(null);
  const state = spotLikeState(spot.likeCount, stored, live);

  const set = async (next: boolean) => {
    if (!uid) return useUiStore.getState().openAuth();
    if (next === state.liked || spot.status !== 'approved') return;
    setTap({ spotId: spot.id, liked: next, on: stored });
    if (next) playSound('like');
    try {
      await useLikeStore.getState().setLike(spot.id, next);
    } catch (error) {
      console.error('Spot like failed:', error);
      setTap(null);
      useToastStore.getState().showToast(t(actionErrorKey(error)), 'error');
    }
  };

  return { ...state, canLike: spot.status === 'approved', toggle: () => set(!state.liked), like: () => set(true) };
}
