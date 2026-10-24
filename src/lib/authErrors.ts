import type { TranslationKey } from './translations';

export type AuthMode = 'signin' | 'signup';

/** The message for a failed e-mail sign-in or sign-up, by Firebase Auth error code. */
export function emailAuthErrorKey(code: string | undefined, mode: AuthMode): TranslationKey {
  if (code === 'auth/invalid-email') return 'authErrInvalidEmail';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'authErrWrongPassword';
  if (code === 'auth/email-already-in-use') return 'authErrEmailInUse';
  if (code === 'auth/weak-password') return 'authErrWeakPassword';
  if (code === 'auth/invalid-credential') return 'authErrInvalidCredential';
  return mode === 'signin' ? 'authErrSignInFailed' : 'authErrSignUpFailed';
}
