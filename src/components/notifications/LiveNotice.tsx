'use client';

import { useEffect, useState } from 'react';
import { MapPin, MessageCircle, Bell, UserCheck, UserPlus, type LucideIcon } from 'lucide-react';
import { useInboxStore } from '@/store/useInboxStore';
import { useUiStore } from '@/store/useUiStore';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useT } from '@/hooks/useT';
import { INBOX_TEXT, opensProfile, opensSpot, type InboxItem, type InboxType } from '@/lib/inbox';
import { Z } from '@/lib/constants';

/** How long the banner stays before it slides away. */
const VISIBLE_MS = 4500;
/** The slide-away animation (Tailwind `animate-sheet-out`). */
const LEAVE_MS = 180;

const ICONS: Partial<Record<InboxType, LucideIcon>> = {
  new_follower: UserPlus,
  follow_request: UserPlus,
  follow_accepted: UserCheck,
  followed_spot: MapPin,
  review_reply: MessageCircle,
};

/**
 * A notice that arrives while the app is open (the push is not shown in the foreground): a pill
 * drops in from the top for a few seconds. A tap opens what it is about, as in the notification
 * centre (the other user's profile, or flies to the spot) and marks it read.
 */
export default function LiveNotice() {
  const fresh = useInboxStore((s) => s.fresh);
  if (!fresh) return null;
  return <Banner key={fresh.id} item={fresh} />;
}

function Banner({ item }: Readonly<{ item: InboxItem }>) {
  const t = useT();
  const openProfile = useOpenProfile();
  const [leaving, setLeaving] = useState(false);
  // Touching or focusing the banner holds it (time to read, WCAG 2.2.1).
  const [held, setHeld] = useState(false);
  const Icon = ICONS[item.type] ?? Bell;

  const dismiss = () => setLeaving(true);

  // Stays a few seconds, then slides away; the store forgets it once the slide is over.
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [held]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => useInboxStore.getState().dismissFresh(), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  const open = () => {
    void useInboxStore.getState().markRead(item.id).catch(console.error);
    dismiss();
    if (opensProfile(item.type) && item.actorUid) openProfile(item.actorUid);
    // The spot may not have reached the map yet: the link flight waits for it.
    else if (opensSpot(item.type) && item.spotId) useUiStore.getState().openSpotLink(item.spotId);
  };

  const text = INBOX_TEXT[item.type];
  return (
    <div
      className={`fixed inset-x-0 ${Z.liveNotice} flex justify-center px-3 pointer-events-none`}
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <button
        type="button"
        onClick={open}
        onPointerDown={() => setHeld(true)}
        onFocus={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        className={`no-min-size pointer-events-auto w-full max-w-[420px] flex items-center gap-3 rounded-[22px] p-3 pr-4
          material-chrome shadow-float text-left touch-manipulation active:scale-[.98] transition-transform ${
            leaving ? 'motion-safe:animate-sheet-out' : 'motion-safe:animate-toast-in'
          }`}
      >
        <span className="shrink-0 w-10 h-10 rounded-full grid place-items-center bg-brand-600 text-white">
          <Icon className="w-5 h-5 motion-safe:animate-badge-pop" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span role="status" className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight text-chrome-ink truncate">{t(text.title)}</span>
          <span className="block text-[13px] leading-snug text-chrome-ink-2 line-clamp-2">
            {t(text.body, { name: item.spotName, reason: item.reason ?? '', user: item.actorName ?? '' })}
          </span>
        </span>
      </button>
    </div>
  );
}
