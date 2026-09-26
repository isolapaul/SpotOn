'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useT } from '@/hooks/useT';
import { useUiStore } from '@/store/useUiStore';
import { MOVED_BANNER_DISMISS_KEY, getMovedTo, isBannerDismissed, movedTarget } from '@/lib/movedTo';

// Build-time constant: null everywhere except the Vercel build (T19).
const MOVED_TO = getMovedTo();

// Survives unmount/remount (the banner remounts when panels open/close), so Hide lasts the page view
// even when localStorage is blocked.
let hiddenThisView = false;

/** Slim, non-modal notice on the old domain. One tap on Hide hides it for good on this device. */
export default function MovedBanner() {
  const t = useT();
  const hasSelectedLanguage = useLanguageStore((s) => s.hasSelectedLanguage);
  const setMovedBannerVisible = useUiStore((s) => s.setMovedBannerVisible);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage.getItem(MOVED_BANNER_DISMISS_KEY);
    } catch {
      stored = null;
    }
    setDismissed(hiddenThisView || isBannerDismissed(stored));
    // Same test InstallGate uses for an installed PWA.
    setStandalone(
      globalThis.matchMedia('(display-mode: standalone)').matches
        || (globalThis.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    setMounted(true);
  }, []);

  const visible = MOVED_TO !== null && hasSelectedLanguage && mounted && !dismissed;

  useEffect(() => {
    setMovedBannerVisible(visible);
    return () => setMovedBannerVisible(false);
  }, [visible, setMovedBannerVisible]);

  const dismiss = () => {
    hiddenThisView = true;
    try {
      globalThis.localStorage.setItem(MOVED_BANNER_DISMISS_KEY, '1');
    } catch {
      // Storage unavailable: hidden for this page view only.
    }
    setDismissed(true);
  };

  if (!visible || !MOVED_TO) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[1500] mx-auto max-w-md flex items-center gap-2 pl-4 pr-1 py-1
        rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-glass-lg text-white animate-fade-in"
      style={{
        top: 'calc(1rem + env(safe-area-inset-top) + 56px)',
        left: 'max(1rem, env(safe-area-inset-left))',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <p className="flex-1 min-w-0 py-1 text-sm leading-snug">
        {t('movedBannerText')} <span className="block font-semibold whitespace-nowrap">{MOVED_TO.host}</span>
        <span className="block text-xs text-white/85">
          {standalone ? t('movedBannerHintInstalled') : t('movedBannerHint')}
        </span>
      </p>
      <a
        href={movedTarget(MOVED_TO, globalThis.location.pathname, globalThis.location.search)}
        rel="noopener"
        className="shrink-0 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium touch-manipulation"
      >
        {t('movedBannerOpen')}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('movedBannerDismiss')}
        className="shrink-0 rounded-full hover:bg-white/10 touch-manipulation"
      >
        <X className="w-4 h-4 text-white/70" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
