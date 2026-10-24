'use client';

import { Camera, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import Image from 'next/image';
import { useT } from '@/hooks/useT';
import type { User } from '@/lib/mapUserDoc';

interface ProfileImagesSectionProps {
  user: User;
  isUploadingPicture: boolean;
  isUploadingBanner: boolean;
  onPictureChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Settings › the profile picture and the banner, each with its picker. */
export default function ProfileImagesSection({
  user,
  isUploadingPicture,
  isUploadingBanner,
  onPictureChange,
  onBannerChange,
}: Readonly<ProfileImagesSectionProps>) {
  const t = useT();
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="rounded-[18px] bg-surface-1 p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          {t('changeProfilePicture')}
        </h3>
        
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-brand-500/30">
            {user.profilePictureURL || user.photoURL ? (
              <Image
                src={user.profilePictureURL || user.photoURL || ''}
                alt={user.username}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-brand-600 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {user.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => pictureInputRef.current?.click()}
            disabled={isUploadingPicture}
            className="flex-1 py-2.5 px-4 bg-brand-600 text-white rounded-xl font-semibold
              active:bg-brand-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {isUploadingPicture ? t('uploadingImage') : t('uploadPicture')}
          </button>
        </div>
        
        <input
          ref={pictureInputRef}
          type="file"
          accept="image/*"
          onChange={onPictureChange}
          className="hidden"
        />
      </div>

      {/* Profile Banner Section */}
      <div className="rounded-[18px] bg-surface-1 p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          {t('changeProfileBanner')}
        </h3>
        
        <div className="space-y-3">
          <div className="relative w-full h-24 rounded-xl overflow-hidden ring-1 ring-white/10">
            {user.profileBannerURL ? (
              <Image
                src={user.profileBannerURL}
                alt={t('bannerAlt')}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-white/40" />
              </div>
            )}
          </div>
          
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={isUploadingBanner}
            className="w-full py-2.5 px-4 bg-brand-600 text-white rounded-xl font-semibold
              active:bg-brand-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {isUploadingBanner ? t('uploadingImage') : t('uploadBanner')}
          </button>
        </div>
        
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={onBannerChange}
          className="hidden"
        />
      </div>
    </>
  );
}
