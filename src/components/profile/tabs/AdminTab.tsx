'use client';

import type { Category } from '@/hooks/useCategories';
import AdminSearch from '../admin/AdminSearch';
import AdminList from '../admin/AdminList';
import CategoryManager from '../admin/CategoryManager';

interface AdminTabProps {
  categories: Category[];
  addCategory: (name: string, icon: string) => Promise<void>;
  isAdding: boolean;
}

/** Super admin: grant admin, the current admins, category management. */
export default function AdminTab({ categories, addCategory, isAdding }: Readonly<AdminTabProps>) {
  return (
    <div className="space-y-6">
      {/* Add Admin Section */}
      <AdminSearch />

      {/* Current Admins List */}
      <AdminList />

      {/* Category Management Section */}
      <CategoryManager categories={categories} addCategory={addCategory} isAdding={isAdding} />
    </div>
  );
}
