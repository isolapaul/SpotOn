'use client';

import { Clock, Heart, MapPin, Shield } from 'lucide-react';
import { useT } from '@/hooks/useT';

export type ProfileTab = 'my-spots' | 'favorites' | 'pending' | 'admin';

const TAB_BASE = 'flex-shrink-0 px-6 py-4 text-center font-medium transition-all whitespace-nowrap';
const TAB_INACTIVE = 'text-white/60';
const TAB_ACTIVE = {
  primary: 'text-white border-b-2 border-primary-500 bg-white/5',
  amber: 'text-white border-b-2 border-amber-500 bg-white/5',
  purple: 'text-white border-b-2 border-purple-500 bg-white/5',
} as const;

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  pendingCount: number;
}

export default function ProfileTabs({ active, onChange, isAdmin, isSuperAdmin, pendingCount }: Readonly<ProfileTabsProps>) {
  const t = useT();
  const tabClass = (tab: ProfileTab, tone: keyof typeof TAB_ACTIVE) =>
    `${TAB_BASE} ${active === tab ? TAB_ACTIVE[tone] : TAB_INACTIVE}`;

  return (
    <div className="flex-shrink-0 flex overflow-x-auto border-b border-white/10 scrollbar-hide">
      <button onClick={() => onChange('my-spots')} className={tabClass('my-spots', 'primary')}>
        <MapPin className="w-4 h-4 inline mr-2" />
        {t('mySpots')}
      </button>
      <button onClick={() => onChange('favorites')} className={tabClass('favorites', 'primary')}>
        <Heart className="w-4 h-4 inline mr-2" />
        {t('favorites')}
      </button>

      {/* Pending Tab - Only for Admins */}
      {isAdmin && (
        <button onClick={() => onChange('pending')} className={tabClass('pending', 'amber')}>
          <Clock className="w-4 h-4 inline mr-2" />
          <span className="relative">
            {t('pendingApproval')}
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-5 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </span>
        </button>
      )}

      {/* Admin Panel Tab - Only for Super Admin */}
      {isSuperAdmin && (
        <button onClick={() => onChange('admin')} className={tabClass('admin', 'purple')}>
          <Shield className="w-4 h-4 inline mr-2" />
          <span>{t('adminCount')}</span>
        </button>
      )}
    </div>
  );
}
