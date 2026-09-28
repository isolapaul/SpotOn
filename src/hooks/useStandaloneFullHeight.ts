import { useEffect } from 'react';
import { standaloneDocumentHeight } from '@/lib/appViewport';

function safeAreaTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;top:0;left:0;width:1px;height:env(safe-area-inset-top)';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

/**
 * Installed iPhone app: sizes <html> and <body> to the screen so iOS 26 leaves no strip below the
 * app (lib/appViewport). <html> gets overflow visible, so <body>'s overflow: hidden keeps the page
 * from scrolling. Browser tabs and other devices are untouched.
 */
export function useStandaloneFullHeight() {
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone !== true) return;
    const html = document.documentElement;
    const apply = () => {
      const height = standaloneDocumentHeight({
        standalone: true,
        userAgent: navigator.userAgent,
        safeAreaTop: safeAreaTop(),
        screenWidth: screen.width,
        screenHeight: screen.height,
      });
      const value = height === null ? '' : `${height}px`;
      html.style.height = value;
      document.body.style.height = value;
      html.style.overflow = height === null ? '' : 'visible';
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}
