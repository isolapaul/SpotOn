// Pure admins/{uid} doc → store AdminUser mapping (super admin's admin list). Admin docs store the
// display name as `username` (addAdmin callable, scripts/bootstrap-super-admin.ts, the pre-T11a
// client); very old docs may carry `name` instead, and some none at all.

export interface AdminUser {
  id: string;
  email: string;
  /** Display name: `username`, else the legacy `name`, else the email ('' if none of them). */
  name: string;
  photoURL?: string;
  addedAt: unknown;
  addedBy: string;
  role?: string;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function mapAdminDoc(id: string, data: Record<string, unknown>): AdminUser {
  const email = str(data.email);
  const admin: AdminUser = {
    id,
    email,
    name: str(data.username) || str(data.name) || email,
    addedAt: data.addedAt,
    addedBy: str(data.addedBy),
  };
  if (typeof data.photoURL === 'string') admin.photoURL = data.photoURL;
  if (typeof data.role === 'string') admin.role = data.role;
  return admin;
}
