'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { playSound, useSoundStore } from '@/store/useSoundStore';

/** Settings › Sounds: the interface sounds on or off (this device); turning them on plays a sample. */
export default function SoundSection() {
  const t = useT();
  const enabled = useSoundStore((s) => s.enabled);
  const toggle = () => {
    useSoundStore.getState().setEnabled(!enabled);
    if (!enabled) playSound('notification');
  };
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <div className="rounded-[18px] bg-surface-1 p-5">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className="no-min-size w-full flex items-center gap-3 text-left touch-manipulation"
      >
        <span className={`w-10 h-10 shrink-0 rounded-full grid place-items-center transition-colors ${enabled ? 'bg-brand-500/20 text-brand-300' : 'bg-white/8 text-label-tertiary'}`}>
          <Icon key={String(enabled)} className="w-5 h-5 motion-safe:animate-badge-pop" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-label font-semibold text-[16px]">{t('soundsSetting')}</span>
          <span className="block text-label-secondary text-[13px] leading-snug">{t('soundsSettingHint')}</span>
        </span>
        <span aria-hidden="true" className={`relative w-[51px] h-[31px] shrink-0 rounded-full transition-colors duration-200 ${enabled ? 'bg-brand-500' : 'bg-white/15'}`}>
          <span
            className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform duration-300 ease-ios-bounce ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
