'use client';

import PerkIcon from '@/components/ui/PerkIcon';
import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import type { User } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import type { LevelInfo } from '@/lib/levelUtils';
import HighlightManager from '../HighlightManager';
import NameCustomizer from '../NameCustomizer';
import MySpotList from '../MySpotList';

interface MySpotsTabProps {
  user: User;
  /** All of the user's spots (approved + pending). */
  spots: Spot[];
  levelInfo: LevelInfo;
  onOpenSpot: (spotId: string) => void;
}

export default function MySpotsTab({ user, spots, levelInfo, onOpenSpot }: Readonly<MySpotsTabProps>) {
  const t = useT();
  const [showHighlightPanel, setShowHighlightPanel] = useState(false);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const perkButtonClass = `w-full h-11 px-4 rounded-full font-semibold text-[15px] transition-transform active:scale-[.98] ${levelInfo.bgColor} ${levelInfo.textColor}`;

  return (
    <div className="space-y-4">
      {/* Level Management Buttons */}
      {levelInfo.level >= 3 ? (
        <div className="w-full space-y-2">
          {/* Highlight Management Button */}
          {levelInfo.maxHighlights > 0 && (
            <button onClick={() => setShowHighlightPanel(!showHighlightPanel)} className={perkButtonClass}>
              <span className="inline-flex items-center justify-center gap-2">
                <PerkIcon icon="highlight" className="w-4 h-4" />
                {showHighlightPanel ? t('closeHighlightPanel') : t('highlightSpots')}
              </span>
            </button>
          )}

          {/* Customization Button (Level 5) */}
          {levelInfo.canCustomizeName && (
            <button onClick={() => setShowCustomizationPanel(!showCustomizationPanel)} className={perkButtonClass}>
              <span className="inline-flex items-center justify-center gap-2">
                <PerkIcon icon="style" className="w-4 h-4" />
                {showCustomizationPanel ? t('closeCustomization') : t('customizeName')}
              </span>
            </button>
          )}
        </div>
      ) : null}

      {/* Highlight Panel */}
      {showHighlightPanel && levelInfo.level >= 3 && (
        <HighlightManager spots={spots} uid={user.uid} levelInfo={levelInfo} />
      )}

      {/* Level 5 Customization Panel */}
      {showCustomizationPanel && levelInfo.level >= 5 && <NameCustomizer user={user} />}

      {/* My Spots List */}
      <MySpotList spots={spots} onOpenSpot={onOpenSpot} />
    </div>
  );
}
