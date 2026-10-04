import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';
import { pendingClaimAction } from '@/lib/onboarding';

/**
 * The name chosen in the tour, after sign-up (page.tsx; it also runs after a Google redirect). The
 * e-mail form claims it itself (the tour hands it over); a new Google account got a generated name,
 * so this claims the chosen one through the existing claimUsername callable. If that fails the
 * username modal asks as before, prefilled with it. Existing accounts are never renamed.
 */
export function usePendingUsernameClaim() {
  const pending = useOnboardingStore((s) => s.pendingUsername);
  const loading = useUserStore((s) => s.loading);
  const user = useUserStore((s) => s.user);
  const newAccount = useUserStore((s) => s.newAccount);
  const needsUsername = useUserStore((s) => s.needsUsername);
  const claiming = useOnboardingStore((s) => s.claiming);
  // One claim per account and page load.
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    const action = pendingClaimAction({
      pending,
      loading,
      signedIn: user !== null,
      username: user?.username ?? null,
      newAccount,
      attempted: user !== null && attemptedFor.current === user.uid,
      claiming,
      needsUsername,
    });
    const store = useOnboardingStore.getState();
    if (action === 'clear') {
      store.setPendingUsername(null);
      return;
    }
    if (action !== 'claim' || !user || !pending) return;
    attemptedFor.current = user.uid;
    store.setClaiming(true);
    useUserStore
      .getState()
      .updateUsername(pending)
      .then(() => useOnboardingStore.getState().setPendingUsername(null))
      .catch((error: unknown) => {
        console.error('Could not claim the username chosen in the tour:', error);
        // Today's flow: the generated name stays and the modal asks (prefilled with the chosen one).
        useUserStore.getState().setNeedsUsername(true);
      })
      .finally(() => useOnboardingStore.getState().setClaiming(false));
  }, [pending, loading, user, newAccount, needsUsername, claiming]);
}
