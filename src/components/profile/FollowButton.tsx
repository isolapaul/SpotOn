'use client';

import { Check, Clock, UserPlus } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { FollowState } from '@/store/useFollowStore';

interface FollowButtonProps {
  relation: FollowState;
  isPrivate: boolean;
  busy: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}

/** Follow / Request / Requested (tap cancels) / Following (tap unfollows), item 8. */
export default function FollowButton({ relation, isPrivate, busy, onFollow, onUnfollow }: Readonly<FollowButtonProps>) {
  const t = useT();
  const base = 'no-min-size h-11 px-6 rounded-full font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[.97] disabled:opacity-60';
  if (relation === 'none') {
    return (
      <button type="button" onClick={onFollow} disabled={busy} className={`${base} bg-brand-600 text-white`}>
        <UserPlus className="w-4 h-4" aria-hidden="true" />
        {isPrivate ? t('requestToFollow') : t('follow')}
      </button>
    );
  }
  const requested = relation === 'requested';
  return (
    <button
      type="button"
      onClick={onUnfollow}
      disabled={busy}
      aria-label={requested ? t('cancelFollowRequest') : t('unfollow')}
      className={`${base} bg-white/10 text-label motion-safe:animate-badge-pop`}
    >
      {requested ? <Clock className="w-4 h-4" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
      {requested ? t('followRequested') : t('following')}
    </button>
  );
}
