'use client';

import { useState } from 'react';
import { Check, Clock, UserPlus } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useFollowStore } from '@/store/useFollowStore';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';
import { actionErrorKey } from '@/lib/callableErrors';

/**
 * A compact Follow button for lists and feed cards. Reads whom the user follows from the live
 * listener; after a tap it shows Following (public) or Requested (private) and stays there.
 * Unfollowing happens on the profile page.
 */
export default function FollowChip({ uid, isPrivate = false, tone = 'filled' }: Readonly<{
  uid: string;
  isPrivate?: boolean;
  tone?: 'filled' | 'text';
}>) {
  const t = useT();
  const me = useUserStore((s) => s.user?.uid ?? null);
  const follows = useFollowStore((s) => s.following.has(uid));
  const [state, setState] = useState<'idle' | 'busy' | 'requested'>('idle');

  if (!me || me === uid) return null;
  if (follows || state === 'requested') {
    const requested = !follows;
    return (
      <span
        className={`shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-label-secondary motion-safe:animate-badge-pop ${
          tone === 'filled' ? 'h-8 px-3 rounded-full bg-white/8' : ''
        }`}
      >
        {requested ? <Clock className="w-3.5 h-3.5" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
        {requested ? t('followRequested') : t('following')}
      </span>
    );
  }

  const follow = async () => {
    setState('busy');
    try {
      const result = await useFollowStore.getState().follow(me, uid);
      playSound('follow');
      setState(result === 'requested' ? 'requested' : 'idle');
    } catch (error) {
      console.error('Follow failed:', error);
      useToastStore.getState().showToast(t(actionErrorKey(error)), 'error');
      setState('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void follow()}
      disabled={state === 'busy'}
      className={`no-min-size shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold touch-manipulation
        active:scale-90 transition-transform disabled:opacity-60 ${
          tone === 'filled' ? 'h-8 px-3.5 rounded-full bg-brand-600 text-white' : 'h-8 px-1 text-brand-400'
        }`}
    >
      {tone === 'filled' && <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />}
      {isPrivate ? t('requestToFollow') : t('follow')}
    </button>
  );
}
