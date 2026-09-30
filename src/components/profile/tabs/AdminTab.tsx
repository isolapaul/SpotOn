'use client';

import AdminSearch from '../admin/AdminSearch';
import AdminList from '../admin/AdminList';
import CategoryManager from '../admin/CategoryManager';

/** Super admin: grant admin, the current admins, category management. */
export default function AdminTab() {
  return (
    <div className="space-y-6">
      <AdminSearch />
      <AdminList />
      <CategoryManager />
    </div>
  );
}
