'use client';

import { Check, TrendingUp, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { getLevelInfo, getLevelProgress, XP_REWARDS, type LevelInfo } from '@/lib/levelUtils';
import type { TranslationKey } from '@/lib/translations';
import { LEVEL_PERKS, type LevelNumber } from '@/lib/levelTheme';
import LevelBadge from '@/components/ui/LevelBadge';
import PerkIcon from '@/components/ui/PerkIcon';

const LEVELS: readonly LevelNumber[] = [1, 2, 3, 4, 5];

/** Each level's info (the per-level table). */
const LEVEL_TABLE = LEVELS.map((level) => ({ level, info: getLevelInfo(level) }));

/** How XP is earned (item 5). */
const XP_WAYS: readonly { key: TranslationKey; xp: number }[] = [
  { key: 'xpForApprovedSpot', xp: XP_REWARDS.approvedSpot },
  { key: 'xpForApprovedPhoto', xp: XP_REWARDS.approvedPhoto },
  { key: 'xpForReview', xp: XP_REWARDS.review },
];

interface LevelInfoModalProps {
  /** The user's current level (computed once in ProfilePanel). */
  levelInfo: LevelInfo;
  xp: number;
  onClose: () => void;
}

/** The level system: current level with progress, all levels with their benefits. */
export default function LevelInfoModal({ levelInfo, xp, onClose }: Readonly<LevelInfoModalProps>) {
  const t = useT();
  const progress = getLevelProgress(xp, levelInfo);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close level info"
      />

      <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-surface-2 ring-1 ring-white/10 shadow-sheet p-6 rounded-[28px] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-400" />
            {t('levelSystem')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Current Level */}
        <div className={`p-6 rounded-xl ${levelInfo.bgColor} border-2 ${levelInfo.borderColor} mb-6`}>
          <div className="flex items-center gap-4 mb-4">
            <LevelBadge level={levelInfo.level} size={64} className="flex-shrink-0 drop-shadow-lg" />
            <div className="flex-1">
              <h3 className={`text-2xl font-bold ${levelInfo.textColor}`}>{t(levelInfo.nameKey)}</h3>
              <p className="text-white/80 text-sm">{t('currentLevel')}</p>
            </div>
          </div>

          <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden mb-2">
            <div
              className={`absolute top-0 left-0 h-full ${levelInfo.progressBarClass} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80">
              {xp} / {levelInfo.xpForNext ?? levelInfo.xpRequired} XP
            </span>
            <span className={`font-bold ${levelInfo.textColor}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* How XP is earned */}
        <div className="mb-6 rounded-xl bg-white/5 border border-white/10 p-5">
          <h3 className="text-lg font-bold text-white mb-3">{t('howToEarnXp')}</h3>
          <ul className="divide-y divide-white/10">
            {XP_WAYS.map(({ key, xp: points }) => (
              <li key={key} className="flex items-center justify-between py-2 text-sm">
                <span className="text-white/80">{t(key)}</span>
                <span className="font-semibold text-white tabular-nums">+{points} XP</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-white/50 text-xs">{t('xpRulesNote')}</p>
        </div>

        {/* All Levels */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white mb-4">{t('allLevels')}</h3>

          {LEVEL_TABLE.map(({ level, info }) => {
            const isUnlocked = level <= levelInfo.level;

            return (
              <div
                key={level}
                className={`p-5 rounded-xl border-2 transition-all ${
                  isUnlocked
                    ? `${info.bgColor} ${info.borderColor}`
                    : 'bg-white/5 border-white/10 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  <LevelBadge level={level} size={48} className={`flex-shrink-0 ${isUnlocked ? '' : 'grayscale opacity-70'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`text-xl font-bold ${isUnlocked ? info.textColor : 'text-white/60'}`}>
                        {level}. {t(info.nameKey)}
                      </h4>
                      {isUnlocked && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
                          {t('unlocked')}
                          <Check className="w-3 h-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    <p className="text-white/70 text-sm mb-3">
                      {t('requiredXp')}: <span className="font-bold">{info.xpRequired} XP</span>
                    </p>

                    {/* Perks */}
                    <div className="space-y-2">
                      <p className="text-white/90 text-sm font-semibold">{t('benefits')}:</p>
                      <ul className="space-y-1 text-white/70 text-sm">
                        {LEVEL_PERKS[level].map((perk) => {
                          const text = perk.keys.map((key) => t(key)).join(' ');
                          return perk.muted ? (
                            <li key={perk.keys.join(' ')} className="text-white/50 italic">{text}</li>
                          ) : (
                            <li key={perk.keys.join(' ')} className="flex items-center gap-2">
                              {perk.icon && <PerkIcon icon={perk.icon} className={`w-4 h-4 flex-shrink-0 ${info.textColor}`} />}
                              {text}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Motivational Message */}
        <div className="mt-6 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <p className="text-white/90 text-sm text-center">
            {t('keepExploringMessage')}
          </p>
        </div>
      </div>
    </div>
  );
}
