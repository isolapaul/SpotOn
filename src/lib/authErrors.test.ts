import { describe, expect, it } from 'vitest';
import { emailAuthErrorKey } from './authErrors';

describe('emailAuthErrorKey', () => {
  it.each([
    ['auth/invalid-email', 'authErrInvalidEmail'],
    ['auth/user-not-found', 'authErrWrongPassword'],
    ['auth/wrong-password', 'authErrWrongPassword'],
    ['auth/email-already-in-use', 'authErrEmailInUse'],
    ['auth/weak-password', 'authErrWeakPassword'],
    ['auth/invalid-credential', 'authErrInvalidCredential'],
  ])('%s → %s in both modes', (code, key) => {
    expect(emailAuthErrorKey(code, 'signin')).toBe(key);
    expect(emailAuthErrorKey(code, 'signup')).toBe(key);
  });

  it('falls back to the generic message of the mode', () => {
    expect(emailAuthErrorKey(undefined, 'signin')).toBe('authErrSignInFailed');
    expect(emailAuthErrorKey('auth/network-request-failed', 'signup')).toBe('authErrSignUpFailed');
  });
});
