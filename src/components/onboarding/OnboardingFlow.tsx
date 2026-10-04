'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useStepSwipe } from '@/hooks/useStepSwipe';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';
import { getMovedTo } from '@/lib/movedTo';
import { stripBold } from '@/lib/i18n';
import { Z } from '@/lib/constants';
import {
  canAdvanceByGesture,
  doneMessage,
  isStandaloneLaunch,
  onboardingSteps,
  stepCopy,
  type OnboardingStep,
} from '@/lib/onboarding';
import AuthModal from '@/components/AuthModal';
import MapScene from './MapScene';
import StageLight from './StageLight';
import ProgressSegments from './ProgressSegments';
import LanguageChip from './LanguageChip';
import DoneBanner from './DoneBanner';
import StepContent, { type StepContentProps } from './StepContent';
import s from './flow.module.css';

// The first-run tour (lazy, client only; page.tsx mounts it while it is due). A modal dialog over
// the app: the demo map scene with a camera, the step cards on top, story-style progress, swipes,
// arrow keys and Tab kept inside. It ends on the live map with a closing line.

const LEAVE_MS = 340;
const BANNER_MS = 3200;
const BANNER_OUT_MS = 350;

type Dir = 'fwd' | 'back';

function launchContext() {
  const nav = globalThis.navigator as Navigator & { standalone?: boolean };
  return {
    signedIn: useUserStore.getState().user !== null,
    standalone: isStandaloneLaunch({
      displayStandalone: globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false,
      iosStandalone: nav.standalone === true,
      referrer: globalThis.document?.referrer ?? '',
    }),
    movedDomain: getMovedTo() !== null,
  };
}

