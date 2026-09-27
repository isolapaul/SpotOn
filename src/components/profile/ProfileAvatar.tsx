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
        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gray-800">
          <Image
            src={user.profilePictureURL || user.photoURL || ''}
            alt={user.username}
            fill
            sizes="128px"
            className="object-cover"
            priority
            onError={() => onFailed(user.profilePictureURL || user.photoURL || null)}
          />
        </div>
      ) : (
        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <span className="text-white text-5xl font-bold">{user.username?.charAt(0).toUpperCase() || 'U'}</span>
        </div>
      )}
    </div>
  );
}
