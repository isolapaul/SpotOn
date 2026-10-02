'use client';

import { useState } from 'react';
import GlyphIcon from '@/components/ui/GlyphIcon';
import { useT } from '@/hooks/useT';
import { MAX_CATEGORY_NAME, type CustomCategory } from '@/lib/categories';
import { CATEGORY_ICON_GLYPHS, CATEGORY_ICON_IDS, CATEGORY_ICON_LABELS, type CategoryIconId } from '@/lib/categoryIcons';
import type { CategoryFields } from '@/store/useCategoryStore';

interface CategoryFormProps {
  initial?: CustomCategory;
  submitLabel: string;
  onSubmit: (fields: CategoryFields) => Promise<void>;
  onCancel?: () => void;
}

const INPUT = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:border-white/30';

/**
 * A category's names and icon (one of the hand-drawn set), for creating and editing (item 7).
 * Hungarian is required; empty English/German names fall back to it.
 */
export default function CategoryForm({ initial, submitLabel, onSubmit, onCancel }: Readonly<CategoryFormProps>) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [nameDe, setNameDe] = useState(initial?.nameDe ?? '');
  const [icon, setIcon] = useState<CategoryIconId | null>(initial?.icon ?? null);
  const [saving, setSaving] = useState(false);
  const ready = name.trim().length > 0 && icon !== null && !saving;

  const submit = async () => {
    if (!ready || !icon) return;
    setSaving(true);
    try {
      await onSubmit({ name, nameEn, nameDe, icon });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <input type="text" aria-label={label} placeholder={label} value={value} maxLength={MAX_CATEGORY_NAME} onChange={(e) => set(e.target.value)} className={INPUT} />
  );

  return (
    <div className="space-y-3">
      {field(t('categoryNameHu'), name, setName)}
      <div className="grid grid-cols-2 gap-2">
        {field(t('categoryNameEn'), nameEn, setNameEn)}
        {field(t('categoryNameDe'), nameDe, setNameDe)}
      </div>
      <div role="radiogroup" aria-label={t('categoryIcon')} className="grid grid-cols-4 gap-2">
        {CATEGORY_ICON_IDS.map((id) => {
          const selected = icon === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(CATEGORY_ICON_LABELS[id])}
              onClick={() => setIcon(id)}
              className={`no-min-size h-12 rounded-xl grid place-items-center transition-colors ${
                selected ? 'bg-brand-600 text-white' : 'bg-white/6 text-label-secondary hover:bg-white/10'
              }`}
            >
              <GlyphIcon glyph={CATEGORY_ICON_GLYPHS[id]} className="w-6 h-6" />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl font-semibold bg-white/6 text-white">
            {t('cancel')}
          </button>
        )}
        <button type="button" onClick={submit} disabled={!ready} className="flex-1 py-3 rounded-xl font-semibold bg-brand-600 text-white disabled:opacity-50">
          {saving ? t('saving') : submitLabel}
        </button>
      </div>
    </div>
  );
}
