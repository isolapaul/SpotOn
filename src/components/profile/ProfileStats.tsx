'use client';

import { useT } from '@/hooks/useT';

interface ProfileStatsProps {
  /** null while unknown (someone's private profile): shows a dash. */
  spots: number | null;
  followers: number;
  following: number;
  className?: string;
}

/**
 * Spots, followers and following (item 8: counts only) as one light, unboxed row with large numbers
 * and small labels, on the own profile and on someone else's. The own favourites have their tab.
 */
export default function ProfileStats({ spots, followers, following, className = '' }: Readonly<ProfileStatsProps>) {
  const t = useT();
  const stat = (value: number | null, label: string) => (
    // Label first in the DOM (read as "Followers 12"), number on top on screen.
    <div className="flex flex-col-reverse items-center gap-1 min-w-0 px-1">
      <dt className="text-[13px] leading-tight text-label-secondary text-center wrap-break-word">{label}</dt>
      <dd className="text-[22px] font-bold leading-none text-label tabular-nums">{value ?? '–'}</dd>
    </div>
  );
  return (
    <dl className={`w-full max-w-xs grid grid-cols-3 ${className}`}>
      {stat(spots, t('spots'))}
      {stat(followers, t('followers'))}
      {stat(following, t('followingCount'))}
    </dl>
  );
}
