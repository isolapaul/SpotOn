'use client';

import type { ReactNode } from 'react';
import type { HorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { Z } from '@/lib/constants';

// T25 (DUP-03): the full-screen panel shell shared by ProfilePanel, DiscoveryPanel and
// SpotDetailsPanel. Callers keep their own `if (!isOpen) return null`.

const VARIANTS = {
  gray: {
    backdrop: 'absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default',
    panel: 'absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl',
  },
  // SpotDetails: the panel lets clicks through (its content opts back in with pointer-events-auto).
  slate: {
    backdrop: 'absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default pointer-events-auto',
    panel: 'absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 pointer-events-none',
  },
} as const;

interface PanelShellProps {
  onClose: () => void;
  backdropLabel: string;
  variant: keyof typeof VARIANTS;
  swipe: HorizontalSwipe;
  children: ReactNode;
  /** Rendered after the panel inside the root (nested overlays that share the root's stacking context). */
  overlays?: ReactNode;
}

export default function PanelShell({ onClose, backdropLabel, variant, swipe, children, overlays }: Readonly<PanelShellProps>) {
  const styles = VARIANTS[variant];
  return (
    <div className={`fixed inset-0 ${Z.panel} animate-slide-up`} style={{ backgroundColor: '#0f172a' }}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label={backdropLabel}
        tabIndex={-1}
      />
      <div
        className={styles.panel}
        style={{
          transform: `translateX(${swipe.offset}px)`,
          transition: swipe.dragging ? 'none' : 'transform 0.3s ease-out',
        }}
        {...swipe.handlers}
      >
        {children}
      </div>
      {overlays}
    </div>
  );
}
