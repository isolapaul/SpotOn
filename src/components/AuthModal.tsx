'use client';

import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { LogIn, X, Mail, Lock, User } from 'lucide-react';
import { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: Readonly<AuthModalProps>) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useUserStore();
  const { language } = useLanguageStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  // Translations
  const texts = {
    hu: {
      welcome: 'Üdvözöl a SpotOn',
      welcomeDesc: 'Jelentkezz be vagy regisztrálj a kedvenc helyeid mentéséhez',
      signIn: 'Bejelentkezés',
      signUp: 'Regisztráció',
      signInDesc: 'Jelentkezz be az email címeddel',
      signUpDesc: 'Hozz létre új fiókot',
      signingIn: 'Bejelentkezés...',
      googleWith: 'Google-lel',
      or: 'vagy',
      emailWith: 'Email címmel',
      name: 'Név',
      email: 'Email',
      password: 'Jelszó',
      namePlaceholder: 'Neved',
      emailPlaceholder: 'email@pelda.com',
      passwordPlaceholder: '••••••••',
      passwordHint: 'Legalább 6 karakter',
      noAccount: 'Még nincs fiókod? Regisztrálj',
      haveAccount: 'Van már fiókod? Jelentkezz be',
      back: '← Vissza',
      terms: 'A bejelentkezéssel elfogadod az Általános Szerződési Feltételeket és az Adatvédelmi Szabályzatot',
      errors: {
        google: 'Google bejelentkezés sikertelen. Próbáld újra.',
        name: 'Add meg a neved!',
        invalidEmail: 'Érvénytelen email cím.',
        wrongPassword: 'Hibás email vagy jelszó.',
        emailInUse: 'Ez az email cím már használatban van.',
        weakPassword: 'A jelszónak legalább 6 karakter hosszúnak kell lennie.',
        invalidCredential: 'Hibás bejelentkezési adatok.',
        signInFailed: 'Bejelentkezés sikertelen.',
        signUpFailed: 'Regisztráció sikertelen.',
      }
    },
    de: {
      welcome: 'Willkommen bei SpotOn',
      welcomeDesc: 'Melde dich an oder registriere dich, um deine Lieblingsorte zu speichern',
      signIn: 'Anmelden',
      signUp: 'Registrieren',
      signInDesc: 'Melde dich mit deiner E-Mail an',
      signUpDesc: 'Erstelle ein neues Konto',
      signingIn: 'Anmeldung...',
      googleWith: 'Mit Google',
      or: 'oder',
      emailWith: 'Mit E-Mail',
      name: 'Name',
      email: 'E-Mail',
      password: 'Passwort',
      namePlaceholder: 'Dein Name',
      emailPlaceholder: 'email@beispiel.de',
      passwordPlaceholder: '••••••••',
      passwordHint: 'Mindestens 6 Zeichen',
      noAccount: 'Noch kein Konto? Registrieren',
      haveAccount: 'Schon ein Konto? Anmelden',
      back: '← Zurück',
      terms: 'Mit der Anmeldung akzeptierst du die Allgemeinen Geschäftsbedingungen und die Datenschutzerklärung',
      errors: {
        google: 'Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
        name: 'Bitte gib deinen Namen ein!',
        invalidEmail: 'Ungültige E-Mail-Adresse.',
        wrongPassword: 'Falsche E-Mail oder Passwort.',
        emailInUse: 'Diese E-Mail-Adresse wird bereits verwendet.',
        weakPassword: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        invalidCredential: 'Ungültige Anmeldedaten.',
        signInFailed: 'Anmeldung fehlgeschlagen.',
        signUpFailed: 'Registrierung fehlgeschlagen.',
      }
    },
    en: {
      welcome: 'Welcome to SpotOn',
      welcomeDesc: 'Sign in or register to save your favorite spots',
      signIn: 'Sign In',
      signUp: 'Sign Up',
      signInDesc: 'Sign in with your email',
      signUpDesc: 'Create a new account',
      signingIn: 'Signing in...',
      googleWith: 'With Google',
      or: 'or',
      emailWith: 'With Email',
      name: 'Name',
      email: 'Email',
      password: 'Password',
      namePlaceholder: 'Your name',
      emailPlaceholder: 'email@example.com',
      passwordPlaceholder: '••••••••',
      passwordHint: 'At least 6 characters',
      noAccount: 'No account yet? Sign up',
      haveAccount: 'Already have an account? Sign in',
      back: '← Back',
      terms: 'By signing in, you agree to our Terms of Service and Privacy Policy',
      errors: {
        google: 'Google sign in failed. Please try again.',
        name: 'Please enter your name!',
        invalidEmail: 'Invalid email address.',
        wrongPassword: 'Wrong email or password.',
        emailInUse: 'This email address is already in use.',
        weakPassword: 'Password must be at least 6 characters long.',
        invalidCredential: 'Invalid credentials.',
        signInFailed: 'Sign in failed.',
        signUpFailed: 'Sign up failed.',
      }
    }
  };

  const t = texts[language as keyof typeof texts] || texts.en;

  // Helper functions for dynamic text to avoid nested ternaries
  const getTitle = () => {
    if (!showEmailForm) return t.welcome;
    return mode === 'signin' ? t.signIn : t.signUp;
  };

  const getDescription = () => {
    if (!showEmailForm) return t.welcomeDesc;
    return mode === 'signin' ? t.signInDesc : t.signUpDesc;
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
      onClose();
      resetForm();
    } catch (err) {
      setError(t.errors.google);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        if (!name.trim()) {
          setError(t.errors.name);
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
      }
      onClose();
      resetForm();
    } catch (err: any) {
      // Firebase error handling
      if (err.code === 'auth/invalid-email') {
        setError(t.errors.invalidEmail);
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t.errors.wrongPassword);
      } else if (err.code === 'auth/email-already-in-use') {
        setError(t.errors.emailInUse);
      } else if (err.code === 'auth/weak-password') {
        setError(t.errors.weakPassword);
      } else if (err.code === 'auth/invalid-credential') {
        setError(t.errors.invalidCredential);
      } else {
        setError(mode === 'signin' ? t.errors.signInFailed : t.errors.signUpFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError(null);
    setShowEmailForm(false);
    setMode('signin');
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close authentication modal"
        tabIndex={-1}
      />
      
      {/* Modal */}
      <div className="relative glass-card max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-8 animate-slide-up"
        style={{ 
          marginTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            onClose();
            resetForm();
          }}
          className="absolute top-4 right-4 glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="glass-button p-4 rounded-full">
            <LogIn className="w-12 h-12 text-white" strokeWidth={1.5} />
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
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {/* Name field (only for signup) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-white/80 text-sm font-medium mb-2">
                  {t.name}
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 
                      text-white placeholder-white/50 focus:outline-none focus:ring-2 
                      focus:ring-primary-500 focus:border-transparent transition-all"
                    required={mode === 'signup'}
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-white/80 text-sm font-medium mb-2">
                {t.email}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 
                    text-white placeholder-white/50 focus:outline-none focus:ring-2 
                    focus:ring-primary-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-white/80 text-sm font-medium mb-2">
                {t.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 
                    text-white placeholder-white/50 focus:outline-none focus:ring-2 
                    focus:ring-primary-500 focus:border-transparent transition-all"
                  required
                  minLength={6}
                />
              </div>
              {mode === 'signup' && (
                <p className="text-white/50 text-xs mt-1">{t.passwordHint}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
                bg-primary-500 text-white shadow-lg
                hover:bg-primary-600 hover:shadow-xl active:scale-98
                transition-all duration-200
                flex items-center justify-center gap-3
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'signin' ? t.signingIn : t.signUp + '...'}</span>
                </>
              ) : (
                <span>{mode === 'signin' ? t.signIn : t.signUp}</span>
              )}
            </button>

            {/* Toggle between signin/signup */}
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-white/70 hover:text-white text-sm transition-colors"
              >
                {mode === 'signin' ? t.noAccount : t.haveAccount}
              </button>
            </div>

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setShowEmailForm(false);
                setError(null);
              }}
              className="w-full py-3 text-white/60 hover:text-white text-sm transition-colors"
            >
              {t.back}
            </button>
          </form>
        ) : (
          // Initial view - Choose authentication method
          <div className="space-y-3">
            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
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
                  <span>{t.signingIn}</span>
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
                  <span>{t.googleWith}</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-900/50 text-white/60">{t.or}</span>
              </div>
            </div>

            {/* Email Sign In Button */}
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
                glass-button text-white shadow-lg
                hover:shadow-xl active:scale-98
                transition-all duration-200
                flex items-center justify-center gap-3"
            >
              <Mail className="w-6 h-6" />
              <span>{t.emailWith}</span>
            </button>
          </div>
        )}

        {/* Privacy Note */}
        {!showEmailForm && (
          <p className="text-white/50 text-xs text-center mt-6">
            {t.terms}
          </p>
        )}
      </div>
    </div>
  );
}
