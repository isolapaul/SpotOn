'use client';

import { Clock, Heart, MapPin, Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/hooks/useT';

export type ProfileTab = 'my-spots' | 'favorites' | 'pending' | 'admin';

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  pendingCount: number;
}

/** The profile sections as an iOS segmented control (design phase 3). */
export default function ProfileTabs({ active, onChange, isAdmin, isSuperAdmin, pendingCount }: Readonly<ProfileTabsProps>) {
  const t = useT();
  const tab = (id: ProfileTab, icon: ReactNode, label: ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={active === id}
      className={`no-min-size relative flex-1 min-w-0 h-9 px-2 rounded-r1 flex items-center justify-center gap-1.5 text-[13px] font-semibold
        whitespace-nowrap touch-manipulation transition-colors duration-200 ${
          active === id ? 'bg-white/16 text-label shadow-xs' : 'text-label-secondary'
        }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="shrink-0 px-5 mb-4">
      <div className="flex gap-0.5 p-0.5 rounded-[10px] bg-white/8 overflow-x-auto scrollbar-none">
        {tab('my-spots', <MapPin className="w-3.5 h-3.5" aria-hidden="true" />, t('mySpots'))}
        {tab('favorites', <Heart className="w-3.5 h-3.5" aria-hidden="true" />, t('favorites'))}
        {isAdmin &&
          tab(
            'pending',
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
            <>
              <span className="truncate">{t('pendingApproval')}</span>
              {pendingCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-warn-500 text-warn-ink text-[11px] font-bold leading-[18px] tabular-nums">
                  {pendingCount}
                </span>
              )}
            </>,
          )}
        {isSuperAdmin && tab('admin', <Shield className="w-3.5 h-3.5" aria-hidden="true" />, t('adminCount'))}
      </div>
    </div>
  );
}
