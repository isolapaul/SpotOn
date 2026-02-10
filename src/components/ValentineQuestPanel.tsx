'use client';

import { useState, useEffect } from 'react';
import { Heart, Gift, X } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';

const QUEST_START = new Date('2026-02-10').getTime();
const QUEST_END = new Date('2026-02-24').getTime();
const QUEST_REQUIREMENT = 5;

export default function ValentineQuestPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState(false);
  const { user } = useUserStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();

  // Check if quest is active
  const now = Date.now();
  const isQuestActive = now >= QUEST_START && now < QUEST_END;

  // Get quest progress from user data
  const questProgress = user?.questProgress?.valentine2026?.count ?? 0;
  const questCompleted = questProgress >= QUEST_REQUIREMENT;
  const rewardsClaimed = user?.questRewards?.valentine2026?.mapThemeUnlocked;

  // Show panel if quest is active and not completed
  useEffect(() => {
    if (!user || !isQuestActive) {
      setIsVisible(false);
      return;
    }
    
    // Show if not yet completed
    if (!questCompleted) {
      setIsVisible(true);
    }
  }, [user, isQuestActive, questCompleted]);

  const handleClaimRewards = async () => {
    if (!user || !questCompleted) return;

    try {
      setClaimedRewards(true);
      // The actual reward claiming is handled by Cloud Functions
      // This is just for UI feedback
      showToast(t('valentineQuestCompleted'), 'success');
      setTimeout(() => {
        setIsVisible(false);
      }, 1500);
    } catch (error) {
      setClaimedRewards(false);
      showToast('Failed to claim rewards', 'error');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || !user) return null;

  // Calculate remaining days
  const daysRemaining = Math.ceil((QUEST_END - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 
      max-w-sm w-[calc(100%-2rem)] animate-fade-in">
      <div className="glass-card p-6 space-y-4 shadow-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-slate-900/80 to-rose-500/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Heart className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="text-white font-bold text-lg mb-1">
                {t('valentineQuestTitle')}
              </h3>
              <p className="text-white/70 text-xs">
                {t('valentineQuestSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 -m-2 rounded-full hover:bg-white/10 transition-colors touch-manipulation"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/50 hover:text-white" />
          </button>
        </div>

        {/* Duration */}
        <div className="text-xs text-white/50 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
          ⏰ {daysRemaining > 0 ? `${daysRemaining} ${t('daysRemaining')}` : t('questEnded')}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">
              {t('valentineQuestProgress')
                .replace('{count}', String(questProgress))
                .replace('{total}', String(QUEST_REQUIREMENT))}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              questCompleted
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {questCompleted ? '✓ Done' : 'In Progress'}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
              style={{ width: `${(questProgress / QUEST_REQUIREMENT) * 100}%` }}
            />
          </div>
        </div>

        {/* Rewards Preview */}
        {questCompleted && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <h4 className="text-white font-semibold text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-yellow-400" />
              {t('valentineQuestRewards')}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/80 text-xs ps-6">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                {t('valentineQuestRewardTheme')}
              </div>
              <div className="flex items-center gap-2 text-white/80 text-xs ps-6">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                {t('valentineQuestRewardHighlight')}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {questCompleted && !rewardsClaimed && (
          <button
            onClick={handleClaimRewards}
            disabled={claimedRewards}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-rose-500 
              text-white shadow-lg shadow-pink-500/20 hover:shadow-xl hover:shadow-pink-500/30
              active:scale-98 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 touch-manipulation"
          >
            <Gift className="w-4 h-4" />
            <span>{claimedRewards ? 'Claiming...' : 'Claim Rewards'}</span>
          </button>
        )}

        {rewardsClaimed && (
          <div className="w-full py-3 rounded-xl text-center font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            ✓ {t('valentineQuestCompleted')}
          </div>
        )}
      </div>
    </div>
  );
}
