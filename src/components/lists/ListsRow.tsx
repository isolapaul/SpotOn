'use client';

import { ChevronLeft, Globe2, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useListStore } from '@/store/useListStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { SpotList } from '@/lib/lists';
import ProfileSpotCard from '../profile/ProfileSpotCard';

/** Lists as cards (name and count) above the favourites; a tap opens the list. */
export function ListCards({ lists, onOpen, title = true }: Readonly<{ lists: SpotList[]; onOpen: (id: string) => void; title?: boolean }>) {
  const t = useT();
  if (!lists.length) return null;
  return (
    <section>
      {title && <h3 className="px-1 mb-2 text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">{t('lists')}</h3>}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onOpen(l.id)}
            className="no-min-size shrink-0 w-36 h-20 rounded-[16px] bg-surface-1 p-3 text-left active:scale-[.98] transition-transform"
          >
            <span className="block text-label font-semibold text-[15px] line-clamp-2 leading-snug">{l.name}</span>
            <span className="mt-1 flex items-center gap-1 text-label-tertiary text-[12px]">
              {!title ? null : l.shared ? <Globe2 className="w-3 h-3" aria-hidden="true" /> : <Lock className="w-3 h-3" aria-hidden="true" />}
              {t(l.spotIds.length === 1 ? 'listSpotCountOne' : 'listSpotCount', { count: l.spotIds.length })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** One of the user's lists: its spots, sharing on the profile, removing spots, deleting the list. */
export function ListView({ list, spots, onBack, onOpenSpot, editable }: Readonly<{
  list: SpotList;
  spots: Spot[];
  onBack: () => void;
  onOpenSpot: (id: string) => void;
  editable: boolean;
}>) {
  const t = useT();
  const { setShared, remove, toggleSpot } = useListStore();
  const showToast = useToastStore((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);
  // Optimistic: the switch moves at once, the snapshot confirms it (or a failure puts it back).
  const [shared, setSharedLocal] = useState<boolean | null>(null);
  const isShared = shared ?? list.shared;
  const toggleShared = (next: boolean) => {
    setSharedLocal(next);
    void setShared(list.id, next).catch((e) => {
      console.error('List action failed:', e);
      showToast(t('genericError'), 'error');
    }).finally(() => setSharedLocal(null));
  };
  const inList = list.spotIds.map((id) => spots.find((s) => s.id === id)).filter((s): s is Spot => !!s);
  const act = (p: Promise<unknown>) => p.catch((e) => {
    console.error('List action failed:', e);
    showToast(t('genericError'), 'error');
  });
  return (
    <div className="space-y-3 motion-safe:animate-fade-in">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label={t('back')} className="no-min-size w-9 h-9 -ml-1 grid place-items-center rounded-full bg-white/8">
          <ChevronLeft className="w-5 h-5 text-label" aria-hidden="true" />
        </button>
        <h3 className="flex-1 min-w-0 truncate text-label text-[20px] font-bold">{list.name}</h3>
        {editable && (
          <button type="button" onClick={() => setConfirm(true)} aria-label={t('deleteList')} className="no-min-size w-9 h-9 grid place-items-center rounded-full text-label-tertiary">
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {editable && (
        <div className="flex items-center justify-between gap-3 rounded-r2 bg-surface-1 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-label text-[15px] font-medium">{t('showListOnProfile')}</p>
            <p className="text-label-secondary text-xs mt-0.5">{t('showListOnProfileHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isShared}
            aria-label={t('showListOnProfile')}
            onClick={() => toggleShared(!isShared)}
            className={`no-min-size relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-200 ${isShared ? 'bg-brand-600' : 'bg-white/15'}`}
          >
            <span className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-ios ${isShared ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      )}
      {confirm && (
        <div className="rounded-r2 bg-surface-1 p-4">
          <p className="text-label text-sm">{t('deleteListConfirm', { name: list.name })}</p>
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={() => setConfirm(false)} className="px-4 h-9 rounded-lg bg-white/8 text-label text-sm">{t('cancel')}</button>
            <button type="button" onClick={() => void act(remove(list.id).then(onBack))} className="px-4 h-9 rounded-lg bg-red-500/20 text-red-300 text-sm font-semibold">{t('delete')}</button>
          </div>
        </div>
      )}
      {inList.length === 0 ? (
        <p className="py-8 text-center text-label-secondary text-sm">{t('listEmpty')}</p>
      ) : (
        inList.map((spot) => (
          <ProfileSpotCard key={spot.id} spot={spot} onOpen={() => onOpenSpot(spot.id)}>
            {editable ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); void act(toggleSpot(list.id, spot.id, false)); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void act(toggleSpot(list.id, spot.id, false)); } }}
                className="mt-1.5 inline-block text-[13px] text-label-tertiary"
              >
                {t('removeFromList')}
              </span>
            ) : <span />}
          </ProfileSpotCard>
        ))
      )}
    </div>
  );
}
