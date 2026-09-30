'use client';

import { Fragment, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Share, MoreVertical, X, Monitor } from 'lucide-react';
import { useIsClient } from '@/hooks/useIsClient';
import { useT } from '@/hooks/useT';
import { splitBold } from '@/lib/i18n';
import { getMovedTo } from '@/lib/movedTo';
import { INSTALL_GATE_EXEMPT_PATHS } from '@/lib/constants';

const DISMISS_KEY = 'spoton-install-prompt-dismissed';

/** Renders a translation whose `**…**` parts are bold, as text nodes and `<strong>` (no innerHTML). */
function RichText({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {splitBold(text).map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

/** Whether this browser should see the install prompt; client only (reads storage and the display mode). */
function shouldPromptInstall(): boolean {
  // Old (Vercel) domain: installing it would install the wrong origin (T19)
  if (getMovedTo()) return false;
  // Previously dismissed with "don't show again"
  if (localStorage.getItem(DISMISS_KEY) === 'true') return false;
  // Already running installed (standalone PWA)
  const isStandalone = globalThis.matchMedia('(display-mode: standalone)').matches
    || (globalThis.navigator as Navigator & { standalone?: boolean }).standalone
    || document.referrer.includes('android-app://');
  // Everyone else (mobile & desktop) sees it
  return !isStandalone;
}

export default function InstallGate() {
  const isClient = useIsClient();
  const [dismissed, setDismissed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const t = useT();
  // The legal and account deletion pages must stay usable without installing (A1, Google Play).
  const isLegalPage = INSTALL_GATE_EXEMPT_PATHS.includes(usePathname() ?? '');
  // Decided once after hydration (the server render and the first client render show nothing).
  const shouldPrompt = useMemo(() => isClient && shouldPromptInstall(), [isClient]);
  const isIOS = useMemo(() => isClient && /iPhone|iPad|iPod/i.test(navigator.userAgent), [isClient]);
  const showPrompt = shouldPrompt && !dismissed;

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(DISMISS_KEY, 'true');
    }
    setDismissed(true);
  };

  if (!showPrompt || isLegalPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-surface-0 flex flex-col items-center justify-center p-6 text-center text-white">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="no-min-size absolute right-3 w-11 h-11 grid place-items-center rounded-full"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
        aria-label="Close"
      >
        <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
          <X className="w-4 h-4 text-white/70" strokeWidth={2.5} />
        </span>
      </button>

      {/* App Icon */}
      <div className="mb-8">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" className="motion-safe:animate-level-pop drop-shadow-2xl">
          <rect width="96" height="96" rx="22" fill="#16A064" />
          <path d="M48 78S26 60 26 41a22 22 0 0 1 44 0c0 19-22 37-22 37z" fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          <path d="M48 49.5s-9-5.2-9-10.9c0-3 2.2-5.1 4.9-5.1 1.8 0 3.3 1 4.1 2.4.8-1.4 2.3-2.4 4.1-2.4 2.7 0 4.9 2.1 4.9 5.1 0 5.7-9 10.9-9 10.9z" fill="#fff" />
        </svg>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold mb-4">
        {t('installTitle')}
      </h1>

      {/* Body Text */}
      <p className="text-lg text-white/90 mb-8 max-w-md leading-relaxed">
        {t('installBody')}
      </p>

      {/* Dynamic Platform Instructions */}
      <div className="w-full max-w-sm space-y-4">
        {isIOS ? (
          <>
            <div className="bg-surface-1 rounded-[18px] p-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Share className="w-6 h-6 text-brand-400" />
                <h2 className="text-xl font-semibold">{t('installIosTitle')}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-400 flex-shrink-0">1.</span>
                  <span><RichText text={t('installIosStep1')} /></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-400 flex-shrink-0">2.</span>
                  <span><RichText text={t('installIosStep2')} /></span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">{t('installIosHint')}</p>
          </>
        ) : (
          <>
            <div className="bg-surface-1 rounded-[18px] p-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MoreVertical className="w-6 h-6 text-brand-400" />
                <h2 className="text-xl font-semibold">{t('installAndroidTitle')}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-400 flex-shrink-0">1.</span>
                  <span><RichText text={t('installAndroidStep1')} /></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-400 flex-shrink-0">2.</span>
                  <span><RichText text={t('installAndroidStep2')} /></span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">{t('installAndroidHint')}</p>
          </>
        )}
      </div>

      {/* Continue on web button + don't show again */}
      <div className="mt-8 w-full max-w-sm space-y-4">
        <button
          onClick={handleDismiss}
          className="w-full h-[50px] px-6 bg-white/10 active:bg-white/15 text-white rounded-full font-semibold
            transition-all duration-150 active:scale-[.97] flex items-center justify-center gap-2"
        >
          <Monitor className="w-5 h-5" />
          {t('installContinueWeb')}
        </button>

        <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-sm text-white/60">{t('installDontShowAgain')}</span>
        </label>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/10 max-w-md">
        <p className="text-sm text-white/50">
          {t('installFooter')}
        </p>
      </div>
    </div>
  );
}
