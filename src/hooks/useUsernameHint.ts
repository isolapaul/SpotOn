import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { USERNAME_CHECK_DEBOUNCE_MS, initialUsernameHint, resolvedUsernameHint, type UsernameHint } from '@/lib/onboarding';

/**
 * The tour's soft availability hint for a name (already sanitized): a debounced read of the public
 * usernames/{name} registry through the user store. A hint only; sign-up claims the name later.
 */
export function useUsernameHint(name: string): UsernameHint {
  const [result, setResult] = useState<{ name: string; hint: UsernameHint } | null>(null);
  const initial = initialUsernameHint(name);

  useEffect(() => {
    if (initial !== 'checking') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      useUserStore
        .getState()
        .checkUsernameAvailable(name)
        .then((available) => !cancelled && setResult({ name, hint: resolvedUsernameHint(available) }))
        .catch(() => !cancelled && setResult({ name, hint: resolvedUsernameHint(null) }));
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, initial]);

  if (initial !== 'checking') return initial;
  return result?.name === name ? result.hint : 'checking';
}
