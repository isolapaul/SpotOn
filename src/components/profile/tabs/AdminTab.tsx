'use client';

import AdminSearch from '../admin/AdminSearch';
import AdminList from '../admin/AdminList';
import CategoryManager from '../admin/CategoryManager';
import TelemetryOverview from '../admin/TelemetryOverview';

/** Super admin: grant admin, the current admins, category management, the anonymous usage counters and app errors. */
export default function AdminTab() {
  return (
    <div className="space-y-6">
      <AdminSearch />
      <AdminList />
      <CategoryManager />
      <TelemetryOverview />
    </div>
  );
}
