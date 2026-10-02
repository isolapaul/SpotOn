'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useCategoryStore, type CategoryFields } from '@/store/useCategoryStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import GlyphIcon from '@/components/ui/GlyphIcon';
import { resolveCategory, type CustomCategory } from '@/lib/categories';
import CategoryForm from './CategoryForm';

function errorText(error: unknown): string | undefined {
  return (error as { message?: string } | undefined)?.message;
}

/**
 * Super admin (item 7): create categories, rename them or change their icon, and delete one no
 * spot uses (the server checks again, including waiting changes).
 */
export default function CategoryManager() {
  const t = useT();
  const showToast = useToastStore((s) => s.showToast);
  const { categories, createCategory, updateCategory, deleteCategory } = useCategoryStore();
  const spots = useSpotStore((s) => s.spots);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // The super admin's spots listener holds every spot, so this is the real use count.
  const uses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const spot of spots) counts.set(spot.category, (counts.get(spot.category) ?? 0) + 1);
    return counts;
  }, [spots]);
  const sorted = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  const create = async (fields: CategoryFields) => {
    try {
      await createCategory(fields);
      showToast(t('categoryAdded'), 'success');
      setFormKey((k) => k + 1);
    } catch (error) {
      showToast(errorText(error) || t('categoryAddError'), 'error');
    }
  };

  const save = async (id: string, fields: CategoryFields) => {
    try {
      await updateCategory(id, fields);
      showToast(t('categorySaved'), 'success');
      setEditing(null);
    } catch (error) {
      showToast(errorText(error) || t('genericError'), 'error');
    }
  };

  const remove = async (category: CustomCategory) => {
    try {
      await deleteCategory(category.id);
      showToast(t('categoryDeleted'), 'success');
    } catch (error) {
      showToast(errorText(error) === 'CATEGORY_IN_USE' ? t('categoryInUse') : t('genericError'), 'error');
    } finally {
      setConfirming(null);
    }
  };

  const row = (category: CustomCategory) => {
    const count = uses.get(category.id) ?? 0;
    if (editing === category.id) {
      return (
        <li key={category.id} className="rounded-xl bg-white/5 p-3">
          <CategoryForm
            initial={category}
            submitLabel={t('save')}
            onSubmit={(fields) => save(category.id, fields)}
            onCancel={() => setEditing(null)}
          />
        </li>
      );
    }
    return (
      <li key={category.id} className="rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full grid place-items-center bg-brand-600 text-white shrink-0">
            <GlyphIcon glyph={resolveCategory(category.id, categories).glyph} className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{category.name}</p>
            <p className="text-white/50 text-xs truncate">
              {[category.nameEn, category.nameDe].filter(Boolean).join(' · ')}
              {category.nameEn || category.nameDe ? ' · ' : ''}
              {t('categoryUsedBy', { count })}
            </p>
          </div>
          <button type="button" onClick={() => setEditing(category.id)} aria-label={`${t('edit')}: ${category.name}`} className="p-2 rounded-full text-white/70 hover:bg-white/10">
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(category.id)}
            disabled={count > 0}
            aria-label={`${t('delete')}: ${category.name}`}
            className="p-2 rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {confirming === category.id && (
          <div className="mt-3 flex items-center gap-2">
            <p className="flex-1 text-white/80 text-sm">{t('confirmDeleteCategory', { name: category.name })}</p>
            <button type="button" onClick={() => setConfirming(null)} className="px-3 py-2 rounded-lg bg-white/6 text-white text-sm">
              {t('cancel')}
            </button>
            <button type="button" onClick={() => remove(category)} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm font-semibold">
              {t('delete')}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="rounded-[18px] bg-surface-1 p-5 space-y-4">
      <div>
        <h3 className="text-white font-bold text-lg">{t('manageCategories')}</h3>
        <p className="text-white/50 text-xs mt-0.5">{t('manageCategoriesHint')}</p>
      </div>
      <CategoryForm key={formKey} submitLabel={t('addCategory')} onSubmit={create} />
      {sorted.length > 0 ? (
        <ul className="space-y-2">{sorted.map(row)}</ul>
      ) : (
        <p className="text-white/40 text-center py-2 text-sm">{t('noCategoriesYet')}</p>
      )}
    </div>
  );
}
