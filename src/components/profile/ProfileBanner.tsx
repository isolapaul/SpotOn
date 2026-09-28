'use client';

import { Settings, X } from 'lucide-react';
import Image from 'next/image';

interface ProfileBannerProps {
  bannerUrl?: string;
  onOpenSettings: () => void;
  onClose: () => void;
}

export default function ProfileBanner({ bannerUrl, onOpenSettings, onClose }: Readonly<ProfileBannerProps>) {
  return (
    <div className="relative w-full h-[18vh] flex-shrink-0 bg-gradient-to-r from-primary-700 to-primary-900">
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt="Profile banner"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

      {/* Top action buttons */}
      <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <button
          onClick={onOpenSettings}
          className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={onClose}
          className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
