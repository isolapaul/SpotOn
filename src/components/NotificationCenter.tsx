'use client';

import { useEffect, useState } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import FeedbackPanel from './FeedbackPanel';
import NotificationSheet from './notifications/NotificationSheet';
import { useNotificationStore } from '@/store/useNotificationStore';
import { Z } from '@/lib/constants';

function unreadOf(notifications: ReadonlyArray<{ read: boolean }>): number {
  return notifications.filter((n) => !n.read).length;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => unreadOf(s.notifications));
  // Bumped when a new unread notification arrives: re-keys the bell, which replays its ring.
  const [ringKey, setRingKey] = useState(0);

  useEffect(
    () =>
      useNotificationStore.subscribe((state, prev) => {
        if (unreadOf(state.notifications) > unreadOf(prev.notifications)) setRingKey((k) => k + 1);
      }),
    [],
  );

  return (
    <>
      {/* Notification Bell Button - Top Left */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${Z.floatingButton} w-12 h-12 rounded-full 
          bg-black/40 backdrop-blur-md border border-white/10
          active:scale-95 transition-all duration-200 shadow-glass-lg
          hover:bg-black/50
          touch-manipulation select-none flex items-center justify-center`}
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
        aria-label="Notifications"
      >
        <Bell
          key={ringKey}
          className={`w-6 h-6 text-white origin-top ${ringKey > 0 ? 'motion-safe:animate-bell-ring' : ''}`}
          strokeWidth={2}
        />

        {/* Unread badge: pops in on every change of the count */}
        {unreadCount > 0 && (
          <div
            key={unreadCount}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold
              rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5
              shadow-lg motion-safe:animate-badge-pop"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Feedback Button - Top Left, next to Notifications */}
      <button
        onClick={() => setIsFeedbackOpen(true)}
        className={`fixed ${Z.floatingButton} w-12 h-12 rounded-full 
          bg-black/40 backdrop-blur-md border border-white/10
          active:scale-95 transition-all duration-200 shadow-glass-lg
          hover:bg-black/50
          touch-manipulation select-none flex items-center justify-center`}
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          left: 'calc(max(1rem, env(safe-area-inset-left)) + 56px)'
        }}
        aria-label="Feedback"
      >
        <MessageSquare className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {isOpen && <NotificationSheet onClose={() => setIsOpen(false)} />}
      <FeedbackPanel open={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </>
  );
}
