import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMyLevelStore } from '@/store/useMyLevelStore';
import { useUserStore } from '@/store/useUserStore';
import { getLevelInfo, getLevelProgress, type LevelInfo } from '@/lib/levelUtils';

/**
 * The signed-in user's XP and level (item 5, from the server via useMyLevelStore); null when
 * signed out. `loaded` is false until the server has answered for this user.
 */
export function useMyLevel(): { xp: number; info: LevelInfo; progress: number; loaded: boolean } | null {
  const uid = useUserStore((s) => s.user?.uid);
  const mine = useMyLevelStore(useShallow(({ uid, xp, level, loaded }) => ({ uid, xp, level, loaded })));
  return useMemo(() => {
    if (!uid) return null;
    const current = mine.uid === uid;
    const xp = current ? mine.xp : 0;
    const info = getLevelInfo(current ? mine.level : 1);
    return { xp, info, progress: getLevelProgress(xp, info), loaded: current && mine.loaded };
  }, [uid, mine]);
}
