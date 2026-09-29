'use client';

import { useT } from '@/hooks/useT';

interface ProfileStatsProps {
  spotsCount: number;
  favoritesCount: number;
}

/** Two figures side by side (design phase 3). */
export default function ProfileStats({ spotsCount, favoritesCount }: Readonly<ProfileStatsProps>) {
  const t = useT();
  const stat = (value: number, label: string) => (
    <div className="flex-1 flex flex-col items-center py-3">
      <span className="text-[22px] font-bold leading-tight text-label tabular-nums">{value}</span>
      <span className="text-[13px] text-label-secondary">{label}</span>
    </div>
  );
  return (
    <div className="w-full max-w-md flex rounded-[18px] bg-surface-1 divide-x divide-white/[.06]">
      {stat(spotsCount, t('spots'))}
      {stat(favoritesCount, t('favorites'))}
    </div>
  );
}
