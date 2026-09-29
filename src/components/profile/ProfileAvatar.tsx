'use client';

import Image from 'next/image';
import type { User } from '@/store/useUserStore';

interface ProfileAvatarProps {
  user: Pick<User, 'profilePictureURL' | 'photoURL' | 'username'>;
  /** The src that failed to load (T15 fallback). Held by ProfilePanel so it survives panel close. */
  failedSrc: string | null;
  onFailed: (src: string | null) => void;
}

export default function ProfileAvatar({ user, failedSrc, onFailed }: Readonly<ProfileAvatarProps>) {
  return (
    <div className="relative">
      {(user.profilePictureURL || user.photoURL) && failedSrc !== (user.profilePictureURL || user.photoURL) ? (
        <div className="relative w-[104px] h-[104px] rounded-full overflow-hidden ring-4 ring-surface-0 shadow-card bg-surface-3">
          <Image
            src={user.profilePictureURL || user.photoURL || ''}
            alt={user.username}
            fill
            sizes="104px"
            className="object-cover"
            priority
            onError={() => onFailed(user.profilePictureURL || user.photoURL || null)}
          />
        </div>
      ) : (
        <div className="relative w-[104px] h-[104px] rounded-full overflow-hidden ring-4 ring-surface-0 shadow-card bg-brand-600 flex items-center justify-center">
          <span className="text-white text-[44px] font-semibold">{user.username?.charAt(0).toUpperCase() || 'U'}</span>
        </div>
      )}
    </div>
  );
}
