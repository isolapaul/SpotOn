'use client';

import { Bell, BellOff } from 'lucide-react';
import { useT } from '@/hooks/useT';

interface NotificationsSectionProps {
  isPermissionGranted: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

/** Settings › push notifications: turn them on, or open the per-type settings. */
export default function NotificationsSection({
  isPermissionGranted,
  isLoading,
  onToggle,
  onOpenSettings,
}: Readonly<NotificationsSectionProps>) {
  const t = useT();

  return (
    <div className="rounded-[18px] bg-surface-1 p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
        {isPermissionGranted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        {t('notificationsHeader')}
      </h3>
      
      <button
        onClick={onToggle}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
          isPermissionGranted
            ? 'bg-green-600/20 text-green-400 border border-green-500/30'
            : 'bg-brand-600 text-white active:bg-brand-700'
        }`}
      >
        {isPermissionGranted ? (
          <>
            <Bell className="w-5 h-5" />
            {t('enabled')}
          </>
        ) : (
          <>
            <BellOff className="w-5 h-5" />
            {t('enableAction')}
          </>
        )}
      </button>

      <button
        onClick={onOpenSettings}
        disabled={isLoading}
        className="mt-3 w-full py-2.5 px-4 rounded-xl bg-white/8 text-label font-medium text-sm
          active:bg-white/12 transition-colors disabled:opacity-50"
      >
        {t('notificationSettingsButton')}
      </button>
    </div>
  );
}
