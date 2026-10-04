'use client';

import { Shield } from 'lucide-react';

interface ProfileBadgesProps {
  isAdmin: boolean;
}

/** The admin shield under the name (the level is shown, and opened, by the level card). */
export default function ProfileBadges({ isAdmin }: Readonly<ProfileBadgesProps>) {
  if (!isAdmin) return null;
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
        <Shield className="w-4 h-4 text-amber-400" />
      </div>
    </div>
  );
}
