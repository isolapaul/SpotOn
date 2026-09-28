'use client';

import { BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserStore } from '@/store/useUserStore';
import { usePushPromptStore } from '@/store/usePushPromptStore';
import { useT } from '@/hooks/useT';
import { getMovedTo } from '@/lib/movedTo';
import { Z } from '@/lib/constants';

/**
 * One-time push offer, shown after the user's first successful contribution (usePushPromptStore),
 * only while the browser has not decided yet (permission 'default').
 */
export default function NotificationPrompt() {
  const user = useUserStore((s) => s.user);
  const requested = usePushPromptStore((s) => s.requested);
  const answer = usePushPromptStore((s) => s.answer);
  const t = useT();
  const { isPermissionGranted, isLoading, initializePush } = usePushNotifications();

  // Old (Vercel) domain: push tokens are per origin, so never ask there (T19)
  const canAsk =
    !getMovedTo() &&
    'Notification' in globalThis &&
    globalThis.Notification.permission === 'default';

  if (!requested || !user || isPermissionGranted || !canAsk) return null;

  const handleEnable = async () => {
    // Enabled or refused in the browser dialog: either way the question is answered.
    await initializePush();
    answer();
  };

  return (
    <div
      className={`fixed ${Z.modal} left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm`}
      style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      role="dialog"
      aria-labelledby="push-prompt-title"
    >
      <div
        className="rounded-[22px] bg-slate-900 ring-1 ring-white/10 shadow-2xl p-4 motion-safe:animate-prompt-in"
        style={{ animationDelay: '350ms' }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-sky-500/15 flex items-center justify-center">
            <BellRing
              className="w-5 h-5 text-sky-400 motion-safe:animate-bell-ring"
              style={{ animationDelay: '800ms' }}
              strokeWidth={2.2}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="push-prompt-title" className="text-white text-[15px] font-semibold leading-snug">
              {t('notificationPromptTitle')}
            </h3>
            <p className="text-white/60 text-[13px] leading-snug mt-0.5">
              {t('notificationPromptText')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={answer}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 text-sm font-medium
              hover:bg-white/15 active:scale-[0.97] transition touch-manipulation"
          >
            {t('notNow')}
          </button>
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold
              hover:bg-sky-400 active:scale-[0.97] transition disabled:opacity-60 touch-manipulation"
          >
            {isLoading ? t('enabling') : t('enable')}
          </button>
        </div>
      </div>
    </div>
  );
}
