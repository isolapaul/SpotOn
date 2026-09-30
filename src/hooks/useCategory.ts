import { useCallback, useMemo } from 'react';
import { useCategoryStore } from '@/store/useCategoryStore';
import { categoryOptions, resolveCategory, type CategoryOption } from '@/lib/categories';
import { useT } from './useT';

/** Every category in UI order (built-ins, the super admin's ones, 'other'). */
export function useCategoryOptions(): CategoryOption[] {
  const customs = useCategoryStore((s) => s.categories);
  return useMemo(() => categoryOptions(customs), [customs]);
}

/** One category by id (unknown ids show as 'other'). */
export function useCategory(id: string | undefined): CategoryOption {
  const customs = useCategoryStore((s) => s.categories);
  return useMemo(() => resolveCategory(id, customs), [id, customs]);
}

/** The label text of an option. */
export function useCategoryText(): (option: CategoryOption) => string {
  const t = useT();
  return useCallback((option) => ('key' in option.label ? t(option.label.key) : option.label.text), [t]);
}

/** A category's label by id. */
export function useCategoryLabel(): (id: string | undefined) => string {
  const customs = useCategoryStore((s) => s.categories);
  const text = useCategoryText();
  return useCallback((id) => text(resolveCategory(id, customs)), [customs, text]);
}
