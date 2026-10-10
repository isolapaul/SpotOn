'use client';

import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { useT } from '@/hooks/useT';
import { Z } from '@/lib/constants';

/**
 * A pill at the top while the device is offline: the map and lists may be out of date, and saving
 * waits for the connection (uploads retry, Firestore queues writes). Gone as soon as it is back.
 */
export default function OfflineBanner() {
  const online = useOnline();
  const t = useT();
  if (online) return null;
  return (
    <div
      role="status"
      className={`fixed inset-x-0 ${Z.liveNotice} flex justify-center px-3 pointer-events-none`}
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <span className="material-chrome shadow-float rounded-full h-10 pl-3 pr-4 inline-flex items-center gap-2 text-[14px] font-semibold text-chrome-ink motion-safe:animate-toast-in">
        <WifiOff className="w-4 h-4 text-orange-500" aria-hidden="true" />
        {t('offlineBanner')}
      </span>
    </div>
  );
}
