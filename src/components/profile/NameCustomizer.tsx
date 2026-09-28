'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUserStore, userErrorKey, type User } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { CUSTOM_NAME_COLORS, CUSTOM_NAME_FONTS, getCustomNameColorValue } from '@/lib/levelUtils';
import { resolveNameFontClass } from '@/lib/nameStyle';

type ColorOption = (typeof CUSTOM_NAME_COLORS)[number];
type FontOption = (typeof CUSTOM_NAME_FONTS)[number];

interface NameCustomizerProps {
  user: User;
}

/** Level 5 name colour / font picker with a preview. */
export default function NameCustomizer({ user }: Readonly<NameCustomizerProps>) {
  const updateCustomNameColor = useUserStore((s) => s.updateCustomNameColor);
  const updateCustomNameFont = useUserStore((s) => s.updateCustomNameFont);
  const { showToast } = useToastStore();
  const t = useT();
  const [isCustomizing, setIsCustomizing] = useState(false);

  const handleSelectColor = async (colorOption: ColorOption) => {
    setIsCustomizing(true);
    try {
      await updateCustomNameColor(colorOption.value);
      showToast(t('colorSet', { name: t(colorOption.labelKey) }), 'success');
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'genericError'), 'error');
    } finally {
      setIsCustomizing(false);
    }
  };

  const handleSelectFont = async (fontOption: FontOption) => {
    setIsCustomizing(true);
    try {
      await updateCustomNameFont(fontOption.value);
      showToast(t('fontSet', { name: t(fontOption.labelKey) }), 'success');
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'genericError'), 'error');
    } finally {
      setIsCustomizing(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-5 animate-fade-in">
      <div>
        <h3 className="text-cyan-300 font-bold mb-2 flex items-center gap-2">
          💎 {t('diamondCustomization')}
        </h3>
        <p className="text-white/60 text-xs">
          {t('diamondCustomizationDesc')}
        </p>
      </div>

      {/* Color Selection */}
      <div className="space-y-3">
        <h4 className="text-white font-semibold text-sm">{t('nameColorLabel')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {CUSTOM_NAME_COLORS.map((colorOption) => {
            const isSelected = user.customNameColor === colorOption.value;
            return (
              <button
                key={colorOption.value}
                onClick={() => handleSelectColor(colorOption)}
                disabled={isCustomizing}
                className={`p-3 rounded-xl transition-all text-left ${
                  isSelected
                    ? colorOption.selectedClass
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className={`font-bold ${colorOption.textClass} text-sm mb-1`}>
                  {t(colorOption.labelKey)}
                </div>
                <div className={`text-xs ${colorOption.textClass} opacity-70`}>
                  {user.username || t('username')}
                </div>
                {isSelected && (
                  <div className="mt-1 text-xs text-green-400">✓ {t('activeLabel')}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Selection */}
      <div className="space-y-3">
        <h4 className="text-white font-semibold text-sm">{t('fontStyleLabel')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {CUSTOM_NAME_FONTS.map((fontOption) => {
            const isSelected = user.customNameFont === fontOption.value;
            return (
              <button
                key={fontOption.value}
                onClick={() => handleSelectFont(fontOption)}
                disabled={isCustomizing}
                className={`p-3 rounded-xl transition-all text-left ${
                  isSelected
                    ? 'bg-cyan-500/20 border-2 border-cyan-500'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className={`text-white text-sm mb-1 ${fontOption.className}`}>
                  {t(fontOption.labelKey)}
                </div>
                <div className={`text-xs text-white/60 ${fontOption.className}`}>
                  {user.username || t('username')}
                </div>
                {isSelected && (
                  <div className="mt-1 text-xs text-green-400">✓ {t('activeLabel')}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="pt-3 border-t border-white/10">
        <h4 className="text-white font-semibold text-sm mb-2">{t('previewLabel')}</h4>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-cyan-500/30">
            {(user.profilePictureURL || user.photoURL) && (
              <Image
                src={user.profilePictureURL || user.photoURL || ''}
                alt="Preview"
                fill
                sizes="48px"
                className="object-cover"
              />
            )}
          </div>
          <div>
            <p
              className={`font-medium ${resolveNameFontClass(user.customNameFont)}`}
              style={{
                color: getCustomNameColorValue(user.customNameColor) || '#67e8f9',
              }}
            >
              {user.username || t('username')}
            </p>
            <p className="text-white/60 text-xs">{t('previewHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
