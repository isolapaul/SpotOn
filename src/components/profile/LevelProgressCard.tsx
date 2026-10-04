'use client';

import { ChevronRight } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { getLevelProgress, getXpRemainingText, type LevelInfo } from '@/lib/levelUtils';
import LevelBadge from '@/components/ui/LevelBadge';
import PerkIcon from '@/components/ui/PerkIcon';

interface LevelProgressCardProps {
  levelInfo: LevelInfo;
  xp: number;
  /** Opens the level info (the card is the profile's one level element, so it is a button). */
  onOpen: () => void;
}

/** Current level, progress to the next one and a perks preview (level 3+); a tap opens the level info. */
export default function LevelProgressCard({ levelInfo, xp, onOpen }: Readonly<LevelProgressCardProps>) {
  const t = useT();
  const progress = getLevelProgress(xp, levelInfo);
  const remaining = getXpRemainingText(xp, levelInfo, t);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`no-min-size block w-full max-w-md px-4 py-3 rounded-xl text-left ${levelInfo.bgColor} border ${levelInfo.borderColor}
        touch-manipulation transition-transform duration-150 active:scale-[.98]`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <LevelBadge level={levelInfo.level} size={30} />
          <div>
            <p className={`${levelInfo.textColor} font-bold text-sm`}>
              {t(levelInfo.nameKey)} · {t('levelLabel', { level: levelInfo.level })}
            </p>
            <p className="text-white/60 text-xs">
              {t('xpTotal', { xp })} · {remaining}
            </p>
          </div>
        </div>
        <span className={`flex items-center gap-1 ${levelInfo.textColor} font-bold text-lg`}>
          {progress.toFixed(0)}%
          <ChevronRight className="w-4 h-4 opacity-70" aria-hidden="true" />
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
    </button>
  );
}
