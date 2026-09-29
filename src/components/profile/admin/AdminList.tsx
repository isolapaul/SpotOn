'use client';

import { Shield, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useUserStore, userErrorKey } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

/** Super admin: the current admins with a revoke button each. */
export default function AdminList() {
  const adminUsers = useUserStore((s) => s.adminUsers);
  const removeAdmin = useUserStore((s) => s.removeAdmin);
  const { showToast } = useToastStore();
  const t = useT();

  const handleRemoveAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(t('confirmRemoveAdmin', { name: adminName }))) return;

    try {
      await removeAdmin(adminId);
      showToast(`${adminName} ${t('removedFromAdmins')}`, 'success');
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'adminRemoveError'), 'error');
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-amber-400" />
        <h3 className="text-white font-bold text-lg">{t('currentAdmins')}</h3>
        <span className="text-white/60 text-sm ml-auto">{adminUsers.length} {t('adminCount')}</span>
      </div>

      <div className="space-y-3">
        {adminUsers.length === 0 ? (
          <p className="text-white/40 text-center py-4">{t('noAdminsYet')}</p>
        ) : (
          adminUsers.map((admin) => (
            <div key={admin.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              {admin.photoURL ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/30 flex-shrink-0">
                  <Image
                    src={admin.photoURL}
                    alt={admin.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/30 flex-shrink-0 bg-brand-600 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">{(admin.name?.charAt(0) || 'U').toUpperCase()}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-semibold">{admin.name}</h4>
                  <Shield className="w-3 h-3 text-amber-400" />
                </div>
                <p className="text-white/60 text-sm truncate">{admin.email}</p>
              </div>

              <button
                onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30
                  hover:bg-red-500/30 active:scale-95 transition-all duration-200 flex-shrink-0"
                aria-label="Remove admin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
