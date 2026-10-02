'use client';

import { useCallback, useState } from 'react';
import { Ban, Flag, MoreHorizontal } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useSafetyStore } from '@/store/useSafetyStore';
import ReportSheet from '../safety/ReportSheet';

/** Someone's profile, "…": report the profile, block or unblock the user. */
export default function ProfileMenu({ uid, name, blocked, onChanged }: Readonly<{
  uid: string;
  name: string;
  blocked: boolean;
  onChanged: () => void;
}>) {
  const t = useT();
  const me = useUserStore((s) => s.user?.uid);
  const { block, unblock } = useSafetyStore();
  const showToast = useToastStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const closeReport = useCallback(() => setReporting(false), []);
  if (!me) return null;

  const toggleBlock = async () => {
    try {
      if (blocked) await unblock(uid);
      else await block(me, uid);
      showToast(blocked ? t('userUnblocked', { name }) : t('userBlocked', { name }), 'success');
      onChanged();
    } catch (error) {
      console.error('Block failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setConfirming(false);
      setOpen(false);
    }
  };

  const item = 'no-min-size w-full flex items-center gap-3 px-4 h-12 text-left text-[15px] active:bg-white/6';
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t('moreActions')} aria-expanded={open}
        className="no-min-size w-11 h-11 grid place-items-center rounded-full">
        <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
          <MoreHorizontal className="w-4 h-4 text-label-secondary" aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-1 top-12 z-10 w-60 rounded-r2 bg-surface-3 shadow-sheet ring-1 ring-white/10 overflow-hidden divide-y divide-white/6 motion-safe:animate-scale-in origin-top-right">
          {confirming ? (
            <div className="p-4">
              <p className="text-label text-[15px] font-semibold">{t(blocked ? 'unblockConfirm' : 'blockConfirm', { name })}</p>
              {!blocked && <p className="text-label-secondary text-[13px] mt-1">{t('blockExplain')}</p>}
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setConfirming(false)} className="flex-1 h-9 rounded-lg bg-white/8 text-label text-sm">{t('cancel')}</button>
                <button type="button" onClick={toggleBlock} className="flex-1 h-9 rounded-lg bg-red-500/20 text-red-300 text-sm font-semibold">
                  {t(blocked ? 'unblock' : 'block')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" className={`${item} text-label`} onClick={() => { setReporting(true); setOpen(false); }}>
                <Flag className="w-4 h-4" aria-hidden="true" />
                {t('reportProfile')}
              </button>
              <button type="button" role="menuitem" className={`${item} text-red-300`} onClick={() => setConfirming(true)}>
                <Ban className="w-4 h-4" aria-hidden="true" />
                {t(blocked ? 'unblock' : 'block')}
              </button>
            </>
          )}
        </div>
      )}
      {reporting && <ReportSheet target={{ kind: 'profile', targetId: uid }} onClose={closeReport} />}
    </div>
  );
}
