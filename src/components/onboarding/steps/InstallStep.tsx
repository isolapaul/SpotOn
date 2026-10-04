import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { installMode, stepCopy } from '@/lib/onboarding';
import type { TranslationKey } from '@/lib/translations';
import RichText from '@/components/ui/RichText';
import Button from '@/components/ui/Button';
import StepSheet, { riseDelay } from '../StepSheet';
import PhoneMock from './PhoneMock';
import s from '../flow.module.css';

// Add to the home screen (replaces the former full-screen install overlay). Chromium's own install
// dialog when the browser offers one, otherwise the steps for iPhone (Safari) or Android (Chrome).
// Shown only in a browser tab on the new domain (lib/onboarding onboardingSteps).

const GUIDES: Readonly<Record<'ios' | 'android', { heading: TranslationKey; steps: readonly { key: TranslationKey; hint?: TranslationKey }[] }>> = {
  ios: {
    heading: 'onboardingInstallIosHeading',
    steps: [{ key: 'onboardingInstallIosStep1', hint: 'onboardingInstallIosMoreHint' }, { key: 'onboardingInstallIosStep2' }, { key: 'onboardingInstallIosStep3' }],
  },
  android: {
    heading: 'onboardingInstallAndroidHeading',
    steps: [{ key: 'onboardingInstallAndroidStep1' }, { key: 'onboardingInstallAndroidStep2', hint: 'onboardingInstallAndroidAltHint' }, { key: 'onboardingInstallAndroidStep3' }],
  },
};

function Guide({ mode }: Readonly<{ mode: 'ios' | 'android' }>) {
  const t = useT();
  const guide = GUIDES[mode];
  return (
    <div className={`${s.rise} mt-3`} style={riseDelay(560)}>
      <h3 className="text-[14px] font-semibold text-label-secondary">{t(guide.heading)}</h3>
      <ol className="mt-2 grid gap-2">
        {guide.steps.map((step, i) => (
          <li key={step.key} className="flex gap-3 items-start text-[15px] leading-snug text-label-secondary">
            <span className="w-[26px] h-[26px] shrink-0 rounded-full grid place-items-center text-[13px] font-bold bg-brand-500/18 text-brand-300" aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <RichText text={t(step.key)} />
              {step.hint && (
                <span className="block mt-0.5 text-[13px] text-label-tertiary">
                  <RichText text={t(step.hint)} strongClassName="font-semibold text-label-secondary" />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InstallStep({ onNext }: Readonly<{ onNext: () => void }>) {
  const t = useT();
  const canPrompt = useOnboardingStore((st) => st.installPrompt !== null);
  const promptInstall = useOnboardingStore((st) => st.promptInstall);
  // Decided once per visit of the step: the offer is used up by the dialog.
  const [mode] = useState(() => installMode(canPrompt, globalThis.navigator?.userAgent ?? '', globalThis.navigator?.maxTouchPoints ?? 0));
  const [installing, setInstalling] = useState(false);
  const copy = stepCopy('install', { returning: false, hasName: false });

  const install = async () => {
    setInstalling(true);
    await promptInstall();
    setInstalling(false);
    onNext();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 grid place-items-center py-3 [@media(max-height:760px)]:hidden">
        <div className={s.pop} style={riseDelay(250)}>
          <PhoneMock />
        </div>
      </div>
      <StepSheet>
        <h2 className={`${s.rise} mt-3 mb-1.5 text-[clamp(25px,7.6vw,30px)] leading-[1.1] font-bold tracking-[-0.03em] text-balance`} style={riseDelay(450)}>
          {t(copy.title)}
        </h2>
        <p className={`${s.rise} text-[15px] leading-[1.45] text-label-secondary text-pretty`} style={riseDelay(500)}>
          {t(copy.body)}
        </p>
        {mode !== 'prompt' && <Guide mode={mode} />}
        <div className={`${s.rise} mt-4 grid gap-1`} style={riseDelay(640)}>
          {mode === 'prompt' ? (
            <Button block onClick={install} disabled={installing} data-autofocus>
              {installing ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Download className="w-5 h-5" strokeWidth={2.2} aria-hidden="true" />}
              {t('onboardingInstallNow')}
            </Button>
          ) : (
            <Button block onClick={onNext} data-autofocus>
              {t('done')}
            </Button>
          )}
          <Button variant="plain" block className="text-label-secondary! font-medium text-[16px]" disabled={installing} onClick={onNext}>
            {t('notNow')}
          </Button>
        </div>
      </StepSheet>
    </div>
  );
}
