'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useFollowStore } from '@/store/useFollowStore';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useT } from '@/hooks/useT';

/** Follow requests waiting for the signed-in user's answer (item 8), on top of the notifications. */
export default function FollowRequests({ onOpenProfile }: Readonly<{ onOpenProfile: () => void }>) {
  const t = useT();
  const requests = useFollowStore((s) => s.requests);
  if (!requests.length) return null;
  return (
    <section className="px-3 pb-2">
      <h4 className="px-2 pt-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">{t('followRequests')}</h4>
      <div className="space-y-2">
        {requests.map((r) => <RequestRow key={r.requester} uid={r.requester} onOpenProfile={onOpenProfile} />)}
      </div>
    </section>
  );
}

function RequestRow({ uid, onOpenProfile }: Readonly<{ uid: string; onOpenProfile: () => void }>) {
  const t = useT();
  const profile = usePublicProfile(uid);
  const me = useUserStore((s) => s.user?.uid);
  const respond = useFollowStore((s) => s.respond);
  const showToast = useToastStore((s) => s.showToast);
  const openProfile = useOpenProfile();
  const [busy, setBusy] = useState(false);
  const name = profile?.username ?? '…';

  const answer = async (accept: boolean) => {
    if (!me) return;
    setBusy(true);
    try {
      await respond(me, uid, accept);
      showToast(accept ? t('followRequestAccepted', { name }) : t('followRequestDeclined'), 'success');
    } catch (error) {
      console.error('Follow request answer failed:', error);
      showToast(t('genericError'), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/6 p-3 motion-safe:animate-item-in">
      <button
        type="button"
        onClick={() => { onOpenProfile(); openProfile(uid); }}
        className="no-min-size flex-1 min-w-0 flex items-center gap-3 text-left"
      >
        <span aria-hidden="true" className="w-10 h-10 rounded-full overflow-hidden grid place-items-center bg-brand-600 text-white font-semibold shrink-0">
          {profile?.profilePictureURL ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
            <img src={profile.profilePictureURL} alt="" className="w-full h-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-white font-semibold truncate">{name}</span>
          <span className="block text-white/50 text-xs">{t('wantsToFollowYou')}</span>
        </span>
      </button>
      <button type="button" disabled={busy} onClick={() => answer(false)} aria-label={t('declineRequest', { name })}
        className="no-min-size w-9 h-9 rounded-full grid place-items-center bg-white/10 text-white/80 disabled:opacity-50">
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <button type="button" disabled={busy} onClick={() => answer(true)} aria-label={t('acceptRequest', { name })}
        className="no-min-size w-9 h-9 rounded-full grid place-items-center bg-brand-600 text-white disabled:opacity-50">
        <Check className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
