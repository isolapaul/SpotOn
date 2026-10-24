'use client';

import { useT } from '@/hooks/useT';

/** "No spots found" over the bare map (it shares the top-left slot with the move banner). */
export default function EmptyMapNotice() {
  const t = useT();
  return (
    <div
      className="material-chrome absolute z-10 rounded-2xl px-4 py-3 animate-fade-in pointer-events-none"
      style={{
        top: 'calc(env(safe-area-inset-top) + 8px)',
        left: 'max(12px, calc(env(safe-area-inset-left) + 8px))',
        right: 'calc(max(12px, calc(env(safe-area-inset-right) + 8px)) + 52px)',
      }}
    >
      <p className="text-chrome-ink text-[15px] leading-snug">{t('noSpotsFound')}</p>
    </div>
  );
}
