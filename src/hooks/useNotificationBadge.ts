import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useInboxStore } from '@/store/useInboxStore';
import { useFollowStore } from '@/store/useFollowStore';

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
  // Follow requests waiting for an answer count too (item 8).
  const requests = useFollowStore((s) => s.requests.length);
  const [ringKey, setRingKey] = useState(0);

  useEffect(() => {
    const ring = () => setRingKey((k) => k + 1);
    const stopLocal = useNotificationStore.subscribe((state, prev) => {
      if (unreadOf(state.notifications) > unreadOf(prev.notifications)) ring();
    });
    const stopInbox = useInboxStore.subscribe((state, prev) => {
      if (unreadOf(state.items) > unreadOf(prev.items)) ring();
    });
    const stopRequests = useFollowStore.subscribe((state, prev) => {
      if (state.requests.length > prev.requests.length) ring();
    });
    return () => {
      stopLocal();
      stopInbox();
      stopRequests();
    };
  }, []);

  return { unreadCount: localUnread + inboxUnread + requests, ringKey };
}
