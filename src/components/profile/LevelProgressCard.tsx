'use client';

import { useT } from '@/hooks/useT';
import { getLevelProgress, getSpotsRemainingText, type LevelInfo } from '@/lib/levelUtils';
import LevelBadge from '@/components/ui/LevelBadge';
import PerkIcon from '@/components/ui/PerkIcon';

interface LevelProgressCardProps {
  levelInfo: LevelInfo;
  spotsCount: number;
}

/** Current level, progress to the next one and a perks preview (level 3+). */
export default function LevelProgressCard({ levelInfo, spotsCount }: Readonly<LevelProgressCardProps>) {
  const t = useT();
  const progress = getLevelProgress(spotsCount);
  const spotsRemaining = getSpotsRemainingText(spotsCount, levelInfo.spotsForNext, t);

  return (
    <div className={`w-full max-w-md px-4 py-3 rounded-xl ${levelInfo.bgColor} border ${levelInfo.borderColor} transition-all mb-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <LevelBadge level={levelInfo.level} size={30} />
          <div>
            <p className={`${levelInfo.textColor} font-bold text-sm`}>
              {t(levelInfo.nameKey)}
            </p>
            <p className="text-white/60 text-xs">
              {spotsRemaining}
            </p>
          </div>
        </div>
        <span className={`${levelInfo.textColor} font-bold text-lg`}>
          {progress.toFixed(0)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full rounded-full ${levelInfo.progressBarClass} transition-[width] duration-700 ease-out-quint`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Perks Preview */}
      {levelInfo.level >= 3 && (
        <div className="mt-2 flex flex-wrap gap-1 text-xs text-white/70">
          {levelInfo.maxHighlights > 0 && (
            <span className="inline-flex items-center gap-1"><PerkIcon icon="highlight" className="w-3.5 h-3.5" />{t('perkHighlights', { count: levelInfo.maxHighlights })}</span>
          )}
          {levelInfo.canCustomizeIcon && (
            <span className="inline-flex items-center gap-1"><PerkIcon icon="icons" className="w-3.5 h-3.5" />{t('perkIcons')}</span>
          )}
          {levelInfo.canCustomizeName && (
            <span className="inline-flex items-center gap-1"><PerkIcon icon="style" className="w-3.5 h-3.5" />{t('perkCustomization')}</span>
          )}
        </div>
      )}
    </div>
  );
}
