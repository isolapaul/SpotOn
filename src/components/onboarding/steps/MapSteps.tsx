import type { ReactNode } from 'react';
import { Camera, CircleCheck, Map as MapIcon, MapPin, Plus, Trophy } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { stepCopy, type OnboardingStep } from '@/lib/onboarding';
import CoachCard from '../CoachCard';
import LevelsCard from './LevelsCard';
import s from '../flow.module.css';

// The steps on the live demo map: the coach card on top, the scene in the middle (a tap on its
// right part goes on, on its left part back, as in story viewers), and the levels card below.

interface MapStepProps {
  onNext: () => void;
  onBack: () => void;
}

function MapStepFrame({ step, icon, onNext, onBack, extra, bottom }: Readonly<MapStepProps & { step: OnboardingStep; icon: typeof MapIcon; extra?: ReactNode; bottom?: ReactNode }>) {
  const t = useT();
  const copy = stepCopy(step, { returning: false, hasName: false });
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <CoachCard icon={icon} eyebrow={t(copy.eyebrow ?? copy.title)} title={t(copy.title)} body={t(copy.body)} onNext={onNext}>
        {extra}
      </CoachCard>
      <div className="flex-1 min-h-6 flex" aria-hidden="true">
        <span className="basis-[40%]" onClick={onBack} />
        <span className="flex-1" onClick={onNext} />
      </div>
      {bottom}
    </div>
  );
}

export function DiscoverStep(props: Readonly<MapStepProps>) {
  return <MapStepFrame step="discover" icon={MapIcon} {...props} />;
}

const FLOW = [
  { icon: MapPin, key: 'onboardingAddFlowPlace' },
  { icon: Camera, key: 'onboardingAddFlowPhotos' },
  { icon: CircleCheck, key: 'onboardingAddFlowApproval' },
] as const;

export function AddStep(props: Readonly<MapStepProps>) {
  const t = useT();
  const chips = (
    <ol className="mt-3 flex flex-wrap items-center gap-1.5 [@media(max-height:700px)]:hidden">
      {FLOW.map(({ icon: Icon, key }, i) => (
        <li key={key} className={`${s.rise} flex items-center gap-1.5`} style={{ animationDelay: `${700 + i * 90}ms` }}>
          <span
            className={`h-[30px] pl-1.5 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap ${
              i === FLOW.length - 1 ? 'bg-brand-500/20 text-brand-200' : 'bg-white/8 text-label-secondary'
            }`}
          >
            <span className={`w-5 h-5 rounded-full grid place-items-center ${i === FLOW.length - 1 ? 'bg-brand-500 text-white' : 'bg-white/14 text-white'}`}>
              <Icon className="w-3 h-3" strokeWidth={2.6} aria-hidden="true" />
            </span>
            {t(key)}
          </span>
        </li>
      ))}
    </ol>
  );
  return <MapStepFrame step="add" icon={Plus} extra={chips} {...props} />;
}

export function LevelsStep({ name, ...props }: Readonly<MapStepProps & { name: string | null }>) {
  return <MapStepFrame step="levels" icon={Trophy} bottom={<LevelsCard name={name} />} {...props} />;
}
