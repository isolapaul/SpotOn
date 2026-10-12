'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '@/hooks/useOverlay';
import { ThumbsUp, X } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import PersonRow from '../profile/PersonRow';
import FollowChip from '../profile/FollowChip';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useLikeStore } from '@/store/useLikeStore';
import type { PersonResult } from '@/store/useFollowStore';
import { useUserStore } from '@/store/useUserStore';
import type { Spot } from '@/store/useSpotStore';

/** The exit animation (Tailwind `animate-card-out`). */
const CLOSE_MS = 260;

type Loaded = { people: PersonResult[] } | { error: true } | null;

/** Who liked a spot: a bottom sheet of people, newest first (getSpotLikers); a row opens the profile. */
export default function LikersSheet({ spot, onClose }: Readonly<{ spot: Pick<Spot, 'id' | 'name'>; onClose: () => void }>) {
  const t = useT();
  const me = useUserStore((s) => s.user?.uid ?? null);
  const openProfile = useOpenProfile();
  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    useLikeStore.getState().getLikers(spot.id)
      .then((people) => live && setLoaded({ people }))
      .catch((error: unknown) => {
        console.error('Likers failed to load:', error);
        if (live) setLoaded({ error: true });
      });
    return () => {
      live = false;
    };
  }, [spot.id, attempt]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlay(close, dialogRef);
  const retry = () => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  };
  const loading = loaded === null;
  const failed = loaded !== null && 'error' in loaded;
  const people = loaded && 'people' in loaded ? loaded.people : [];

  return createPortal(
    <ModalShell
      variant="sheet"
      z="modal"
      onBackdropClick={close}
      backdropLabel={t('close')}
      outerClassName="items-end! px-0 pb-0"
      backdropClassName={`absolute inset-0 bg-black/50 touch-manipulation ${
        closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
      }`}
      panelClassName={`w-full max-w-[560px] max-h-[75vh] rounded-b-none! ${closing ? 'motion-safe:animate-card-out' : 'motion-safe:animate-card-in'}`}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="likers-title" className="flex flex-col min-h-0 h-full outline-none">
        <span aria-hidden="true" className="mx-auto mt-2 w-9 h-[5px] rounded-full bg-white/25" />
        <div className="flex items-center gap-2 pl-5 pr-3 pt-2 pb-2 border-b border-white/6">
          <span className="w-9 h-9 rounded-full grid place-items-center bg-brand-500/20 text-brand-300">
            <ThumbsUp className="w-[18px] h-[18px] fill-brand-500 motion-safe:animate-badge-pop" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 id="likers-title" className="text-label text-[18px] font-bold leading-tight">{t('likedBy')}</h3>
            <p className="text-label-secondary text-[13px] truncate">{spot.name}</p>
          </div>
          <button type="button" onClick={close} aria-label={t('close')} className="no-min-size w-11 h-11 grid place-items-center rounded-full">
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain py-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          {loading ? (
            <div aria-busy="true" className="px-4 py-3 flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full skeleton motion-safe:animate-shimmer" />
                  <span className="h-4 w-32 rounded skeleton motion-safe:animate-shimmer" />
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className="px-8 py-10 flex flex-col items-center gap-3 text-center">
              <p className="text-label-secondary">{t('loadFailed')}</p>
              <button type="button" onClick={retry} className="h-11 px-5 rounded-full bg-white/10 text-label font-semibold">
                {t('tryAgain')}
              </button>
            </div>
          ) : people.length === 0 ? (
            <p className="px-8 py-10 text-center text-label-secondary">{t('noLikesYet')}</p>
          ) : (
            people.map((p, i) => (
              <PersonRow
                key={p.uid}
                person={p}
                index={i}
                onOpen={() => {
                  close();
                  openProfile(p.uid);
                }}
                trailing={me && p.uid !== me ? <FollowChip uid={p.uid} isPrivate={p.isPrivate} /> : undefined}
              />
            ))
          )}
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}
