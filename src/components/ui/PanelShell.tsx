'use client';

import type { ReactNode } from 'react';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { supportsViewTransitions } from '@/hooks/viewTransition';
import { Z } from '@/lib/constants';

// T25 (DUP-03): the full-screen panel shell shared by ProfilePanel, DiscoveryPanel and
// SpotDetailsPanel. Callers keep their own `if (!isOpen) return null`. Design: it behaves like an
// iOS sheet: a grabber on top, pulled down (from the top of its content) it closes; no sideways
// swipe (owner decision, it showed the black page behind).

const VARIANTS = {
  gray: {
    backdrop: 'absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default',
    panel: 'absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl',
  },
  // Design phase 3: the grouped dark surface (Discovery).
  surface: {
    backdrop: 'absolute inset-0 bg-black/70 cursor-default',
    panel: 'absolute inset-0 flex flex-col bg-surface-0',
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
  children: ReactNode;
  /** Rendered after the panel inside the root (nested overlays that share the root's stacking context). */
  overlays?: ReactNode;
}

export default function PanelShell({ onClose, backdropLabel, variant, children, overlays }: Readonly<PanelShellProps>) {
  const styles = VARIANTS[variant];
  const { ref: sheetRef, offset, dragging } = useSheetDrag(onClose);
  return (
    // view-transition-name: the open and close sheet transition (hooks/viewTransition). The CSS
    // slide-up is only the fallback without the API: with both, the slide replayed after the
    // transition had finished (a visible flash on open).
    <div className={`fixed inset-0 ${Z.panel} ${supportsViewTransitions() ? '' : 'animate-slide-up'}`} style={{ viewTransitionName: 'panel' }}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label={backdropLabel}
        tabIndex={-1}
      />
      <div
        ref={sheetRef}
        className={`${styles.panel} overflow-hidden`}
        style={{
          transform: offset ? `translateY(${offset}px)` : undefined,
          borderRadius: offset > 0 ? '28px 28px 0 0' : undefined,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.35s',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 w-9 h-[5px] rounded-full bg-white/30"
          style={{ top: 'calc(env(safe-area-inset-top) + 6px)' }}
        />
        {children}
      </div>
      {overlays}
    </div>
  );
}
