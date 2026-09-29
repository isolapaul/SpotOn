import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';

function unreadOf(notifications: ReadonlyArray<{ read: boolean }>): number {
  return notifications.filter((n) => !n.read).length;
}

/**
 * The bell's unread count, and `ringKey`, bumped when a new unread notification arrives: keying the
 * bell icon with it replays the ring animation.
 */
export function useNotificationBadge(): { unreadCount: number; ringKey: number } {
  const unreadCount = useNotificationStore((s) => unreadOf(s.notifications));
  const [ringKey, setRingKey] = useState(0);

  useEffect(
    () =>
      useNotificationStore.subscribe((state, prev) => {
        if (unreadOf(state.notifications) > unreadOf(prev.notifications)) setRingKey((k) => k + 1);
      }),
    [],
  );

  return { unreadCount, ringKey };
}
