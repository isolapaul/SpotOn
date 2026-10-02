'use client';

import { useCallback, useState } from 'react';
import { Flag } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { ReportTarget } from '@/store/useSafetyStore';
import ReportSheet from './ReportSheet';

const LOOK = {
  text: 'no-min-size inline-flex items-center gap-1.5 text-[14px] text-label-tertiary active:text-label-secondary',
  icon: 'no-min-size w-8 h-8 grid place-items-center rounded-full text-label-tertiary active:bg-white/10',
  overlay: 'p-3 rounded-full bg-black/50 active:bg-black/70 text-white',
} as const;

/** A quiet "Report" control that opens the report sheet; `variant` picks the look of its place. */
export default function ReportButton({ target, variant = 'text', className = '' }: Readonly<{
  target: ReportTarget;
  variant?: keyof typeof LOOK;
  className?: string;
}>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t('report')}
        className={`${LOOK[variant]} ${className}`}
      >
        <Flag className={variant === 'overlay' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
        {variant === 'text' && t('report')}
      </button>
      {open && <ReportSheet target={target} onClose={close} />}
    </>
  );
}
