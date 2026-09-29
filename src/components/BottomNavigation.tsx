'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Compass, MapPin, Plus, UserRound } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { Z } from '@/lib/constants';

// Launcher (design 1C): a capsule with Explore (and the spot count) and the avatar, plus a separate
// green Add button. The map is always home, so nothing here has a selected state. While a spot is
// picked for adding, the capsule shows the hint and Add turns into a cancel ×.

interface BottomNavigationProps {
  /** Add-spot location picking is running. */
  picking: boolean;
  /** Slid away (a place card is showing). */
  hidden: boolean;
  /** Approved spots on the map; 0 hides the count line. */
  spotCount: number;
  onExplore: () => void;
  onAdd: () => void;
  onProfile: () => void;
  onCancelPicking: () => void;
}

function Avatar() {
  const user = useUserStore((s) => s.user);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = user?.profilePictureURL || user?.photoURL || '';

  if (!user) {
    return (
      <span className="w-10 h-10 rounded-full grid place-items-center bg-black/[.06] chrome-dark:bg-white/10">
        <UserRound className="w-[22px] h-[22px] text-chrome-ink-2" strokeWidth={2} />
      </span>
    );
  }
  if (src && failedSrc !== src) {
    return (
      <span className="relative w-10 h-10 rounded-full overflow-hidden bg-surface-3">
        <Image src={src} alt="" fill sizes="40px" className="object-cover" onError={() => setFailedSrc(src)} />
      </span>
    );
  }
  return (
    <span className="w-10 h-10 rounded-full grid place-items-center bg-brand-600 text-white text-[17px] font-semibold">
      {user.username?.charAt(0).toUpperCase() || 'U'}
    </span>
  );
}

export default function BottomNavigation({
  picking,
  hidden,
  spotCount,
  onExplore,
  onAdd,
  onProfile,
  onCancelPicking,
}: Readonly<BottomNavigationProps>) {
  const t = useT();
  const countLabel = t(spotCount === 1 ? 'spotCountOne' : 'spotCountMany', { count: spotCount });

  return (
    <nav
      aria-label={t('mainNavigation')}
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={`absolute inset-x-3 ${Z.dock} mx-auto max-w-[520px] flex items-center gap-2 select-none
        transition-[transform,opacity] ${
          hidden
            ? 'translate-y-[calc(100%+var(--bar-bottom)+8px)] opacity-0 duration-250 ease-exit'
            : 'translate-y-0 opacity-100 duration-450 ease-ios delay-75'
        }`}
      style={{ bottom: 'var(--bar-bottom)' }}
    >
      {/* Capsule */}
      <div className="material-chrome relative h-14 flex-1 min-w-0 rounded-full flex items-center pl-1.5 pr-2 overflow-hidden">
        {/* Idle: Explore + avatar */}
        <div
          className={`absolute inset-0 flex items-center pl-1.5 pr-2 transition-[opacity,transform] ${
            picking ? 'opacity-0 -translate-y-1.5 duration-200 pointer-events-none' : 'opacity-100 translate-y-0 duration-250 delay-100'
          }`}
          aria-hidden={picking || undefined}
        >
          <button
            type="button"
            onClick={onExplore}
            tabIndex={picking ? -1 : 0}
            aria-label={t('explore')}
            className="no-min-size group h-14 flex-1 min-w-0 flex items-center gap-3 pl-3 pr-2 rounded-full text-left
              touch-manipulation active:bg-black/[.05]"
          >
            <Compass className="w-6 h-6 flex-shrink-0 text-brand-600 chrome-dark:text-brand-400" strokeWidth={2} />
            <span className="min-w-0 flex flex-col transition-transform duration-150 group-active:scale-[.97]">
              <span className="text-[17px] font-semibold leading-tight text-chrome-ink truncate">{t('explore')}</span>
              {spotCount > 0 && (
                <span className="text-[13px] leading-tight text-chrome-ink-2 tabular-nums truncate animate-fade-in">
                  {countLabel}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={onProfile}
            tabIndex={picking ? -1 : 0}
            aria-label={t('profile')}
            className="w-11 h-11 flex-shrink-0 grid place-items-center rounded-full touch-manipulation
              transition-transform duration-150 active:scale-90"
          >
            <Avatar />
          </button>
        </div>

        {/* Picking: the hint */}
        <div
          role="status"
          className={`absolute inset-0 flex items-center gap-3 pl-5 pr-4 transition-[opacity,transform] ${
            picking ? 'opacity-100 translate-y-0 duration-250 delay-150' : 'opacity-0 translate-y-1.5 duration-200 pointer-events-none'
          }`}
        >
          {picking && (
            <>
              <MapPin className="w-5 h-5 flex-shrink-0 text-brand-600 chrome-dark:text-brand-400 motion-safe:animate-hint-bob" strokeWidth={2.2} />
              <span className="text-[15px] font-medium text-chrome-ink truncate">{t('tapMapToPlace')}</span>
            </>
          )}
        </div>
      </div>

      {/* Add / cancel */}
      <button
        type="button"
        onClick={picking ? onCancelPicking : onAdd}
        aria-label={picking ? t('cancel') : t('add')}
        className={`relative h-14 w-14 flex-shrink-0 grid place-items-center rounded-full shadow-float touch-manipulation
          transition-[background-color,color,transform] duration-250 active:scale-90 ${
            picking ? 'material-chrome text-chrome-ink' : 'bg-brand-600 text-white'
          }`}
      >
        <Plus
          className={`w-[26px] h-[26px] transition-transform duration-450 ease-ios-bounce ${picking ? 'rotate-45' : 'rotate-0'}`}
          strokeWidth={2.5}
        />
      </button>
    </nav>
  );
}
