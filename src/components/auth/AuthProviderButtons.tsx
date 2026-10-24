'use client';

import { APPLE_SIGN_IN } from '@/lib/constants';
import { useT } from '@/hooks/useT';
import { offersAppleSignIn } from '@/lib/nativeApp';
import { Mail } from 'lucide-react';

interface AuthProviderButtonsProps {
  loading: boolean;
  onProvider: (provider: 'google' | 'apple') => void;
  onEmail: () => void;
}

/** The sign-in sheet's first view: Google, Apple (when enabled) and the e-mail form. */
export default function AuthProviderButtons({ loading, onProvider, onEmail }: Readonly<AuthProviderButtonsProps>) {
  const t = useT({ fallback: 'en' });

  return (
    <div className="flex flex-col gap-3">
      {/* Google Sign In Button */}
      <button
        onClick={() => onProvider('google')}
        disabled={loading}
        className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
          bg-white text-gray-900 shadow-lg
          hover:shadow-xl active:scale-98
          transition-all duration-200
          flex items-center justify-center gap-3
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
            <span>{t('authSigningIn')}</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{t('authGoogle')}</span>
          </>
        )}
      </button>

      {/* Sign in with Apple (App Store 4.8), when the build enables it */}
      {offersAppleSignIn(APPLE_SIGN_IN) && (
        <button
          type="button"
          onClick={() => onProvider('apple')}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl font-semibold text-lg bg-black text-white ring-1 ring-white/20
            active:scale-98 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <svg className="w-5 h-6" viewBox="0 0 17 20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.05 10.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM11.78 3.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z"
            />
          </svg>
          <span>{t('authApple')}</span>
        </button>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="flex-1 h-px bg-white/10" />
        <span className="text-[13px] text-label-tertiary">{t('authOr')}</span>
        <span className="flex-1 h-px bg-white/10" />
      </div>

      {/* Email Sign In Button */}
      <button
        onClick={onEmail}
        className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
          bg-white/10 text-label active:bg-white/15 active:scale-98
          transition-all duration-200
          flex items-center justify-center gap-3"
      >
        <Mail className="w-6 h-6" />
        <span>{t('authWithEmail')}</span>
      </button>
    </div>
  );
}
