'use client';

import { TrendingUp, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { getLevelInfo, getLevelProgress, getLevelThreshold, type LevelInfo } from '@/lib/levelUtils';
import type { TranslationKey } from '@/lib/translations';

type PerkLevel = 1 | 2 | 3 | 4 | 5;

interface Perk {
  emoji: string | null;
  /** Rendered joined by a space (e.g. `highlightOneSpot goldAppearance`). */
  keys: TranslationKey[];
  variant?: 'muted';
}

/** The benefits listed per level in the "All levels" table. */
const LEVEL_PERKS: Readonly<Record<PerkLevel, readonly Perk[]>> = {
  1: [{ emoji: null, keys: ['noSpecialBenefits'], variant: 'muted' }],
  2: [{ emoji: '🥈', keys: ['silverName'] }],
  3: [
    { emoji: '🥇', keys: ['goldName'] },
    { emoji: '✨', keys: ['highlightOneSpot', 'goldAppearance'] },
  ],
  4: [
    { emoji: '🥇', keys: ['goldName'] },
    { emoji: '✨', keys: ['highlightTwoSpots', 'goldAppearance'] },
    { emoji: '🎨', keys: ['useCustomIcons'] },
  ],
  5: [
    { emoji: '💎', keys: ['diamondNameAndBadge'] },
    { emoji: '✨', keys: ['highlightTwoSpots', 'goldAppearance'] },
    { emoji: '🎨', keys: ['useCustomIcons'] },
    { emoji: '🌈', keys: ['customizeNameStyle'] },
  ],
};

const LEVELS: readonly PerkLevel[] = [1, 2, 3, 4, 5];

/** Each level's info, computed from the spots it requires (the per-level table). */
const LEVEL_TABLE = LEVELS.map((level) => ({ level, info: getLevelInfo(getLevelThreshold(level)) }));

interface LevelInfoModalProps {
  /** The user's current level (computed once in ProfilePanel). */
  levelInfo: LevelInfo;
  spotsCount: number;
  onClose: () => void;
}

/** The level system: current level with progress, all levels with their benefits. */
export default function LevelInfoModal({ levelInfo, spotsCount, onClose }: Readonly<LevelInfoModalProps>) {
  const t = useT();
  const progress = getLevelProgress(spotsCount);

  return (
    <div className="fixed inset-x-0 top-0 h-app z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close level info"
      />

      <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto glass-card p-6 rounded-2xl animate-scale-in">
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
            <div className="text-5xl">{levelInfo.icon}</div>
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
              {spotsCount} / {levelInfo.spotsForNext || levelInfo.spotsRequired} {t('spots')}
            </span>
            <span className={`font-bold ${levelInfo.textColor}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
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
                  <div className="text-4xl">{info.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`text-xl font-bold ${isUnlocked ? info.textColor : 'text-white/60'}`}>
                        {level}. {t(info.nameKey)}
                      </h4>
                      {isUnlocked && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
                          {t('unlocked')} ✓
                        </span>
                      )}
                    </div>

                    <p className="text-white/70 text-sm mb-3">
                      {t('requiredSpots')}: <span className="font-bold">{info.spotsRequired}</span>
                    </p>

                    {/* Perks */}
                    <div className="space-y-2">
                      <p className="text-white/90 text-sm font-semibold">{t('benefits')}:</p>
                      <ul className="space-y-1 text-white/70 text-sm">
                        {LEVEL_PERKS[level].map((perk) => {
                          const text = perk.keys.map((key) => t(key)).join(' ');
                          return perk.variant === 'muted' ? (
                            <li key={perk.keys.join(' ')} className="text-white/50 italic">{text}</li>
                          ) : (
                            <li key={perk.keys.join(' ')} className="flex items-center gap-2">
                              {perk.emoji && <span className="text-base">{perk.emoji}</span>}
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
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary-500/20 to-purple-500/20 border border-primary-500/30">
          <p className="text-white/90 text-sm text-center">
            {t('keepExploringMessage')}
          </p>
        </div>
      </div>
    </div>
  );
}
