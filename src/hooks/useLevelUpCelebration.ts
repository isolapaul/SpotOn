import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { levelUpStep } from '@/lib/levelTheme';
import { useMyLevel } from './useMyLevel';

const KEY_PREFIX = 'spoton-level-seen:';

function readSeen(uid: string): number | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + uid);
    return raw === null ? null : Number(raw) || null;
  } catch {
    return null;
  }
}

function writeSeen(uid: string, level: number) {
  try {
    localStorage.setItem(KEY_PREFIX + uid, String(level));
  } catch {
    // Storage unavailable: celebrations may repeat, nothing else breaks.
  }
}

/**
 * The level to celebrate (a level-up on this device since it last saw this user's level), or null.
 * `dismiss` closes the celebration. See levelUpStep for why the stored level never goes down.
 */
export function useLevelUpCelebration(): { level: number | null; dismiss: () => void } {
  const uid = useUserStore((s) => s.user?.uid);
  const mine = useMyLevel();
  // Only the server's answer: a cached level may be stale and would record (or celebrate) it.
  const level = mine?.loaded ? mine.info.level : undefined;
  const [celebrate, setCelebrate] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || level === undefined) return;
    const step = levelUpStep(readSeen(uid), level);
    if (step.next !== readSeen(uid)) writeSeen(uid, step.next);
    // An external system (storage) decides; the state only mirrors its verdict.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step.celebrate) setCelebrate(level);
  }, [uid, level]);

  return { level: celebrate, dismiss: () => setCelebrate(null) };
}
