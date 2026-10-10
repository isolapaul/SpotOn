'use client';

import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Settings2,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Notification } from '@/store/useNotificationStore';
import type { InboxType } from '@/lib/inbox';
import { useT } from '@/hooks/useT';
import { stripEdgeEmoji } from '@/lib/notificationText';

type NotificationType = Notification['type'];

// One icon and tint per type; the colour carries the mood, so texts need no emoji (static classes).
const LOOK: Readonly<Record<NotificationType, { icon: LucideIcon; tint: string }>> = {
  spot_approved: { icon: CheckCircle2, tint: 'bg-emerald-500/15 text-emerald-400' },
  moderation_declined: { icon: XCircle, tint: 'bg-red-500/15 text-red-400' },
  new_review: { icon: Star, tint: 'bg-amber-400/15 text-amber-300' },
  new_like: { icon: Heart, tint: 'bg-pink-500/15 text-pink-400' },
  new_pending_spot: { icon: ShieldCheck, tint: 'bg-indigo-500/15 text-indigo-300' },
  success: { icon: Check, tint: 'bg-emerald-500/15 text-emerald-400' },
  error: { icon: CircleAlert, tint: 'bg-red-500/15 text-red-400' },
  info: { icon: Info, tint: 'bg-sky-500/15 text-sky-400' },
  warning: { icon: AlertTriangle, tint: 'bg-orange-500/15 text-orange-400' },
  system: { icon: Settings2, tint: 'bg-white/10 text-white/70' },
  general: { icon: Bell, tint: 'bg-white/10 text-white/80' },
};

// Social inbox items get their own look (the moderation ones keep the approve / decline look).
const INBOX_LOOK: Partial<Record<InboxType, { icon: LucideIcon; tint: string }>> = {
  new_follower: { icon: UserPlus, tint: 'bg-violet-500/15 text-violet-300' },
  follow_request: { icon: UserPlus, tint: 'bg-violet-500/15 text-violet-300' },
  follow_accepted: { icon: UserCheck, tint: 'bg-violet-500/15 text-violet-300' },
  followed_spot: { icon: MapPin, tint: 'bg-brand-500/15 text-brand-300' },
  review_reply: { icon: MessageCircle, tint: 'bg-sky-500/15 text-sky-300' },
};

// In-app toasts are stored with a generic title ("Success") and the message as body: the message
// is the headline, the icon already says success / error / info.
const TOAST_TYPES: ReadonlySet<NotificationType> = new Set(['success', 'error', 'info']);

interface NotificationItemProps {
  notification: Notification;
  /** Position in the list, for the staggered entrance. */
  index: number;
  /** Reference time for the relative timestamp. */
  now: number;
  onClick: (id: string) => void;
}

export default function NotificationItem({ notification, index, now, onClick }: Readonly<NotificationItemProps>) {
  const t = useT();
  const { icon: Icon, tint } =
    (notification.inbox && INBOX_LOOK[notification.inbox.type]) ?? LOOK[notification.type] ?? LOOK.general;

  const formatTimestamp = (timestamp: number) => {
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return `${minutes} ${t('minutesAgo')}`;
    if (hours < 24) return `${hours} ${t('hoursAgo')}`;
    return `${days} ${t('daysAgo')}`;
  };

  const body = stripEdgeEmoji(notification.body ?? '');
  const isToast = TOAST_TYPES.has(notification.type) && body !== '';
  const headline = isToast ? body : stripEdgeEmoji(notification.title);
  const detail = isToast ? '' : body;

  return (
    <button
      onClick={() => onClick(notification.id)}
      className="w-full text-left flex gap-3 p-3.5 rounded-2xl bg-white/6 hover:bg-white/9
        active:scale-[0.98] transition touch-manipulation motion-safe:animate-item-in"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${tint}`}>
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4
            className={`flex-1 min-w-0 text-[15px] leading-snug text-white ${
              notification.read ? 'font-medium' : 'font-semibold'
            }`}
          >
            {headline}
          </h4>
          <span className="shrink-0 flex items-center gap-1.5 text-xs text-white/40 whitespace-nowrap">
            {!notification.read && <span className="w-2 h-2 rounded-full bg-brand-400" aria-hidden="true" />}
            {formatTimestamp(notification.timestamp)}
          </span>
        </div>
        {detail && <p className="text-[13px] leading-snug text-white/60 mt-0.5 line-clamp-3">{detail}</p>}
      </div>
    </button>
  );
}
