'use client';

import { useT } from '@/hooks/useT';

interface ProfileStatsProps {
  spotsCount: number;
  favoritesCount: number;
  followers: number;
  following: number;
}

/** The own figures side by side (design phase 3; item 8: followers and following, counts only). */
export default function ProfileStats({ spotsCount, favoritesCount, followers, following }: Readonly<ProfileStatsProps>) {
  const t = useT();
  const stat = (value: number, label: string) => (
    <div className="flex-1 flex flex-col items-center py-3 min-w-0">
      <span className="text-[20px] font-bold leading-tight text-label tabular-nums">{value}</span>
      <span className="text-[12px] text-label-secondary truncate max-w-full px-1">{label}</span>
    </div>
  );
  return (
    <div className="w-full max-w-md flex rounded-[18px] bg-surface-1 divide-x divide-white/[.06]">
      {stat(spotsCount, t('spots'))}
      {stat(favoritesCount, t('favorites'))}
      {stat(followers, t('followers'))}
      {stat(following, t('followingCount'))}
    </div>
  );
}
