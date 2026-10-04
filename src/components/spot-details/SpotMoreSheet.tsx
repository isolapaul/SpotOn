'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/hooks/useT';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';

export interface SpotMoreItem {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** A second line under the label (the highlight's "You highlighted this"). */
  note?: string;
  pressed?: boolean;
  disabled?: boolean;
}

/**
 * The spot details' "More" sheet: the secondary actions as one grouped list (save to a list, share,
 * highlight). A tap runs the action and closes the sheet. Portalled to the body, as ListPicker, so
 * the scrolling, transformed details panel does not clip it.
 */
export default function SpotMoreSheet({ title, items, onClose }: Readonly<{
  title: string;
  items: readonly SpotMoreItem[];
  onClose: () => void;
}>) {
  const t = useT();
  return createPortal(
    <ModalShell variant="slate" z="modal" onBackdropClick={onClose} backdropLabel={t('close')} panelClassName="w-[92%] max-w-md p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="spot-more-title">
        <h3 id="spot-more-title" className="text-label text-[20px] font-bold leading-tight mb-4 wrap-break-word">{title}</h3>
        <ul className="rounded-r2 bg-white/6 divide-y divide-white/6 overflow-hidden">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={item.pressed}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                className="no-min-size w-full min-h-[52px] flex items-center gap-3.5 px-4 py-3 text-left touch-manipulation
                  active:bg-white/6 transition-colors disabled:opacity-60"
              >
                <span className="w-6 shrink-0 grid place-items-center" aria-hidden="true">{item.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-label text-[16px] leading-snug">{item.label}</span>
                  {item.note && <span className="block mt-0.5 text-label-secondary text-[13px] leading-snug">{item.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="gray" size="md" block onClick={onClose} className="mt-4">{t('cancel')}</Button>
      </div>
    </ModalShell>,
    document.body,
  );
}
