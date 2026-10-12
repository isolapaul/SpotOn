'use client';

import { useT } from '@/hooks/useT';
import type { FollowListKind } from '@/store/useFollowStore';

interface ProfileStatsProps {
  /** null while unknown (someone's private profile): shows a dash. */
  spots: number | null;
  followers: number;
  following: number;
  className?: string;
  /** Makes the follower and following counts open that list (when the viewer may see it). */
  onOpenList?: (kind: FollowListKind) => void;
}

/**
 * Spots, followers and following as one light, unboxed row with large numbers and small labels, on
 * the own profile and on someone else's. With `onOpenList` the follow counts open the lists.
 */
export default function ProfileStats({ spots, followers, following, className = '', onOpenList }: Readonly<ProfileStatsProps>) {
  const t = useT();
  const stat = (value: number | null, label: string, kind?: FollowListKind) => (
    // Label first in the DOM (read as "Followers 12"), number on top on screen. A tappable count
    // keeps the list semantics and lays a button over the pair.
    <div className={`relative flex flex-col-reverse items-center gap-1 min-w-0 px-1 ${kind && onOpenList ? 'group' : ''}`}>
      <dt className="text-[13px] leading-tight text-label-secondary text-center wrap-break-word">{label}</dt>
      <dd className="text-[22px] font-bold leading-none text-label tabular-nums transition-transform duration-150 group-active:scale-90">
        {value ?? '–'}
      </dd>
      {kind && onOpenList && (
        <button
          type="button"
          onClick={() => onOpenList(kind)}
          aria-haspopup="dialog"
          aria-label={`${label} ${value ?? ''}`.trim()}
          className="no-min-size absolute -inset-1.5 rounded-xl touch-manipulation active:bg-white/6 transition-colors"
        />
      )}
    </div>
  );
  return (
    <dl className={`w-full max-w-xs grid grid-cols-3 ${className}`}>
      {stat(spots, t('spots'))}
      {stat(followers, t('followers'), 'followers')}
      {stat(following, t('followingCount'), 'following')}
    </dl>
  );
}
