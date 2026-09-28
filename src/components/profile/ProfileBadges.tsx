'use client';

import { Shield } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { LevelInfo } from '@/lib/levelUtils';

interface ProfileBadgesProps {
  isAdmin: boolean;
  levelInfo: LevelInfo;
  onOpenLevelInfo: () => void;
}

/** Admin shield and the level pill (opens the level info modal). */
export default function ProfileBadges({ isAdmin, levelInfo, onOpenLevelInfo }: Readonly<ProfileBadgesProps>) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
      {isAdmin && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Shield className="w-4 h-4 text-amber-400" />
        </div>
      )}
      <button
        onClick={onOpenLevelInfo}
        className={`flex items-center gap-1 px-3 py-1 rounded-full ${levelInfo.bgColor} border ${levelInfo.borderColor} hover:opacity-80 transition-all active:scale-95`}
      >
        <span className="text-lg">{levelInfo.icon}</span>
        <span className={`${levelInfo.textColor} text-xs font-bold`}>
          {t('levelLabel', { level: levelInfo.level })}
        </span>
      </button>
    </div>
  );
}
