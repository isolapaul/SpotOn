'use client';

import { useEffect, useState } from 'react';
import { Share, MoreVertical, Smartphone, X, Monitor } from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';

const DISMISS_KEY = 'spoton-install-prompt-dismissed';

const texts = {
  hu: {
    title: 'SpotOn Élmény 📲',
    body: 'A legjobb élmény érdekében add hozzá az appot a főképernyőhöz!',
    iosTitle: 'iOS Telepítés',
    iosStep1: <>Kattints a <strong>Megosztás ikonra</strong> (négyzet nyíllal felfelé) az alsó menüsorban.</>,
    iosStep2: <>Görgess le és válaszd a <strong>&quot;Főképernyőhöz adás&quot;</strong> opciót.</>,
    iosHint: '💡 Safari böngészőben működik',
    androidTitle: 'Android Telepítés',
    androidStep1: <>Kattints a <strong>három pontra</strong> (⋮) a böngésző jobb felső sarkában.</>,
    androidStep2: <>Válaszd az <strong>&quot;App telepítése&quot;</strong> vagy <strong>&quot;Kezdőképernyőre adás&quot;</strong> gombot.</>,
    androidHint: '💡 Chrome vagy Edge böngészőben működik legjobban',
    continueWeb: 'Folytatás weben',
    dontShowAgain: 'Ne mutassa többet',
    footer: 'Az app telepítése után automatikusan elindul a főképernyőről 🚀',
  },
  en: {
    title: 'SpotOn Experience 📲',
    body: 'For the best experience, add the app to your home screen!',
    iosTitle: 'iOS Installation',
    iosStep1: <>Tap the <strong>Share icon</strong> (square with arrow up) in the bottom menu bar.</>,
    iosStep2: <>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</>,
    iosHint: '💡 Works in Safari browser',
    androidTitle: 'Android Installation',
    androidStep1: <>Tap the <strong>three dots</strong> (⋮) in the top right corner of the browser.</>,
    androidStep2: <>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.</>,
    androidHint: '💡 Works best in Chrome or Edge',
    continueWeb: 'Continue on web',
    dontShowAgain: "Don't show again",
    footer: 'After installation, the app will launch automatically from your home screen 🚀',
  },
  de: {
    title: 'SpotOn Erlebnis 📲',
    body: 'Für das beste Erlebnis füge die App zu deinem Startbildschirm hinzu!',
    iosTitle: 'iOS Installation',
    iosStep1: <>Tippe auf das <strong>Teilen-Symbol</strong> (Quadrat mit Pfeil nach oben) in der unteren Menüleiste.</>,
    iosStep2: <>Scrolle nach unten und wähle <strong>&quot;Zum Home-Bildschirm&quot;</strong>.</>,
    iosHint: '💡 Funktioniert im Safari-Browser',
    androidTitle: 'Android Installation',
    androidStep1: <>Tippe auf die <strong>drei Punkte</strong> (⋮) oben rechts im Browser.</>,
    androidStep2: <>Wähle <strong>&quot;App installieren&quot;</strong> oder <strong>&quot;Zum Startbildschirm hinzufügen&quot;</strong>.</>,
    androidHint: '💡 Funktioniert am besten in Chrome oder Edge',
    continueWeb: 'Im Web fortfahren',
    dontShowAgain: 'Nicht mehr anzeigen',
    footer: 'Nach der Installation startet die App automatisch vom Startbildschirm 🚀',
  },
};

export default function InstallGate() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { language } = useLanguageStore();

  useEffect(() => {
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

  const t = texts[language as keyof typeof texts] || texts.hu;

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
        {t.title}
      </h1>

      {/* Body Text */}
      <p className="text-lg text-white/90 mb-8 max-w-md leading-relaxed">
        {t.body}
      </p>

      {/* Dynamic Platform Instructions */}
      <div className="w-full max-w-sm space-y-4">
        {isIOS ? (
          <>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Share className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-semibold">{t.iosTitle}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">1.</span>
                  <span>{t.iosStep1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">2.</span>
                  <span>{t.iosStep2}</span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">{t.iosHint}</p>
          </>
        ) : (
          <>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MoreVertical className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-semibold">{t.androidTitle}</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">1.</span>
                  <span>{t.androidStep1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">2.</span>
                  <span>{t.androidStep2}</span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">{t.androidHint}</p>
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
          {t.continueWeb}
        </button>

        <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-sm text-white/60">{t.dontShowAgain}</span>
        </label>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/10 max-w-md">
        <p className="text-sm text-white/50">
          {t.footer}
        </p>
      </div>
    </div>
  );
}
