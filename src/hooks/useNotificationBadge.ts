import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useInboxStore } from '@/store/useInboxStore';

function unreadOf(notifications: ReadonlyArray<{ read: boolean }>): number {
  return notifications.filter((n) => !n.read).length;
}

/**
 * The bell's unread count (the device's notifications and the server inbox, item 4), and `ringKey`,
 * bumped when a new unread notification arrives: keying the bell icon with it replays the ring animation.
 */
export function useNotificationBadge(): { unreadCount: number; ringKey: number } {
  const localUnread = useNotificationStore((s) => unreadOf(s.notifications));
  const inboxUnread = useInboxStore((s) => unreadOf(s.items));
  const [ringKey, setRingKey] = useState(0);

  useEffect(() => {
    const ring = () => setRingKey((k) => k + 1);
    const stopLocal = useNotificationStore.subscribe((state, prev) => {
      if (unreadOf(state.notifications) > unreadOf(prev.notifications)) ring();
    });
    const stopInbox = useInboxStore.subscribe((state, prev) => {
      if (unreadOf(state.items) > unreadOf(prev.items)) ring();
    });
    return () => {
      stopLocal();
      stopInbox();
    };
  }, []);

  return { unreadCount: localUnread + inboxUnread, ringKey };
}
