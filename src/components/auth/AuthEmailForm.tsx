'use client';

import { useT } from '@/hooks/useT';
import type { AuthMode } from '@/lib/authErrors';
import { Mail, Lock, User } from 'lucide-react';

interface AuthEmailFormProps {
  mode: AuthMode;
  loading: boolean;
  email: string;
  password: string;
  username: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
  onToggleMode: () => void;
  onBack: () => void;
}

/** The sign-in sheet's e-mail form: sign in, or sign up with a username. */
export default function AuthEmailForm({
  mode,
  loading,
  email,
  password,
  username,
  onEmailChange,
  onPasswordChange,
  onUsernameChange,
  onSubmit,
  onToggleMode,
  onBack,
}: Readonly<AuthEmailFormProps>) {
  const t = useT({ fallback: 'en' });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Username field (only for signup) */}
      {mode === 'signup' && (
        <div>
          <label htmlFor="username" className="block text-white/80 text-sm font-medium mb-2">
            {t('authUsername')}
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, ''))}
              placeholder={t('authUsernamePlaceholder')}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-3 border border-transparent
                text-white placeholder-white/40 focus:outline-hidden focus:ring-2 
                focus:ring-brand-500 focus:border-transparent transition-all"
              required={mode === 'signup'}
              minLength={3}
              maxLength={20}
            />
          </div>
          <p className="text-white/50 text-xs mt-1">{t('usernameRules')}</p>
        </div>
      )}

      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-white/80 text-sm font-medium mb-2">
          {t('authEmail')}
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('authEmailPlaceholder')}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-3 border border-transparent
              text-white placeholder-white/40 focus:outline-hidden focus:ring-2 
              focus:ring-brand-500 focus:border-transparent transition-all"
            required
          />
        </div>
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-white/80 text-sm font-medium mb-2">
          {t('authPassword')}
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t('authPasswordPlaceholder')}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-3 border border-transparent
              text-white placeholder-white/40 focus:outline-hidden focus:ring-2 
              focus:ring-brand-500 focus:border-transparent transition-all"
            required
            minLength={6}
          />
        </div>
        {mode === 'signup' && (
          <p className="text-white/50 text-xs mt-1">{t('authPasswordHint')}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
          bg-brand-600 text-white
          active:bg-brand-700 active:scale-98
          transition-all duration-200
          flex items-center justify-center gap-3
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            <span>{mode === 'signin' ? t('authSigningIn') : `${t('authSignUp')}...`}</span>
          </>
        ) : (
          <span>{mode === 'signin' ? t('authSignIn') : t('authSignUp')}</span>
        )}
      </button>

      {/* Toggle between signin/signup */}
      <div className="text-center">
        <button
          type="button"
          onClick={onToggleMode}
          className="text-white/70 hover:text-white text-sm transition-colors"
        >
          {mode === 'signin' ? t('authNoAccount') : t('authHaveAccount')}
        </button>
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 text-white/60 hover:text-white text-sm transition-colors"
      >
        {t('authBack')}
      </button>
    </form>
  );
}
