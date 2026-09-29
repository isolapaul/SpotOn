import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';

// Design phase 3: the shared button. Capsules with a 44pt minimum hit area; one look per role.

const VARIANTS = {
  filled: 'bg-brand-600 text-white active:bg-brand-700',
  tinted: 'bg-brand-500/15 text-brand-300 active:bg-brand-500/25',
  gray: 'bg-white/10 text-label active:bg-white/15',
  plain: 'bg-transparent text-brand-400 active:opacity-60',
  destructive: 'bg-[#FF453A]/15 text-[#FF6961] active:bg-[#FF453A]/25',
} as const;

const SIZES = {
  lg: 'h-[50px] px-5 text-[17px] gap-2',
  md: 'h-11 px-4 text-[15px] gap-2',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Full width of the container. */
  block?: boolean;
  children: ReactNode;
}

export default function Button({ variant = 'filled', size = 'lg', block = false, className = '', children, ...rest }: Readonly<ButtonProps>) {
  return (
    <button
      type="button"
      {...rest}
      className={`no-min-size inline-flex items-center justify-center rounded-full font-semibold touch-manipulation
        transition-[transform,background-color,opacity] duration-150 active:scale-[.97] disabled:opacity-40 disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${VARIANTS[variant]} ${SIZES[size]} ${
          block ? 'w-full' : ''
        } ${className}`}
    >
      {children}
    </button>
  );
}

/** The round close button of sheets and cards: a 30pt gray circle in a 44pt hit area. */
export function CloseButton({ label, onClick, className = '', disabled }: Readonly<{ label: string; onClick: () => void; className?: string; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`no-min-size w-11 h-11 grid place-items-center rounded-full touch-manipulation disabled:opacity-40 ${className}`}
    >
      <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
        <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
      </span>
    </button>
  );
}
