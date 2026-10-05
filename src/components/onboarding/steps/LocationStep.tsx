import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Info, Loader2, LocateFixed, Navigation, ShieldCheck } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useLocationStore } from '@/store/useLocationStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { LOCATION_RESULT_KEY, locationChoiceOf, stepCopy } from '@/lib/onboarding';
import Button from '@/components/ui/Button';
import StepSheet, { riseDelay } from '../StepSheet';
import s from '../flow.module.css';

/**
 * The location primer: the browser asks only after "Use my location" (the location store's manual
 * request). The map's automatic request waits for the tour, and after "Not now" for the session.
 */
export default function LocationStep({ onNext }: Readonly<{ onNext: () => void }>) {
  const t = useT();
  const choice = useOnboardingStore((st) => st.locationChoice);
  const setChoice = useOnboardingStore((st) => st.setLocationChoice);
  const request = useLocationStore((st) => st.request);
  const [asking, setAsking] = useState(false);
  const actions = useRef<HTMLDivElement>(null);

  // The answer replaces the two buttons with Next: keep the keyboard focus on it.
  useEffect(() => {
    if (choice) actions.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [choice]);
  const copy = stepCopy('location', { returning: false, hasName: false });

  const allow = async () => {
    setAsking(true);
    try {
      setChoice(locationChoiceOf(await request()));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-end">
      <StepSheet>
        <span className={`${s.pop} mt-3 w-14 h-14 rounded-[18px] grid place-items-center bg-locate/16 text-[#5aa9ff]`} style={riseDelay(300)} aria-hidden="true">
          <LocateFixed className="w-7 h-7" strokeWidth={2} />
        </span>
        <p className={`${s.rise} mt-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6fb6ff]`} style={riseDelay(420)}>
          {t(copy.eyebrow ?? copy.title)}
        </p>
        <h2 className={`${s.rise} mt-1 mb-1.5 text-[clamp(25px,7.6vw,30px)] leading-[1.1] font-bold tracking-[-0.03em] text-balance`} style={riseDelay(460)}>
          {t(copy.title)}
        </h2>
        <p className={`${s.rise} text-[15px] leading-[1.45] text-label-secondary text-pretty`} style={riseDelay(520)}>
          {t(copy.body)}
        </p>
        <p className={`${s.rise} mt-3 flex gap-2 items-start text-[13px] leading-snug text-label-tertiary`} style={riseDelay(580)}>
          <ShieldCheck className="w-4 h-4 mt-px shrink-0 text-brand-400" strokeWidth={2.2} aria-hidden="true" />
          {t('onboardingLocationPrivacy')}
        </p>
        <p aria-live="polite" className="empty:hidden mt-3 flex gap-2 items-start text-[15px] font-medium leading-snug">
          {choice && (
            <>
              {choice === 'allowed' ? (
                <CircleCheck className="w-[18px] h-[18px] mt-px shrink-0 text-brand-400" strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Info className="w-[18px] h-[18px] mt-px shrink-0 text-label-secondary" strokeWidth={2.4} aria-hidden="true" />
              )}
              {t(LOCATION_RESULT_KEY[choice])}
            </>
          )}
        </p>
        <div ref={actions} className={`${s.rise} mt-4 grid gap-1`} style={riseDelay(640)}>
          {choice ? (
            <Button block onClick={onNext} data-autofocus key="next">
              {t('onboardingNext')}
            </Button>
          ) : (
            <>
              <Button block onClick={allow} disabled={asking} data-autofocus className="max-[359px]:text-[16px]">
                {asking ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Navigation className="w-[18px] h-[18px]" strokeWidth={2.4} aria-hidden="true" />}
                {t('onboardingLocationAllow')}
              </Button>
              <Button variant="plain" block className="text-label-secondary! font-medium text-[16px]" disabled={asking} onClick={() => setChoice('skipped')}>
                {t('notNow')}
              </Button>
            </>
          )}
        </div>
      </StepSheet>
    </div>
  );
}
