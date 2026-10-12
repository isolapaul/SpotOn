'use client';

import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { PersonResult } from '@/store/useFollowStore';
import { getLevelInfo } from '@/lib/levelUtils';
import LevelBadge from '../ui/LevelBadge';

interface PersonRowProps {
  person: PersonResult;
  /** Position in the list, for the staggered entrance. */
  index: number;
  onOpen: () => void;
  /** Shown at the right end (a follow button), outside the row's own button. */
  trailing?: ReactNode;
}

/** One person in a list (the people search, followers / following): picture, name, level. */
export default function PersonRow({ person, index, onOpen, trailing }: Readonly<PersonRowProps>) {
  const t = useT();
  const level = person.level ?? 1;
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="flex items-center gap-2 pr-4 motion-safe:animate-item-in"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="no-min-size flex-1 min-w-0 flex items-center gap-3 pl-4 py-3 text-left active:bg-white/4 transition-colors"
      >
        <span aria-hidden="true" className="w-11 h-11 rounded-full overflow-hidden grid place-items-center bg-brand-600 text-white font-semibold shrink-0">
          {person.profilePictureURL && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
            <img src={person.profilePictureURL} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
          ) : (
            person.username.charAt(0).toUpperCase()
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-label font-semibold text-[16px]">
            <span className="truncate">{person.username}</span>
            {person.isPrivate && <Lock className="w-3.5 h-3.5 text-label-tertiary shrink-0" aria-label={t('privateProfile')} />}
          </span>
          <span className="flex items-center gap-1 text-[13px] text-label-secondary">
            <LevelBadge level={level} size={14} />
            {t(getLevelInfo(level).nameKey)}
          </span>
        </span>
      </button>
      {trailing}
    </div>
  );
}
