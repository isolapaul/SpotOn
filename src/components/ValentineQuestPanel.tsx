'use client';

import { useState, useEffect } from 'react';
import { Heart, Gift, X, Clock, Sparkles } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';
import { useQuestProgress, QUEST_END, QUEST_REQUIREMENT, isQuestActive } from '@/hooks/useQuestProgress';
import { useUiStore } from '@/store/useUiStore';

interface ValentineQuestPanelProps {
  hidden?: boolean;
}

export default function ValentineQuestPanel({ hidden = false }: Readonly<ValentineQuestPanelProps>) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState(false);
  const { user } = useUserStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();
  const { notificationPromptVisible } = useUiStore();

  // Get live quest progress from Firestore query
  const { count: questProgress, isLoading, isCompleted: questCompleted } = useQuestProgress();
  
  // Check if quest is active
  const questActive = isQuestActive();
  const rewardsClaimed = user?.questRewards?.valentine2026?.mapThemeUnlocked;

  // Show panel if quest is active
  useEffect(() => {
    if (!user || !questActive || isLoading) {
      setIsVisible(false);
      return;
    }
    
    // Show if quest is active (even if completed, so they can claim)
    if (!rewardsClaimed) {
      setIsVisible(true);
    }
  }, [user, questActive, rewardsClaimed, isLoading]);

  const handleClaimRewards = async () => {
    if (!user || !questCompleted) return;

    try {
      setClaimedRewards(true);
      // The actual reward claiming is handled by Cloud Functions
      // This is just for UI feedback
      showToast(t('valentineQuestCompleted'), 'success');
      setTimeout(() => {
        setIsVisible(false);
        setIsExpanded(false);
      }, 1500);
    } catch (error) {
      setClaimedRewards(false);
      console.error('Error claiming rewards:', error);
      showToast(t('claimError'), 'error');
      throw error;
    }
  };

  const handlePillClick = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  // If explicitly hidden or notification prompt is visible, don't render
  if (!isVisible || !user || hidden || notificationPromptVisible) return null;

  // Calculate remaining days
  const now = Date.now();
  const daysRemaining = Math.ceil((QUEST_END.getTime() - now) / (1000 * 60 * 60 * 24));
  const progressPercent = (questProgress / QUEST_REQUIREMENT) * 100;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT PILL VIEW (Default State)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isExpanded) {
    return (
      <button
        onClick={handlePillClick}
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-2.5 px-4 py-2.5
          bg-pink-500/15 backdrop-blur-xl
          border border-pink-300/20
          rounded-full shadow-lg shadow-pink-500/10
          cursor-pointer select-none
          active:scale-95 hover:bg-pink-500/20 hover:border-pink-300/30
          transition-all duration-200 ease-out
          animate-fade-in"
        aria-label={t('valentineQuestTitle')}
      >
        {/* Heart Icon */}
        <Heart className="w-4 h-4 text-pink-400 flex-shrink-0 animate-pulse" fill="currentColor" />
        
        {/* Title & Progress */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-white/90 text-xs font-semibold whitespace-nowrap">
            {t('valentineQuestTitle')}
          </span>
          
          {/* Slim Progress Bar */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-white/60 text-[10px] font-medium">
              {questProgress}/{QUEST_REQUIREMENT}
            </span>
          </div>
        </div>

        {/* Completion indicator */}
        {questCompleted && (
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 ml-0.5" />
        )}
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED MODAL VIEW (On Click)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* Backdrop + Modal Container - flexbox centering is more reliable on mobile */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      >
        {/* Modal */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div 
          className="w-full max-w-sm animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-br from-pink-500/15 via-slate-900/95 to-rose-500/15
            backdrop-blur-2xl rounded-3xl p-5 space-y-4
            border border-pink-300/20 shadow-2xl shadow-pink-500/20">
          
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-400" fill="currentColor" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">
                  {t('valentineQuestTitle')}
                </h3>
                <p className="text-white/50 text-xs mt-0.5">
                  {t('valentineQuestSubtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 -m-1 rounded-full hover:bg-white/10 transition-colors touch-manipulation"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/40 hover:text-white/70" />
            </button>
          </div>

          {/* Time Remaining */}
          <div className="flex items-center gap-2 text-white/50 text-xs px-3 py-2 
            bg-white/5 rounded-xl border border-white/5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {daysRemaining > 0 ? `${daysRemaining} ${t('daysRemaining')}` : t('questEnded')}
            </span>
          </div>

          {/* Progress Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">
                {t('valentineQuestProgress')
                  .replace('{count}', String(questProgress))
                  .replace('{total}', String(QUEST_REQUIREMENT))}
              </span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                questCompleted
                  ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                  : 'bg-pink-500/20 text-pink-300 border border-pink-500/20'
              }`}>
                {questCompleted ? t('questDone') : t('questInProgress')}
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Rewards Section */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <h4 className="text-white/90 font-semibold text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-yellow-400" />
              {t('valentineQuestRewards')}
            </h4>
            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-2.5 text-white/70 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-400 to-rose-400" />
                {t('valentineQuestRewardTheme')}
              </div>
              <div className="flex items-center gap-2.5 text-white/70 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-400 to-rose-400" />
                {t('valentineQuestRewardHighlight')}
              </div>
            </div>
          </div>

          {/* Action Button */}
          {questCompleted && !rewardsClaimed && (
            <button
              onClick={handleClaimRewards}
              disabled={claimedRewards}
              className="w-full py-3 rounded-2xl font-semibold text-sm
                bg-gradient-to-r from-pink-500 to-rose-500 
                text-white shadow-lg shadow-pink-500/25
                hover:shadow-xl hover:shadow-pink-500/35 hover:brightness-110
                active:scale-[0.98] transition-all duration-200 
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 touch-manipulation"
            >
              <Gift className="w-4 h-4" />
              <span>{claimedRewards ? t('claimingRewards') : t('claimRewards')}</span>
            </button>
          )}

          {rewardsClaimed && (
            <div className="w-full py-3 rounded-2xl text-center text-sm font-semibold 
              bg-green-500/15 text-green-400 border border-green-500/20">
              ✓ {t('valentineQuestCompleted')}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
