import { useEffect } from 'react';
import { useOnboardingStore, selectTourBlocking, type InstallPromptEvent } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';
import { isOnboardingDue } from '@/lib/onboarding';

/**
 * Whether the first-run tour shows (page.tsx). It waits for auth (the variant depends on it), and
 * stays up through its closing line. Also keeps Chromium's install offer for the install step: the
 * event fires early, long before the lazy tour code loads.
 */
export function useOnboardingGate(): { showTour: boolean; blocking: boolean } {
  const due = useOnboardingStore((s) => isOnboardingDue({ completed: s.completed, sharedLink: s.sharedLink }));
  const running = useOnboardingStore((s) => s.running);
  const blocking = useOnboardingStore(selectTourBlocking);
  const authLoading = useUserStore((s) => s.loading);

  useEffect(() => {
    const keep = (e: Event) => {
      // Our own install step offers it; the browser's mini-infobar would compete with it.
      e.preventDefault();
      useOnboardingStore.getState().setInstallPrompt(e as InstallPromptEvent);
    };
    const installed = () => useOnboardingStore.getState().setInstallPrompt(null);
    globalThis.addEventListener('beforeinstallprompt', keep);
    globalThis.addEventListener('appinstalled', installed);
    return () => {
      globalThis.removeEventListener('beforeinstallprompt', keep);
      globalThis.removeEventListener('appinstalled', installed);
    };
  }, []);

  return { showTour: running || (due && !authLoading), blocking };
}
