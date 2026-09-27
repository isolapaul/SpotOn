'use client';

import { useT } from '@/hooks/useT';

interface ProfileStatsProps {
  spotsCount: number;
  favoritesCount: number;
}

export default function ProfileStats({ spotsCount, favoritesCount }: Readonly<ProfileStatsProps>) {
  const t = useT();
  return (
    <div className="flex gap-4 mt-0">
      <div>
        <span className="text-white font-bold">{spotsCount}</span>
        <span className="text-white/60 text-xs ml-1">{t('spots')}</span>
      </div>
      <div>
        <span className="text-white font-bold">{favoritesCount}</span>
        <span className="text-white/60 text-xs ml-1">{t('favorites')}</span>
      </div>
    </div>
  );
}
