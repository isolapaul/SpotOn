'use client';

import { ChevronLeft } from 'lucide-react';

/** The way back from a spot to the list it was opened from (details hero, compact bar, place card). */
export interface SpotBack {
  label: string;
  ariaLabel: string;
  onBack: () => void;
}

const TONE = {
  /** Over a photo (the spot hero). */
  overlay: 'bg-black/35 backdrop-blur-md text-white',
  /** On a dark sheet or card. */
  sheet: 'bg-white/10 text-label',
} as const;

interface BackButtonProps {
  /** Where it goes, shown next to the chevron (e.g. "Profile"). */
  label: string;
  /** The accessible name (e.g. "Back to profile"). */
  ariaLabel: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  tone: keyof typeof TONE;
  className?: string;
  style?: React.CSSProperties;
  /** Hidden from the accessibility tree while another copy is in charge. */
  hidden?: boolean;
}

/** An iOS-style back capsule: a chevron and where it leads. */
export default function BackButton({ label, ariaLabel, onClick, tone, className = '', style, hidden }: Readonly<BackButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={`no-min-size h-9 pl-1.5 pr-3.5 rounded-full inline-flex items-center gap-0.5 text-[15px] font-semibold
        touch-manipulation transition-transform duration-150 active:scale-95 motion-safe:animate-fade-in ${TONE[tone]} ${className}`}
      style={style}
    >
      <ChevronLeft className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </button>
  );
}
