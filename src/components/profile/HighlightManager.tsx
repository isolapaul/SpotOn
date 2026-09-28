'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore, userErrorKey } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { LevelInfo } from '@/lib/levelUtils';
import { highlightErrorKey, isHighlightedBy } from '@/lib/highlights';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';

interface HighlightManagerProps {
  /** All of the user's spots (the same list as the level source); only approved ones are listed. */
  spots: Spot[];
  uid: string;
  levelInfo: LevelInfo;
}

/** Level 3+ highlight panel: highlight / un-highlight the user's approved spots. */
export default function HighlightManager({ spots, uid, levelInfo }: Readonly<HighlightManagerProps>) {
  const highlightSpot = useUserStore((s) => s.highlightSpot);
  const unhighlightSpot = useUserStore((s) => s.unhighlightSpot);
  const { showToast } = useToastStore();
  const t = useT();
  const [isHighlighting, setIsHighlighting] = useState(false);

  const activeHighlightCount = spots.filter((s) => isHighlightedBy(s, uid)).length;
  const approvedSpots = spots.filter((s) => s.status === 'approved');

  const handleToggleHighlight = async (spot: Spot, isHighlighted: boolean) => {
    setIsHighlighting(true);
    try {
      if (isHighlighted) {
        await unhighlightSpot(spot.id);
        showToast(t('highlightRemoved'), 'success');
      } else {
        await highlightSpot(spot.id);
        showToast(t('spotHighlighted'), 'success');
      }
    } catch (error) {
      showToast(t(highlightErrorKey(error) ?? userErrorKey(error) ?? 'genericError'), 'error');
    } finally {
      setIsHighlighting(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-bold ${levelInfo.textColor}`}>
            ✨ {t('highlightSpots')}
          </h3>
          <p className="text-white/60 text-xs mt-1">
            {t('highlightedCount', { count: activeHighlightCount, max: levelInfo.maxHighlights })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {approvedSpots.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-4">
            {t('noApprovedSpotsToHighlight')}
          </p>
        ) : (
          approvedSpots.map((spot) => {
            const isHighlighted = isHighlightedBy(spot, uid);

            return (
              <div key={spot.id} className={`p-3 rounded-xl border transition-all ${
                isHighlighted
                  ? `${levelInfo.bgColor} ${levelInfo.borderColor}`
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex gap-3 items-center">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={getThumbnailUrl(spot)}
                      alt={spot.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized={isImageUnoptimized(spot)}
                    />
                    {isHighlighted && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium text-sm line-clamp-1">
                      {spot.name}
                    </h4>
                    <p className="text-white/60 text-xs line-clamp-1">
                      {spot.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleHighlight(spot, isHighlighted)}
                    disabled={isHighlighting || (!isHighlighted && activeHighlightCount >= levelInfo.maxHighlights)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isHighlighted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : `${levelInfo.bgColor} ${levelInfo.textColor} border ${levelInfo.borderColor} hover:opacity-80`
                    }`}
                  >
                    {isHighlighted ? t('delete') : t('highlightAction')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
