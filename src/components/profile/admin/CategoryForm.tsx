'use client';

import { useState } from 'react';
import GlyphIcon from '@/components/ui/GlyphIcon';
import { useT } from '@/hooks/useT';
import { MAX_CATEGORY_NAME } from '@/lib/categories';
import { CATEGORY_ICON_GLYPHS, CATEGORY_ICON_IDS, CATEGORY_ICON_LABELS, type CategoryIconId } from '@/lib/categoryIcons';

interface CategoryFormProps {
  initial?: { name: string; icon: CategoryIconId | null };
  submitLabel: string;
  onSubmit: (name: string, icon: CategoryIconId) => Promise<void>;
  onCancel?: () => void;
}

/** A category's name and icon (one of the hand-drawn set), for creating and editing (item 7). */
export default function CategoryForm({ initial, submitLabel, onSubmit, onCancel }: Readonly<CategoryFormProps>) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconId | null>(initial?.icon ?? null);
  const [saving, setSaving] = useState(false);
  const ready = name.trim().length > 0 && icon !== null && !saving;

  const submit = async () => {
    if (!ready || !icon) return;
    setSaving(true);
    try {
      await onSubmit(name, icon);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        aria-label={t('categoryName')}
        placeholder={t('categoryName')}
        value={name}
        maxLength={MAX_CATEGORY_NAME}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
      />
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
                selected ? 'bg-brand-600 text-white' : 'bg-white/[.06] text-label-secondary hover:bg-white/10'
              }`}
            >
              <GlyphIcon glyph={CATEGORY_ICON_GLYPHS[id]} className="w-6 h-6" />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl font-semibold bg-white/[.06] text-white">
            {t('cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="flex-1 py-3 rounded-xl font-semibold bg-brand-600 text-white disabled:opacity-50"
        >
          {saving ? t('saving') : submitLabel}
        </button>
      </div>
    </div>
  );
}
