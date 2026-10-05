import { AtSign, Check, CircleAlert, CircleCheck, Loader2, UserRound } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useUsernameHint } from '@/hooks/useUsernameHint';
import { USERNAME_MAX_LENGTH, canContinueWithName, sanitizeUsernameInput, stepCopy, type UsernameHint } from '@/lib/onboarding';
import type { TranslationKey } from '@/lib/translations';
import Button from '@/components/ui/Button';
import LevelBadge from '@/components/ui/LevelBadge';
import StepSheet, { riseDelay } from '../StepSheet';
import s from '../flow.module.css';

const RING = 2 * Math.PI * 53;

const HINT: Readonly<Record<UsernameHint, { key: TranslationKey; tone: string }>> = {
  empty: { key: 'onboardingNameRule', tone: 'text-label-tertiary' },
  invalid: { key: 'onboardingNameRule', tone: 'text-warn-500' },
  checking: { key: 'onboardingNameChecking', tone: 'text-label-tertiary' },
  available: { key: 'onboardingNameAvailable', tone: 'text-brand-400' },
  taken: { key: 'usernameTaken', tone: 'text-danger-400' },
  failed: { key: 'onboardingNameCheckFailed', tone: 'text-warn-500' },
};

function HintIcon({ hint }: Readonly<{ hint: UsernameHint }>) {
  const cls = 'w-[15px] h-[15px] mt-px shrink-0';
  if (hint === 'checking') return <Loader2 className={`${cls} animate-spin`} aria-hidden="true" />;
  if (hint === 'available') return <CircleCheck className={cls} strokeWidth={2.4} aria-hidden="true" />;
  if (hint === 'empty') return null;
  return <CircleAlert className={cls} strokeWidth={2.4} aria-hidden="true" />;
}

/** The avatar fills its ring as the name becomes usable; the greeting follows the typing. */
function Hero({ name, ready }: Readonly<{ name: string; ready: boolean }>) {
  const t = useT();
  const progress = ready ? 1 : Math.min(name.length / 3, 1) * 0.33;
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-6 py-3 text-center" aria-hidden="true">
      <span className={`${s.pop} relative w-[112px] h-[112px] shrink-0 [@media(max-height:700px)]:w-[76px] [@media(max-height:700px)]:h-[76px]`} style={riseDelay(300)}>
        <svg viewBox="0 0 112 112" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="56" cy="56" r="53" fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="3" />
          <circle
            cx="56"
            cy="56"
            r="53"
            fill="none"
            stroke="#34C759"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-700 ease-ios"
          />
        </svg>
        <span
          key={name.charAt(0)}
          className={`${s.pop} absolute inset-[9%] rounded-full grid place-items-center bg-linear-145 from-[#1aa86a] to-brand-700 text-white text-[44px] font-bold shadow-[0_16px_36px_rgb(0_0_0/0.4)] [@media(max-height:700px)]:text-[30px]`}
        >
          {name ? name.charAt(0).toUpperCase() : <UserRound className="w-[46%] h-[46%] text-white/85" strokeWidth={1.8} />}
        </span>
        {ready && <LevelBadge level={1} size={32} className={`${s.pop} absolute -right-0.5 -bottom-0.5`} />}
      </span>
      <p className="min-h-8 max-w-full text-[26px] font-bold tracking-[-0.02em] leading-tight [overflow-wrap:anywhere] [@media(max-height:700px)]:text-[20px]">
        {name ? t('onboardingNameGreeting', { name }) : ''}
      </p>
    </div>
  );
}

interface NameStepProps {
  name: string;
  onName: (name: string) => void;
  onNext: () => void;
  onLater: () => void;
}

export default function NameStep({ name, onName, onNext, onLater }: Readonly<NameStepProps>) {
  const t = useT();
  const hint = useUsernameHint(name);
  const ready = canContinueWithName(name, hint);
  const copy = stepCopy('name', { returning: false, hasName: false });
  const { key, tone } = HINT[hint];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Hero name={name} ready={ready} />
      <StepSheet>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onNext();
          }}
        >
          <h2 className={`${s.rise} mt-3 mb-1.5 text-[clamp(25px,7.6vw,30px)] leading-[1.1] font-bold tracking-[-0.03em] text-balance`} style={riseDelay(450)}>
            {t(copy.title)}
          </h2>
          <p className={`${s.rise} text-[15px] leading-[1.45] text-label-secondary text-pretty`} style={riseDelay(500)}>
            {t(copy.body)}
          </p>
          <div className={`${s.rise} relative mt-4`} style={riseDelay(560)}>
            <label htmlFor="onboarding-username" className="sr-only absolute!">
              {t('username')}
            </label>
            <AtSign className="absolute left-[15px] top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" aria-hidden="true" />
            <input
              id="onboarding-username"
              data-autofocus
              value={name}
              onChange={(e) => onName(sanitizeUsernameInput(e.target.value))}
              placeholder={t('usernamePlaceholder')}
              maxLength={USERNAME_MAX_LENGTH}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-describedby="onboarding-username-hint"
              aria-invalid={hint === 'invalid' || hint === 'taken' || undefined}
              className="w-full h-14 pl-[46px] pr-12 rounded-2xl bg-surface-3 text-[18px] font-medium text-label placeholder:text-white/35 select-text
                outline-hidden focus:ring-2 focus:ring-brand-500 transition-shadow"
            />
            {ready && <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400" strokeWidth={2.8} aria-hidden="true" />}
          </div>
          <p id="onboarding-username-hint" aria-live="polite" className={`mt-2 min-h-9 flex gap-1.5 items-start text-[13px] leading-[1.35] ${tone}`}>
            <HintIcon hint={hint} />
            <span>
              {t(key)}
              {hint === 'available' && <span className="block text-label-tertiary">{t('onboardingNameReserveNote')}</span>}
            </span>
          </p>
          <div className={`${s.rise} mt-2 grid gap-1`} style={riseDelay(620)}>
            <Button type="submit" block disabled={!ready}>
              {t('onboardingNext')}
            </Button>
            <Button variant="plain" block className="text-label-secondary! font-medium text-[16px]" onClick={onLater}>
              {t('onboardingNameLater')}
            </Button>
          </div>
        </form>
      </StepSheet>
    </div>
  );
}
