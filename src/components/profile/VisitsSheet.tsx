'use client';

import { Footprints } from 'lucide-react';
import BottomSheet from '../ui/BottomSheet';
import CategoryIcon from '../ui/CategoryIcon';
import { useT, useLanguage } from '@/hooks/useT';
import { useVisitStore } from '@/store/useVisitStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useUiStore } from '@/store/useUiStore';

/** Stamp tints, picked by the spot id so a stamp keeps its colour. */
const TINTS = ['ring-brand-400 text-brand-300', 'ring-amber-300 text-amber-200', 'ring-sky-300 text-sky-200', 'ring-rose-300 text-rose-200', 'ring-violet-300 text-violet-200'];

function tintOf(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** The own "I was here" stamps (growth plan §4), newest first; a stamp flies to its spot. */
export default function VisitsSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const t = useT();
  const language = useLanguage();
  const visits = useVisitStore((s) => s.visits);
  const spots = useSpotStore((s) => s.spots);
  const byId = new Map(spots.map((s) => [s.id, s]));

  return (
    <BottomSheet title={t('visitsTitle', { count: visits.length })} onClose={onClose} heightClassName="h-[85vh]">
      {(close) => visits.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 py-12">
          <Footprints className="w-10 h-10 text-label-tertiary" aria-hidden="true" />
          <p className="text-label-secondary text-[15px] max-w-[260px]">{t('visitsEmpty')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 pt-3">
          {visits.map((v, i) => {
            const spot = byId.get(v.spotId);
            return (
              <li key={v.spotId} className="motion-safe:animate-item-in" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <button
                  type="button"
                  disabled={!spot}
                  onClick={() => {
                    close();
                    useUiStore.getState().openSpotLink(v.spotId);
                  }}
                  className="no-min-size w-full flex flex-col items-center gap-1.5 text-center disabled:opacity-50"
                >
                  <span className={`w-[72px] h-[72px] rounded-full grid place-items-center ring-2 ring-offset-4 ring-offset-surface-2 bg-white/5 -rotate-6 ${tintOf(v.spotId)}`}>
                    <CategoryIcon category={spot?.category ?? 'other'} className="w-8 h-8" />
                  </span>
                  <span className="text-[13px] font-semibold text-label line-clamp-2 leading-tight">{v.spotName || spot?.name}</span>
                  <span className="text-[11px] text-label-tertiary">
                    {new Date(v.visitedAt).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
