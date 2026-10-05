import type { CSSProperties } from 'react';
import type { OnboardingStep } from '@/lib/onboarding';
import { sceneIsScrimmed } from '@/lib/onboardingScene';
import s from './flow.module.css';

// The light over the demo map (story cards): a soft aurora in each step's colours that follows
// drags, the blurred scrim of the full-screen steps and the edge vignette. Decorative.

const AURORA: Readonly<Record<OnboardingStep, readonly [string, string, string]>> = {
  welcome: ['rgb(22 160 100 / .55)', 'rgb(10 100 214 / .45)', 'rgb(60 203 140 / .35)'],
  name: ['rgb(22 160 100 / .5)', 'rgb(13 106 64 / .5)', 'rgb(60 203 140 / .3)'],
  discover: ['rgb(10 100 214 / .45)', 'rgb(22 160 100 / .3)', 'rgb(111 211 255 / .25)'],
  add: ['rgb(255 122 0 / .4)', 'rgb(194 80 122 / .4)', 'rgb(22 160 100 / .3)'],
  levels: ['rgb(110 47 214 / .45)', 'rgb(255 122 0 / .35)', 'rgb(10 100 214 / .3)'],
  location: ['rgb(10 132 255 / .45)', 'rgb(10 100 214 / .35)', 'rgb(22 160 100 / .25)'],
  install: ['rgb(10 100 214 / .45)', 'rgb(22 160 100 / .4)', 'rgb(111 211 255 / .3)'],
  signup: ['rgb(22 160 100 / .5)', 'rgb(247 201 72 / .3)', 'rgb(10 100 214 / .3)'],
};

/** One aurora per step of the tour, cross-fading (gradients cannot transition their colours). */
export default function StageLight({ step, steps }: Readonly<{ step: OnboardingStep; steps: readonly OnboardingStep[] }>) {
  const scrim = sceneIsScrimmed(step);
  return (
    <>
      <div className={s.vignette} aria-hidden="true" />
      <div className={s.scrim} data-on={scrim} aria-hidden="true" />
      {steps.map((id) => {
        const [a1, a2, a3] = AURORA[id];
        return (
          <div
            key={id}
            className={s.aurora}
            data-on={id === step}
            data-dim={!sceneIsScrimmed(id)}
            aria-hidden="true"
            style={{ '--a1': a1, '--a2': a2, '--a3': a3 } as CSSProperties}
          >
            <i />
            <i />
            <i />
          </div>
        );
      })}
    </>
  );
}
