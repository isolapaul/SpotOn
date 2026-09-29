'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Z } from '@/lib/constants';

// T25 (DUP-04): the centred modal shell. Three looks: `glass` (Auth, AddSpot, UsernameSetup),
// `slate` (Feedback) and `sheet` (NotificationCenter: opaque, no built-in animation, so the
// caller passes its own enter/exit classes).

const VARIANTS = {
  glass: {
    outerStyle: { backgroundColor: 'rgba(15, 23, 42, 0.5)' } as CSSProperties,
    backdrop: 'absolute inset-0 bg-black/70 backdrop-blur-xl',
    /** A glass backdrop that closes on click is a button; it keeps the arrow cursor. */
    backdropButton: 'absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default',
    panelStart: 'relative glass-card',
    panelEnd: 'animate-slide-up',
  },
  slate: {
    outerStyle: undefined,
    backdrop: 'absolute inset-0 bg-black/50 backdrop-blur-sm touch-manipulation',
    backdropButton: 'absolute inset-0 bg-black/50 backdrop-blur-sm touch-manipulation',
    panelStart: 'relative bg-slate-900',
    panelEnd: 'rounded-3xl shadow-2xl border-2 border-white/20 overflow-hidden animate-scale-in flex flex-col',
  },
  sheet: {
    outerStyle: undefined,
    backdrop: 'absolute inset-0 bg-black/40 backdrop-blur-sm touch-manipulation',
    backdropButton: 'absolute inset-0 bg-black/40 backdrop-blur-sm touch-manipulation',
    panelStart: 'relative bg-slate-900',
    panelEnd: 'rounded-[28px] shadow-2xl ring-1 ring-white/10 overflow-hidden flex flex-col',
  },
} as const;

/** Panel margins that keep a tall glass modal clear of the notch and home indicator (Auth, AddSpot). */
export const SAFE_AREA_MARGINS: CSSProperties = {
  marginTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
  marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
};

const ALIGN = { center: 'items-center', start: 'items-start' } as const;
const JUSTIFY = { center: 'justify-center', end: 'justify-end' } as const;

interface ModalShellProps {
  variant: keyof typeof VARIANTS;
  z: keyof typeof Z;
  /** Without it the backdrop is a plain, non-interactive div. */
  onBackdropClick?: () => void;
  backdropLabel?: string;
  align?: keyof typeof ALIGN;
  /** Horizontal placement; 'end' anchors a sheet to the top-right control stack (design 1C). */
  justify?: keyof typeof JUSTIFY;
  /** Replaces the variant's default outer style (glass: the translucent slate background). */
  outerStyle?: CSSProperties;
  /** Replaces the outer padding class (`p-4`); pass '' for none. */
  outerClassName?: string;
  /** Replaces the variant's backdrop classes. */
  backdropClassName?: string;
  /** Per-site size classes, placed between the variant's base classes. */
  panelClassName: string;
  panelStyle?: CSSProperties;
  children: ReactNode;
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

export default function ModalShell({
  variant,
  z,
  onBackdropClick,
  backdropLabel,
  align = 'center',
  justify = 'center',
  outerStyle,
  outerClassName = 'p-4',
  backdropClassName,
  panelClassName,
  panelStyle,
  children,
}: Readonly<ModalShellProps>) {
  const styles = VARIANTS[variant];
  const outer = join('fixed inset-0', Z[z], 'flex', ALIGN[align], JUSTIFY[justify], outerClassName, 'animate-fade-in');

  let backdrop: ReactNode;
  if (!onBackdropClick) {
    backdrop = <div className={backdropClassName ?? styles.backdrop} />;
  } else if (variant === 'glass') {
    // Only the glass backdrops are keyboard-dismissible (Escape); the slate ones never were.
    backdrop = (
      <button
        type="button"
        className={backdropClassName ?? styles.backdropButton}
        onClick={onBackdropClick}
        onKeyDown={(e) => e.key === 'Escape' && onBackdropClick()}
        aria-label={backdropLabel}
        tabIndex={-1}
      />
    );
  } else {
    backdrop = (
      <button
        type="button"
        className={backdropClassName ?? styles.backdropButton}
        onClick={onBackdropClick}
        aria-label={backdropLabel}
      />
    );
  }

  return (
    <div className={outer} style={outerStyle ?? styles.outerStyle}>
      {backdrop}
      <div className={join(styles.panelStart, panelClassName, styles.panelEnd)} style={panelStyle}>
        {children}
      </div>
    </div>
  );
}
