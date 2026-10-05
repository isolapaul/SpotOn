import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@/hooks/useT';
import RichText from '@/components/ui/RichText';
import Button from '@/components/ui/Button';
import s from './flow.module.css';

interface CoachCardProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  onNext: () => void;
  nextLabel?: string;
  children?: ReactNode;
}

/** The guide's voice on the map steps: a frosted card at the top with the step's copy and its buttons. */
export default function CoachCard({ icon: Icon, eyebrow, title, body, onNext, nextLabel, children }: Readonly<CoachCardProps>) {
  const t = useT();
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
  return (
    <section className={`${s.coachIn} material-sheet shadow-sheet rounded-r4 px-[18px] pt-4 pb-3.5 [@media(max-height:700px)]:pt-3 [@media(max-height:700px)]:pb-2.5`}>
      <p className={`${s.rise} flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-brand-400`} style={delay(420)}>
        <Icon className="w-[15px] h-[15px]" strokeWidth={2.4} aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className={`${s.rise} mt-2 mb-1.5 text-[22px] leading-tight font-bold tracking-[-0.02em] text-balance [@media(max-height:700px)]:text-[19px] [@media(max-height:700px)]:mt-1.5`} style={delay(480)}>
        {title}
      </h2>
      <p className={`${s.rise} text-[15px] leading-[1.42] text-label-secondary text-pretty [@media(max-height:700px)]:text-[14px]`} style={delay(560)}>
        <RichText text={body} />
      </p>
      {children}
      <div className={`${s.rise} mt-3 flex items-center gap-2 [@media(max-height:700px)]:mt-2`} style={delay(640)}>
        <Button size="md" className="ml-auto min-w-[104px]" onClick={onNext} data-autofocus>
          {nextLabel ?? t('onboardingNext')}
        </Button>
      </div>
    </section>
  );
}
