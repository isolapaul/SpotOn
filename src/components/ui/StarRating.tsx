'use client';

import { Star } from 'lucide-react';

// T25 (DUP-08): the five-star row. Callers pass the rating already rounded the way they show it.

const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const SIZE = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-5 h-5' } as const;
const EMPTY_TONE = { faint: 'text-white/20', dim: 'text-white/30' } as const;
const FILLED = 'text-yellow-400 fill-yellow-400';
const WRAPPER = { 'gap-0.5': 'flex gap-0.5', 'gap-1': 'flex gap-1' } as const;

interface StarRatingProps {
  rating: number;
  size: keyof typeof SIZE;
  emptyTone: keyof typeof EMPTY_TONE;
  gap?: keyof typeof WRAPPER;
  /** false: the stars are rendered without a wrapper, as children of the caller's row. */
  wrapper?: boolean;
  /** Renders each star as a button (review form). */
  onSelect?: (value: number) => void;
}

export default function StarRating({ rating, size, emptyTone, gap = 'gap-0.5', wrapper = true, onSelect }: Readonly<StarRatingProps>) {
  const starClass = (value: number) => `${SIZE[size]} ${value <= rating ? FILLED : EMPTY_TONE[emptyTone]}`;
  const stars = STAR_VALUES.map((value) =>
    onSelect ? (
      <button key={value} onClick={() => onSelect(value)} className="transition-all duration-200 active:scale-95">
        <Star className={starClass(value)} />
      </button>
    ) : (
      <Star key={value} className={starClass(value)} />
    ),
  );
  if (!wrapper) return <>{stars}</>;
  return <div className={WRAPPER[gap]}>{stars}</div>;
}
