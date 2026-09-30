import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNotificationStore, type Notification } from '@/store/useNotificationStore';
import { useInboxStore } from '@/store/useInboxStore';
import { useT } from '@/hooks/useT';
import { INBOX_TEXT, isApproval, type InboxItem } from '@/lib/inbox';

const INBOX_PREFIX = 'inbox:';

/**
 * The notification centre's list (item 4): the device's own notifications and the server inbox
 * (moderation decisions, translated here), newest first, with one set of read/clear actions.
 */
export function useNotificationFeed() {
  const t = useT();
  const local = useNotificationStore(
    useShallow(({ notifications, markAsRead, markAllAsRead, clearAll }) => ({ notifications, markAsRead, markAllAsRead, clearAll })),
  );
  const inbox = useInboxStore(useShallow(({ items, markRead, markAllRead, clearAll }) => ({ items, markRead, markAllRead, clearAll })));

  const notifications = useMemo(() => {
    const fromInbox = inbox.items.map((item: InboxItem): Notification => ({
      id: INBOX_PREFIX + item.id,
      title: t(INBOX_TEXT[item.type].title),
      body: t(INBOX_TEXT[item.type].body, { name: item.spotName, reason: item.reason ?? '', user: item.actorName ?? '' }),
      timestamp: item.createdAt,
      read: item.read,
      type: isApproval(item.type) ? 'spot_approved' : 'moderation_declined',
    }));
    return [...fromInbox, ...local.notifications].sort((a, b) => b.timestamp - a.timestamp);
  }, [inbox.items, local.notifications, t]);

  const markAsRead = (id: string) => {
    if (id.startsWith(INBOX_PREFIX)) void inbox.markRead(id.slice(INBOX_PREFIX.length)).catch(console.error);
    else local.markAsRead(id);
  };
  const markAllAsRead = () => {
    local.markAllAsRead();
    void inbox.markAllRead().catch(console.error);
  };
  const clearAll = () => {
    local.clearAll();
    void inbox.clearAll().catch(console.error);
  };

  return { notifications, markAsRead, markAllAsRead, clearAll };
}
