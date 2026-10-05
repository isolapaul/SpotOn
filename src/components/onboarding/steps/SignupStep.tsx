import { useState } from 'react';
import { Heart, Loader2, Mail, MapPin, MessageCircle, Star, Trophy, Bookmark } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { stepCopy } from '@/lib/onboarding';
import LegalNotice from '@/components/legal/LegalNotice';
import Button from '@/components/ui/Button';
import StepSheet, { riseDelay } from '../StepSheet';
import ScenePin from '../ScenePin';
import s from '../flow.module.css';
import st from './steps.module.css';

// The last step for signed-out visitors: the existing sign-in flows (Google through the user store,
// e-mail through the sign-in sheet's sign-up form, prefilled with the chosen name). Signing up here
// accepts the terms exactly as the sign-in sheet does (A1): the same sentence, the same links.

const BENEFITS = [
  { icon: Heart, key: 'onboardingSignupBenefit1' },
  { icon: MapPin, key: 'onboardingSignupBenefit2' },
  { icon: Trophy, key: 'onboardingSignupBenefit3' },
] as const;

const FLOATIES = [
  { icon: Heart, color: 'text-[#ff6b81]', x: 10, y: 50, d: 0 },
  { icon: Star, color: 'text-gold', x: 70, y: 6, d: 150 },
  { icon: Bookmark, color: 'text-brand-400', x: 140, y: 40, d: 300 },
  { icon: MessageCircle, color: 'text-[#6fb6ff]', x: 196, y: 0, d: 450 },
] as const;

function GoogleMark() {
  return (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

interface SignupStepProps {
  name: string | null;
  /** Opens the sign-in sheet's e-mail sign-up form (the flow renders it over the tour). */
  onEmail: () => void;
  onLater: () => void;
}

export default function SignupStep({ name, onEmail, onLater }: Readonly<SignupStepProps>) {
  const t = useT();
  const signInWithGoogle = useUserStore((u) => u.signInWithGoogle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const copy = stepCopy('signup', { returning: false, hasName: !!name });

  const google = async () => {
    setBusy(true);
    setError(false);
    // Google may leave the page (redirect sign-in): the tour counts as done before it does.
    useOnboardingStore.getState().complete();
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in from the tour failed:', err);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 grid place-items-center [@media(max-height:780px)]:hidden" aria-hidden="true">
        <div className="relative w-60 h-[104px] -translate-y-2">
          {FLOATIES.map(({ icon: Icon, color, x, y, d }) => (
            <span key={x} className={`${st.floatie} material-sheet ${color}`} style={{ left: x, top: y, animationDelay: `${d}ms, ${d + 600}ms` }}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={2.2} />
            </span>
          ))}
          <span className={`${st.floatie} shadow-none!`} style={{ left: 98, top: 46, animationDelay: '200ms, 800ms' }}>
            <ScenePin category="scenic" />
          </span>
        </div>
      </div>
      <StepSheet>
        {name && (
          <p className={`${s.rise} mt-3 inline-flex max-w-full items-center gap-2 h-8 [@media(max-height:640px)]:hidden pl-1 pr-3 rounded-full bg-white/8 text-[14px] font-semibold text-label-secondary`} style={riseDelay(420)}>
            <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center bg-linear-145 from-[#1aa86a] to-brand-700 text-[12px] font-bold text-white" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate">@{name}</span>
          </p>
        )}
        <h2 className={`${s.rise} mt-3 mb-1.5 text-[24px] leading-[1.15] font-bold tracking-[-0.025em] text-balance [overflow-wrap:anywhere]`} style={riseDelay(460)}>
          {t(copy.title, { name: name ?? '' })}
        </h2>
        <p className={`${s.rise} text-[15px] leading-[1.45] text-label-secondary text-pretty [@media(max-height:640px)]:hidden`} style={riseDelay(520)}>
          {t(copy.body)}
        </p>
        <ul className="mt-3.5 mb-4 grid gap-2.5 [@media(max-height:700px)]:hidden">
          {BENEFITS.map(({ icon: Icon, key }, i) => (
            <li key={key} className={`${s.rise} flex items-center gap-3 text-[15px] font-medium`} style={riseDelay(600 + i * 80)}>
              <span className="w-8 h-8 shrink-0 rounded-[10px] grid place-items-center bg-brand-500/16 text-brand-300" aria-hidden="true">
                <Icon className="w-[17px] h-[17px]" strokeWidth={2.2} />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-danger-500/15 px-3 py-2 text-[14px] text-[#ffb3ad]">
            {t('authErrGoogle')}
          </p>
        )}
        <div className={`${s.rise} grid gap-2.5 [@media(max-height:700px)]:mt-4`} style={riseDelay(760)}>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            data-autofocus
            className="no-min-size h-[50px] w-full rounded-full bg-white text-ink text-[17px] font-semibold inline-flex items-center justify-center gap-2.5
              touch-manipulation transition-transform duration-150 active:scale-[.97] disabled:opacity-60
              focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <GoogleMark />}
            {t('onboardingSignupGoogle')}
          </button>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="flex-1 h-px bg-white/10" />
            <span className="text-[13px] text-label-tertiary">{t('authOr')}</span>
            <span className="flex-1 h-px bg-white/10" />
          </div>
          <Button variant="gray" block disabled={busy} onClick={onEmail}>
            <Mail className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            {t('onboardingSignupEmail')}
          </Button>
          <Button variant="plain" block className="text-label-secondary! font-medium text-[16px]" disabled={busy} onClick={onLater}>
            {t('onboardingSignupLater')}
          </Button>
        </div>
        <LegalNotice textKey="authTerms" className={`${s.fade} mt-3 text-[12px] leading-[1.45] text-white/50 text-center text-pretty`} />
      </StepSheet>
    </div>
  );
}
