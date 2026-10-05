import { useT } from '@/hooks/useT';
import s from './flow.module.css';

/** The story-style progress bar: one segment per step, announced as "Step n of total". */
export default function ProgressSegments({ index, total }: Readonly<{ index: number; total: number }>) {
  const t = useT();
  const label = t('onboardingStepProgress', { n: index + 1, total });
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      aria-valuetext={label}
      className="flex-1 flex gap-1 items-center h-3"
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={s.seg} data-state={i < index ? 'done' : i === index ? 'current' : 'todo'} />
      ))}
    </div>
  );
}