export default function OnboardingFlow() {
  const t = useT();
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  // Decided when the tour starts (signing up on its last step must not change the steps).
  const [ctx] = useState(launchContext);
  const [returningName] = useState(() => useUserStore.getState().user?.username ?? null);
  const steps = useMemo(() => onboardingSteps(ctx), [ctx]);
  const pending = useOnboardingStore((o) => o.pendingUsername);
  const locationChoice = useOnboardingStore((o) => o.locationChoice);
  const [name, setName] = useState(() => pending ?? '');
  const [view, setView] = useState<{ index: number; dir: Dir; leaving: { step: OnboardingStep; dir: Dir } | null }>({ index: 0, dir: 'fwd', leaving: null });
  const [phase, setPhase] = useState<'tour' | 'banner' | 'bannerOut'>('tour');
  const [emailOpen, setEmailOpen] = useState(false);
  // The closing line's name, fixed when the tour ends (a sign-up then clears the pending name).
  const [doneName, setDoneName] = useState<string | null>(null);

  const step = steps[view.index];
  const greetName = ctx.signedIn ? returningName : pending;
  const closing = phase !== 'tour';

  useEffect(() => {
    useOnboardingStore.getState().start();
  }, []);

  const finish = useCallback(() => {
    if (closing) return;
    const store = useOnboardingStore.getState();
    setDoneName(ctx.signedIn ? returningName : store.pendingUsername);
    store.complete();
    setEmailOpen(false);
    setPhase('banner');
  }, [closing, ctx.signedIn, returningName]);

  // The closing line, then the tour unmounts (page.tsx: running false).
  useEffect(() => {
    if (phase === 'tour') return;
    const timer = setTimeout(
      () => (phase === 'banner' ? setPhase('bannerOut') : useOnboardingStore.getState().close()),
      phase === 'banner' ? BANNER_MS : BANNER_OUT_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  // Signed up or in from the last step (Google popup, or the e-mail form): straight to the map.
  useEffect(() => {
    if (ctx.signedIn) return;
    return useUserStore.subscribe((now, before) => {
      if (now.user && !before.user) finish();
    });
  }, [ctx.signedIn, finish]);

  const go = useCallback(
    (index: number) => {
      if (closing || index < 0 || index === view.index) return;
      if (index >= steps.length) return finish();
      const dir: Dir = index > view.index ? 'fwd' : 'back';
      setView({ index, dir, leaving: reduced ? null : { step: steps[view.index], dir } });
    },
    [closing, view.index, steps, finish, reduced],
  );
  const next = useCallback(() => go(view.index + 1), [go, view.index]);
  const back = useCallback(() => go(view.index - 1), [go, view.index]);

  useEffect(() => {
    if (!view.leaving) return;
    const timer = setTimeout(() => setView((v) => ({ ...v, leaving: null })), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [view.leaving]);

  // A swipe passes the name step only with a name already confirmed by its Next button.
  const canNext = canAdvanceByGesture(step, { nameReady: name !== '' && name === pending, locationAnswered: locationChoice !== null });
  const interactive = !closing && !emailOpen;

  useStepSwipe(root, { enabled: interactive, follow: !reduced, canNext, canBack: view.index > 0, onNext: next, onBack: back });
  useFocusTrap(root, interactive);

  // Arrow keys step like swipes (not inside a text field, where they move the caret).
  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.('input, textarea, [role="menu"]')) return;
      if (e.key === 'ArrowRight' && canNext) next();
      else if (e.key === 'ArrowLeft') back();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [interactive, canNext, next, back]);

  // Each step starts on its main control (Tab order and Enter continue from there).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const layer = root.current?.querySelector<HTMLElement>('[data-leaving="false"]');
      const target = layer?.querySelector<HTMLElement>('[data-autofocus]') ?? root.current;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view.index]);

  const copy = stepCopy(step, { returning: ctx.signedIn, hasName: !!greetName });
  const announcement = `${t(copy.title, { name: greetName ?? '' })}. ${stripBold(t(copy.body))}`;
  const done = doneMessage({ returning: ctx.signedIn, name: doneName });

  const contentProps: Omit<StepContentProps, 'step'> = {
    returning: ctx.signedIn,
    greetName,
    name,
    onName: setName,
    onNext: next,
    onBack: back,
    onNameNext: () => {
      useOnboardingStore.getState().setPendingUsername(name);
      next();
    },
    onNameLater: () => {
      useOnboardingStore.getState().setPendingUsername(null);
      setName('');
      next();
    },
    onEmail: () => setEmailOpen(true),
    onFinish: finish,
  };

  return (
    <>
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboardingDialogLabel')}
        tabIndex={-1}
        data-step={step}
        data-closing={closing}
        className={`${s.stage} fixed inset-0 ${Z.onboarding} overflow-hidden text-label select-none`}
      >
        <MapScene step={step} closing={closing} reducedMotion={reduced} locationChoice={locationChoice} />
        <StageLight step={step} steps={steps} />
        <div className="absolute inset-x-0 top-0 z-10 h-[calc(env(safe-area-inset-top,0px)+44px)] flex items-center gap-2 pl-2 pr-4 pt-[env(safe-area-inset-top,0px)] max-w-[560px] mx-auto">
          <button
            type="button"
            onClick={back}
            disabled={view.index === 0 || closing}
            aria-label={t('onboardingPrevStep')}
            className="no-min-size w-11 h-11 shrink-0 grid place-items-center rounded-full text-label-secondary touch-manipulation transition-opacity
              disabled:opacity-0 active:bg-white/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <ProgressSegments index={view.index} total={steps.length} />
          {step === 'welcome' && <LanguageChip />}
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {view.leaving && (
          <StepLayer key={`${view.leaving.step}-out`} dir={view.leaving.dir} leaving>
            <StepContent step={view.leaving.step} {...contentProps} />
          </StepLayer>
        )}
        <StepLayer key={step} dir={view.dir} leaving={false}>
          <StepContent step={step} {...contentProps} />
        </StepLayer>
        {emailOpen && <AuthModal isOpen onClose={() => setEmailOpen(false)} signUpAs={pending ?? ''} />}
      </div>
      {closing && <DoneBanner text={t(done.key, done.vars)} leaving={phase === 'bannerOut'} />}
    </>
  );
}

function StepLayer({ dir, leaving, children }: Readonly<{ dir: Dir; leaving: boolean; children: React.ReactNode }>) {
  return (
    <div
      className={`${s.layer} px-[max(8px,env(safe-area-inset-left,0px))] pt-[calc(env(safe-area-inset-top,0px)+48px)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)]`}
      data-dir={dir}
      data-leaving={leaving}
      aria-hidden={leaving || undefined}
      inert={leaving}
    >
      <div className={`${s.content} mx-auto h-full w-full max-w-[520px] flex flex-col overflow-y-auto overscroll-contain scrollbar-hide`}>{children}</div>
    </div>
  );
}
