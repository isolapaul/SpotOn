'use client';

import { X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import BackButton, { type SpotBack } from '@/components/ui/BackButton';

interface CompactBarProps {
  title: string;
  /** Shown once the hero has scrolled away (design phase 3). */
  shown: boolean;
  onClose: () => void;
  back?: SpotBack;
}

/** The title bar that fades in over the scrolled details, with the hero's Close (or back) in view. */
export default function CompactBar({ title, shown, onClose, back }: Readonly<CompactBarProps>) {
  const t = useT();
  return (
    <div
      aria-hidden={!shown || undefined}
      className={`material-sheet absolute inset-x-0 top-0 z-10 flex items-end justify-center pb-3 px-16 pointer-events-none
        border-b border-white/6 transition-opacity duration-150 ${shown ? 'opacity-100' : 'opacity-0'}`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
    >
      <span className="text-[17px] font-semibold text-label truncate">{title}</span>
      {/* Rendered only while shown: the hero's own button is the one in view otherwise */}
      {shown &&
        (back ? (
          <BackButton
            label={back.label}
            ariaLabel={back.ariaLabel}
            onClick={back.onBack}
            tone="sheet"
            className="pointer-events-auto absolute left-3"
            style={{ bottom: '5px' }}
          />
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="no-min-size pointer-events-auto absolute left-3 w-11 h-11 grid place-items-center rounded-full"
            style={{ bottom: '1px' }}
          >
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        ))}
    </div>
  );
}
