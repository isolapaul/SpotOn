'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { Category } from '@/hooks/useCategories';

interface CategoryManagerProps {
  categories: Category[];
  addCategory: (name: string, icon: string) => Promise<void>;
  isAdding: boolean;
}

/** Super admin: add a category and list the existing ones (listener lives in ProfilePanel's useCategories). */
export default function CategoryManager({ categories, addCategory, isAdding }: Readonly<CategoryManagerProps>) {
  const { showToast } = useToastStore();
  const t = useT();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryIcon.trim()) return;
    try {
      await addCategory(newCategoryName, newCategoryIcon);
      showToast(t('categoryAdded'), 'success');
      setNewCategoryName('');
      setNewCategoryIcon('');
    } catch (error) {
      showToast((error as { message?: string } | undefined)?.message || t('categoryAddError'), 'error');
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-green-400" />
        <h3 className="text-white font-bold text-lg">{t('manageCategories')}</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('categoryIcon')}
            value={newCategoryIcon}
            onChange={(e) => setNewCategoryIcon(e.target.value)}
            className="w-16 px-3 py-3 bg-white/5 border border-white/10 rounded-xl
              text-white text-center text-xl placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
            maxLength={4}
          />
          <input
            type="text"
            placeholder={t('categoryName')}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-white placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
          />
        </div>

        <button
          onClick={handleAddCategory}
          disabled={isAdding || !newCategoryName.trim() || !newCategoryIcon.trim()}
          className="w-full py-3 px-4 rounded-xl font-semibold
            bg-green-500/20 text-green-400 border border-green-500/30
            hover:bg-green-500/30 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? t('saving') : t('addCategory')}</span>
        </button>

        {/* Existing Dynamic Categories */}
        {categories.length > 0 ? (
          <div className="space-y-2 mt-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <span className="text-white font-medium">{cat.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-center py-2 text-sm">{t('noCategoriesYet')}</p>
        )}
      </div>
    </div>
  );
}
