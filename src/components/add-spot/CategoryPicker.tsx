'use client';

import GlyphIcon from '@/components/ui/GlyphIcon';
import { useT } from '@/hooks/useT';
import { useCategoryOptions, useCategoryText } from '@/hooks/useCategory';
import type { CategoryId } from '@/store/useSpotStore';

interface CategoryPickerProps {
  value: CategoryId;
  onChange: (category: CategoryId) => void;
}

/** The category as a grid of glyph tiles (design phase 3), a radio group. */
export default function CategoryPicker({ value, onChange }: Readonly<CategoryPickerProps>) {
  const t = useT();
  const options = useCategoryOptions();
  const text = useCategoryText();
  return (
    <div>
      <p id="spot-category-label" className="block text-white font-medium mb-2">
        {t('category')} *
      </p>
      <div role="radiogroup" aria-labelledby="spot-category-label" className="grid grid-cols-3 gap-2">
        {options.map((c) => {
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(c.id)}
              className={`no-min-size h-[72px] rounded-[14px] flex flex-col items-center justify-center gap-1.5 px-1 text-[12px] font-semibold
                touch-manipulation transition-colors duration-200 active:scale-95 ${
                  selected ? 'bg-brand-600 text-white' : 'bg-white/[.06] text-label-secondary'
                }`}
            >
              <GlyphIcon glyph={c.glyph} className={`w-6 h-6 ${selected ? 'motion-safe:animate-badge-pop' : ''}`} />
              <span className="leading-tight text-center line-clamp-2">{text(c)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
