'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotificationStore, type Notification } from '@/store/useNotificationStore';
import { useT } from '@/hooks/useT';
import { isSameLocalDay } from '@/lib/notificationText';
import ModalShell from '../ui/ModalShell';
import NotificationItem from './NotificationItem';

/** Exit animation length (Tailwind `animate-sheet-out`). */
const CLOSE_MS = 180;

interface NotificationSheetProps {
  onClose: () => void;
}

/** The notification list, growing out of the control stack's bell (iOS-like sheet, grouped by day). */
export default function NotificationSheet({ onClose }: Readonly<NotificationSheetProps>) {
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotificationStore();
  const t = useT();
  const [closing, setClosing] = useState(false);
  // "Now" for grouping and relative times, fixed when the sheet opens (render stays pure).
  const [now] = useState(() => Date.now());
  const unreadCount = notifications.filter((n) => !n.read).length;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  const today = notifications.filter((n) => isSameLocalDay(n.timestamp, now));
  const earlier = notifications.filter((n) => !isSameLocalDay(n.timestamp, now));
  const groups: Array<{ label: string; items: Notification[] }> = [
    { label: t('notificationsToday'), items: today },
    { label: t('notificationsEarlier'), items: earlier },
  ].filter((g) => g.items.length > 0);

  return (
    <ModalShell
      variant="sheet"
      z="modal"
      align="start"
      justify="end"
      onBackdropClick={close}
      backdropLabel="Close notifications"
      outerClassName="pl-3"
      outerStyle={{
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        paddingRight: 'max(12px, calc(env(safe-area-inset-right) + 8px))',
      }}
      backdropClassName={`absolute inset-0 bg-black/40 backdrop-blur-sm touch-manipulation ${
        closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
      }`}
      panelClassName={`w-full max-w-[400px] max-h-[75vh] origin-top-right ${
        closing ? 'motion-safe:animate-sheet-out' : 'motion-safe:animate-sheet-in'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
        <div>
          <h3 className="text-white text-[26px] font-bold tracking-tight leading-tight">{t('notifications')}</h3>
          {unreadCount > 0 && (
            <p className="text-white/50 text-sm mt-0.5">{t('notificationsUnread', { count: unreadCount })}</p>
          )}
        </div>
        <button
          onClick={close}
          className="flex-shrink-0 w-11 h-11 -mr-1.5 rounded-full flex items-center justify-center
            hover:bg-white/10 active:scale-90 transition touch-manipulation"
          aria-label="Close"
        >
          <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/80" strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {/* Actions */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between px-5 pb-2 text-sm">
          {unreadCount > 0 ? (
            <button
              onClick={markAllAsRead}
              className="py-1.5 font-medium text-brand-400 active:text-brand-300 active:opacity-60 transition touch-manipulation"
            >
              {t('markAllRead')}
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={clearAll}
            className="py-1.5 font-medium text-white/50 hover:text-white/80 active:opacity-60 transition touch-manipulation"
          >
            {t('clearAll')}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 motion-safe:animate-item-in">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-white/40" strokeWidth={1.8} />
            </div>
            <p className="text-white font-semibold text-center mb-1">{t('noNotifications')}</p>
            <p className="text-white/50 text-sm text-center max-w-xs">{t('noNotificationsDesc')}</p>
          </div>
        ) : (
          groups.map((group, groupIndex) => (
            <section key={group.label}>
              <h4 className="px-2 pt-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
                {group.label}
              </h4>
              <div className="space-y-2">
                {group.items.map((notification, i) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    index={i + (groupIndex === 0 ? 0 : today.length)}
                    now={now}
                    onClick={markAsRead}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </ModalShell>
  );
}
