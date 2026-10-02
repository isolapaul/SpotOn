'use client';

import { Settings, X } from 'lucide-react';
import Image from 'next/image';
import { useT } from '@/hooks/useT';

interface ProfileBannerProps {
  bannerUrl?: string;
  onOpenSettings: () => void;
  onClose: () => void;
}

const MEDIA_BUTTON =
  'no-min-size w-11 h-11 grid place-items-center rounded-full touch-manipulation active:scale-90 transition-transform';

/** Banner (design phase 3): full-bleed under the status bar, neutral when there is no image. */
export default function ProfileBanner({ bannerUrl, onOpenSettings, onClose }: Readonly<ProfileBannerProps>) {
  const t = useT();
  return (
    <div
      className="relative w-full shrink-0 bg-linear-to-br from-brand-700/50 via-surface-2 to-surface-1"
      style={{ height: 'calc(env(safe-area-inset-top, 0px) + 136px)' }}
    >
      {bannerUrl ? <Image src={bannerUrl} alt="" fill sizes="100vw" className="object-cover" priority /> : null}
      <div className="absolute inset-0 bg-linear-to-b from-black/35 via-transparent to-surface-0/70" />

      <div className="absolute left-3 right-3 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
        <button onClick={onOpenSettings} className={MEDIA_BUTTON} aria-label={t('settings')}>
          <span className="w-9 h-9 rounded-full grid place-items-center bg-black/35 backdrop-blur-md">
            <Settings className="w-[18px] h-[18px] text-white" />
          </span>
        </button>
        <button onClick={onClose} className={MEDIA_BUTTON} aria-label={t('close')}>
          <span className="w-9 h-9 rounded-full grid place-items-center bg-black/35 backdrop-blur-md">
            <X className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
}
