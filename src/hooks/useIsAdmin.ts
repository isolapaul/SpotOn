import { useUserStore } from '@/store/useUserStore';

// Admin UI flags (T26): the one source is useUserStore, driven by admins/{auth.uid} (T11a).
// UI only; authorization is enforced by the rules and callables. Primitive selector results
// keep the hooks zustand-5 safe (T31).

/** Whether the signed-in user is an admin. */
export function useIsAdmin(): boolean {
  return useUserStore((s) => s.isAdmin);
}

/** Whether the signed-in user is a super admin (`role: 'super'`). */
export function useIsSuperAdmin(): boolean {
  return useUserStore((s) => s.isSuperAdmin);
}
