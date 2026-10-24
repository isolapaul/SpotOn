'use client';

import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { LogIn, X } from 'lucide-react';
import { useState } from 'react';
import ModalShell, { SAFE_AREA_MARGINS } from './ui/ModalShell';
import LegalNotice from './legal/LegalNotice';
import AuthEmailForm from './auth/AuthEmailForm';
import AuthProviderButtons from './auth/AuthProviderButtons';
import { isSignInCancelled } from '@/lib/nativeApp';
import { emailAuthErrorKey, type AuthMode } from '@/lib/authErrors';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open on the e-mail sign-up form with this username filled in (the onboarding's chosen name). */
  signUpAs?: string;
}

export default function AuthModal({ isOpen, onClose, signUpAs }: Readonly<AuthModalProps>) {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useUserStore();
  // English while no language is chosen yet (unlike the app-wide 'hu' default; pre-T24 behaviour).
  const t = useT({ fallback: 'en' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>(signUpAs === undefined ? 'signin' : 'signup');
  const [showEmailForm, setShowEmailForm] = useState(signUpAs !== undefined);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(signUpAs ?? '');

  if (!isOpen) return null;

  // Helper functions for dynamic text to avoid nested ternaries
  const getTitle = () => {
    if (!showEmailForm) return t('authWelcome');
    return mode === 'signin' ? t('authSignIn') : t('authSignUp');
  };

  const getDescription = () => {
    if (!showEmailForm) return t('authWelcomeDesc');
    return mode === 'signin' ? t('authSignInDesc') : t('authSignUpDesc');
  };

  const handleProviderSignIn = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      onClose();
      resetForm();
    } catch (err) {
      // The app's account picker closed: the sheet stays, without an error.
      if (isSignInCancelled(err)) return;
      console.error('Google sign-in error:', err);
      setError(t('authErrGoogle'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        if (!username.trim() || username.length < 3) {
          setError(t('authErrUsername'));
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, username);
      }
      onClose();
      resetForm();
    } catch (err) {
      setError(t(emailAuthErrorKey((err as { code?: string }).code, mode)));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError(null);
    setShowEmailForm(false);
    setMode('signin');
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
  };

  return (
    <ModalShell
      variant="glass"
      z="modal"
      onBackdropClick={onClose}
      backdropLabel="Close authentication modal"
      panelClassName="max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-8"
      panelStyle={SAFE_AREA_MARGINS}
    >
        {/* Close Button */}
        <button
          onClick={() => {
            onClose();
            resetForm();
          }}
          className="no-min-size absolute top-3 right-3 w-11 h-11 grid place-items-center rounded-full touch-manipulation"
          aria-label="Close"
        >
          <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
            <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
          </span>
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-[72px] h-[72px] rounded-[22px] grid place-items-center bg-brand-500/15">
            <LogIn className="w-9 h-9 text-brand-400" strokeWidth={1.75} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {getTitle()}
        </h2>
        <p className="text-white/70 text-center mb-8">
          {getDescription()}
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-red-200 text-sm text-center">{error}</p>
          </div>
        )}

        {showEmailForm ? (
          // Email form view
          <AuthEmailForm
            mode={mode}
            loading={loading}
            email={email}
            password={password}
            username={username}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onUsernameChange={setUsername}
            onSubmit={handleEmailAuth}
            onToggleMode={toggleMode}
            onBack={() => {
              setShowEmailForm(false);
              setError(null);
            }}
          />
        ) : (
          // Initial view - Choose authentication method
          <AuthProviderButtons
            loading={loading}
            onProvider={(provider) => void handleProviderSignIn(provider)}
            onEmail={() => setShowEmailForm(true)}
          />
        )}

        {/* Sign-in-wrap (A1): signing in or up accepts the terms; both documents are linked */}
        <LegalNotice textKey="authTerms" className="text-white/50 text-xs text-center mt-6 leading-relaxed" />
    </ModalShell>
  );
}
