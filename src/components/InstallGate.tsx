'use client';

import { useEffect, useState } from 'react';
import { Share, MoreVertical, Smartphone } from 'lucide-react';

export default function InstallGate() {
  const [shouldBlock, setShouldBlock] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Detect if device is mobile (iOS/Android)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // 2. Detect if app is running in standalone mode (installed as PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone // iOS Safari specific
      || document.referrer.includes('android-app://'); // Android specific

    // 3. Determine if we should show the blocking overlay
    // ONLY block if: Mobile device AND NOT in standalone mode
    const shouldShowOverlay = isMobile && !isStandalone;

    setShouldBlock(shouldShowOverlay);
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  // Don't render anything if blocking is not needed
  // (Desktop users or already installed app users)
  if (!shouldBlock) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
      {/* App Icon */}
      <div className="mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/50">
          <Smartphone className="w-12 h-12 text-white" strokeWidth={2} />
        </div>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold mb-4">
        SpotOn Élmény 📲
      </h1>

      {/* Body Text */}
      <p className="text-lg text-white/90 mb-8 max-w-md leading-relaxed">
        A legjobb élmény érdekében add hozzá az appot a főképernyőhöz! 
        <br />
        <span className="text-white/70">A böngészős verzió mobilon nem támogatott.</span>
      </p>

      {/* Dynamic Platform Instructions */}
      <div className="w-full max-w-sm space-y-4">
        {isIOS ? (
          // iOS Instructions
          <>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Share className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-semibold">iOS Telepítés</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">1.</span>
                  <span>Kattints a <strong>Megosztás ikonra</strong> (négyzet nyíllal felfelé) az alsó menüsorban.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 flex-shrink-0">2.</span>
                  <span>Görgess le és válaszd a <strong>"Főképernyőhöz adás"</strong> opciót.</span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">
              💡 Safari böngészőben működik
            </p>
          </>
        ) : (
          // Android Instructions
          <>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MoreVertical className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-semibold">Android Telepítés</h2>
              </div>
              <ol className="text-left space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">1.</span>
                  <span>Kattints a <strong>három pontra</strong> (⋮) a böngésző jobb felső sarkában.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-400 flex-shrink-0">2.</span>
                  <span>Válaszd az <strong>"App telepítése"</strong> vagy <strong>"Kezdőképernyőre adás"</strong> gombot.</span>
                </li>
              </ol>
            </div>
            <p className="text-sm text-white/60">
              💡 Chrome vagy Edge böngészőben működik legjobban
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-white/20 max-w-md">
        <p className="text-sm text-white/50">
          Az app telepítése után automatikusan elindul a főképernyőről 🚀
        </p>
      </div>
    </div>
  );
}
