'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ModalShell from './ModalShell';
import { useOverlay } from '@/hooks/useOverlay';
import { useT } from '@/hooks/useT';

/** The exit animation (Tailwind `animate-card-out`). */
const CLOSE_MS = 260;

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
  /** Panel height classes (default: as tall as its content, at most 90vh). */
  heightClassName?: string;
}

/**
 * A bottom sheet over the app or a panel (the FollowListSheet look): grabber, title, close button,
 * slide in and out; system back / Escape close it (useOverlay). The body gets `close` for actions
 * that should animate the sheet away.
 */
export default function BottomSheet({ title, onClose, children, heightClassName = 'max-h-[90vh]' }: Readonly<BottomSheetProps>) {
  const t = useT();
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing((was) => {
      if (!was) setTimeout(onClose, CLOSE_MS);
      return true;
    });
  }, [onClose]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlay(close, dialogRef);

  return createPortal(
    <ModalShell
      variant="sheet"
      z="modal"
      align="center"
      onBackdropClick={close}
      backdropLabel={t('close')}
      outerClassName="items-end! px-0 pb-0"
      backdropClassName={`absolute inset-0 bg-black/50 touch-manipulation ${
        closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
      }`}
      panelClassName={`w-full max-w-[560px] ${heightClassName} rounded-b-none! ${closing ? 'motion-safe:animate-card-out' : 'motion-safe:animate-card-in'}`}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="flex flex-col min-h-0 h-full outline-none">
        <span aria-hidden="true" className="mx-auto mt-2 w-9 h-[5px] rounded-full bg-white/25" />
        <div className="flex items-center gap-2 pl-5 pr-2 pt-2">
          <h2 className="flex-1 min-w-0 text-[19px] font-bold text-label truncate">{title}</h2>
          <button type="button" onClick={close} aria-label={t('close')} className="no-min-size w-11 h-11 grid place-items-center rounded-full">
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {children(close)}
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}
