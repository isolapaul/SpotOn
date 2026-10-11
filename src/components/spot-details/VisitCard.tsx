'use client';

import { useState } from 'react';
import { Footprints, Loader2 } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useVisitStore, visitErrorKey } from '@/store/useVisitStore';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';
import { useT, useLanguage } from '@/hooks/useT';

/**
 * "I was here" (growth plan §4) under the actions of an approved spot: one tap checks the device's
 * position against the spot (on the server) and stamps it; afterwards it shows the stamp's date.
 * The count of everyone's visits shows when there are any.
 */
export default function VisitCard({ spot, visits, onVisited }: Readonly<{ spot: Spot; visits?: number; onVisited: () => void }>) {
  const t = useT();
  const language = useLanguage();
  const signedIn = useUserStore((s) => !!s.user);
  const mine = useVisitStore((s) => s.visits.find((v) => v.spotId === spot.id));
  const markVisited = useVisitStore((s) => s.markVisited);
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  if (spot.status !== 'approved') return null;

  const check = async () => {
    if (busy) return;
    if (!signedIn) {
      useToastStore.getState().showToast(t('visitSignIn'), 'info');
      return;
    }
    setBusy(true);
    try {
      await markVisited(spot.id);
      setStamped(true);
      playSound('levelUp');
      onVisited();
    } catch (error) {
      useToastStore.getState().showToast(t(visitErrorKey(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const others = visits ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 pl-4">
      <span className={`w-10 h-10 shrink-0 rounded-full grid place-items-center ${mine ? 'bg-brand-500/20 text-brand-300' : 'bg-white/8 text-label-secondary'} ${stamped ? 'motion-safe:animate-level-pop' : ''}`}>
        <Footprints className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-label">{mine ? t('visitDone') : t('visitQuestion')}</p>
        <p className="text-[13px] text-label-tertiary">
          {mine
            ? new Date(mine.visitedAt).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' })
            : others > 0 ? t('visitCount', { count: others }) : t('visitHint')}
        </p>
      </div>
      {!mine && (
        <button type="button" onClick={check} disabled={busy} className="shrink-0 h-10 px-4 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {t('visitButton')}
        </button>
      )}
    </div>
  );
}
