'use client';

import { Fragment, useEffect, useState } from 'react';
import { Share, MoreVertical, Smartphone, X, Monitor } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { splitBold } from '@/lib/i18n';
import { getMovedTo } from '@/lib/movedTo';

const DISMISS_KEY = 'spoton-install-prompt-dismissed';

/** Renders a translation whose `**…**` parts are bold, as text nodes and `<strong>` (no innerHTML). */
function RichText({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {splitBold(text).map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

export default function InstallGate() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const t = useT();

  useEffect(() => {
    // Old (Vercel) domain: installing it would install the wrong origin (T19)
    if (getMovedTo()) { setShowPrompt(false); return; }

    // Check if user previously dismissed with "don't show again"
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') {
      setShowPrompt(false);
      return;
    }

    // Detect if app is running in standalone mode (installed as PWA)
    const isStandalone = globalThis.matchMedia('(display-mode: standalone)').matches
      || (globalThis.navigator as any).standalone
      || document.referrer.includes('android-app://');

    // Don't show if already installed as PWA
    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Show the prompt for everyone (mobile & desktop) who hasn't dismissed it
    setShowPrompt(true);
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(DISMISS_KEY, 'true');
    }
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6 text-white/70" />
      </button>

      {/* App Icon */}
      <div className="mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/50">
          <Smartphone className="w-12 h-12 text-white" strokeWidth={2} />
        </div>
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
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Share className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-semibold">{t('installIosTitle')}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">1.</span>
                  <span><RichText text={t('installIosStep1')} /></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">2.</span>
                  <span><RichText text={t('installIosStep2')} /></span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">{t('installIosHint')}</p>
          </>
        ) : (
          <>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MoreVertical className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-semibold">{t('installAndroidTitle')}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">1.</span>
                  <span><RichText text={t('installAndroidStep1')} /></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">2.</span>
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
          className="w-full py-3 px-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold 
            transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 border border-white/20"
        >
          <Monitor className="w-5 h-5" />
          {t('installContinueWeb')}
        </button>

        <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
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
