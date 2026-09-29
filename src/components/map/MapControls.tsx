'use client';

import { useState, type ReactNode } from 'react';
import { Bell, Layers, LocateFixed, MessageSquareText } from 'lucide-react';
import FeedbackPanel from '@/components/FeedbackPanel';
import NotificationSheet from '@/components/notifications/NotificationSheet';
import MapStylePopover from './MapStylePopover';
import { useT } from '@/hooks/useT';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import { useLocationStore } from '@/store/useLocationStore';
import { useToastStore } from '@/store/useToastStore';
import { useUiStore } from '@/store/useUiStore';
import { Z } from '@/lib/constants';

// Control stack (design 1C): one vertical capsule in the top-right corner, Apple Maps style.
// Order follows frequency and meaning: notifications, map style, feedback, then re-centre.

type Open = 'none' | 'notifications' | 'style' | 'feedback';

function Cell({ label, onClick, children }: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative w-11 h-11 grid place-items-center text-chrome-ink-soft touch-manipulation
        active:bg-black/[.08] chrome-dark:active:bg-white/10 transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      {children}
    </button>
  );
}

const Hairline = () => <span aria-hidden="true" className="block mx-auto w-6 h-px bg-black/[.06] chrome-dark:bg-white/10" />;

export default function MapControls() {
  const t = useT();
  const [open, setOpen] = useState<Open>('none');
  const { unreadCount, ringKey } = useNotificationBadge();
  const close = () => setOpen('none');
  // A sheet or popover grows out of the stack and takes its place meanwhile.
  const covered = open === 'notifications' || open === 'style';

  // Replays the locate icon's spin on every tap.
  const [locateSpin, setLocateSpin] = useState(0);

  const locate = async () => {
    setLocateSpin((n) => n + 1);
    const { location, request } = useLocationStore.getState();
    if (location) {
      useUiStore.getState().requestLocate();
      return;
    }
    if (!navigator.geolocation) return;
    const result = await request();
    if (result === 'granted') useUiStore.getState().requestLocate();
    else if (result === 'denied') useToastStore.getState().showToast(t('locationDenied'), 'error');
  };

  return (
    <>
      <div
        role="toolbar"
        aria-orientation="vertical"
        aria-label={t('mapControls')}
        className={`material-chrome fixed ${Z.floatingButton} w-11 rounded-full overflow-hidden flex flex-col
          transition-opacity duration-200 ${covered ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{
          top: 'calc(env(safe-area-inset-top) + 8px)',
          right: 'max(12px, calc(env(safe-area-inset-right) + 8px))',
        }}
      >
        <Cell label={t('notifications')} onClick={() => setOpen('notifications')}>
          <Bell
            key={ringKey}
            className={`w-5 h-5 origin-top ${ringKey > 0 ? 'motion-safe:animate-bell-ring' : ''}`}
            strokeWidth={2}
          />
        </Cell>
        <Hairline />
        <Cell label={t('mapTheme')} onClick={() => setOpen('style')}>
          <Layers className="w-5 h-5" strokeWidth={2} />
        </Cell>
        <Hairline />
        <Cell label={t('feedback')} onClick={() => setOpen('feedback')}>
          <MessageSquareText className="w-5 h-5" strokeWidth={2} />
        </Cell>
        <Hairline />
        <Cell label={t('locateMe')} onClick={locate}>
          <LocateFixed
            key={locateSpin}
            className={`w-5 h-5 text-locate ${locateSpin > 0 ? 'motion-safe:animate-locate-spin' : ''}`}
            strokeWidth={2}
          />
        </Cell>
      </div>

      {/* Unread badge: outside the capsule (it clips), pinned to the bell cell's corner */}
      {unreadCount > 0 && !covered && (
        <span
          key={unreadCount}
          aria-hidden="true"
          className={`fixed ${Z.floatingButton} pointer-events-none min-w-[17px] h-[17px] px-1 rounded-full
            bg-[#FF3B30] text-white text-[11px] font-bold leading-[17px] text-center tabular-nums
            ring-2 ring-[rgb(var(--chrome-rgb))] motion-safe:animate-badge-pop`}
          style={{
            top: 'calc(env(safe-area-inset-top) + 4px)',
            right: 'calc(max(12px, calc(env(safe-area-inset-right) + 8px)) - 4px)',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}

      {open === 'notifications' && <NotificationSheet onClose={close} />}
      {open === 'style' && <MapStylePopover onClose={close} />}
      <FeedbackPanel open={open === 'feedback'} onClose={close} />
    </>
  );
}
