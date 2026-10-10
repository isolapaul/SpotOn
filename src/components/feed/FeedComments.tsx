'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import ModalShell from '../ui/ModalShell';
import ReviewForm from '../spot-details/ReviewForm';
import ReviewList from '../spot-details/ReviewList';

/** The exit animation (Tailwind `animate-card-out`). */
const CLOSE_MS = 260;

/**
 * A feed card's comments: the spot's reviews with their replies, and the review form, in a bottom
 * sheet over the feed (the same parts as the spot details, so nothing behaves differently).
 */
export default function FeedComments({ spot, onClose }: Readonly<{ spot: Spot; onClose: () => void }>) {
  const t = useT();
  const user = useUserStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const [closing, setClosing] = useState(false);
  const canReview = spot.status === 'approved' || isAdmin;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

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
      panelClassName={`w-full max-w-[560px] h-[88vh] rounded-b-none! ${closing ? 'motion-safe:animate-card-out' : 'motion-safe:animate-card-in'}`}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="feed-comments-title" className="flex flex-col min-h-0 h-full">
        <span aria-hidden="true" className="mx-auto mt-2 w-9 h-[5px] rounded-full bg-white/25" />
        <div className="flex items-center gap-2 pl-5 pr-3 pt-2 pb-2 border-b border-white/6">
          <div className="flex-1 min-w-0">
            <h3 id="feed-comments-title" className="text-label text-[20px] font-bold leading-tight">{t('reviews')}</h3>
            <p className="text-label-secondary text-[13px] truncate">{spot.name}</p>
          </div>
          <button type="button" onClick={close} aria-label={t('close')} className="no-min-size w-11 h-11 grid place-items-center rounded-full">
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {user && canReview ? (
            <ReviewForm spot={spot} user={user} />
          ) : !user ? (
            <div className="rounded-[18px] bg-surface-1 p-4 mb-4 flex items-center gap-3">
              <p className="flex-1 text-label-secondary text-[15px]">{t('feedSignInToReview')}</p>
              <button
                type="button"
                onClick={() => {
                  close();
                  useUiStore.getState().openAuth();
                }}
                className="no-min-size h-10 px-4 rounded-full bg-brand-600 text-white font-semibold text-[15px]"
              >
                {t('signIn')}
              </button>
            </div>
          ) : null}
          <ReviewList reviews={spot.reviews} spotId={spot.id} reportable={spot.status === 'approved'} />
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}
