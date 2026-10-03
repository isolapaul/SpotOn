import { useCallback } from 'react';
import { useUiStore } from '@/store/useUiStore';
import { useUserStore } from '@/store/useUserStore';
import { runViewTransition } from './viewTransition';

/** Opens someone's profile page (item 8); the signed-in user's own uid opens their own profile. */
export function useOpenProfile(): (uid: string | undefined) => void {
  return useCallback((uid) => {
    if (!uid || uid === 'deleted-user') return;
    const me = useUserStore.getState().user?.uid;
    const ui = useUiStore.getState();
    runViewTransition(() => (uid === me ? ui.openPanel('profile') : ui.openUserProfile(uid)));
  }, []);
}
