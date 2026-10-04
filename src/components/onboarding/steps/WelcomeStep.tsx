import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { stepCopy } from '@/lib/onboarding';
import CategoryIcon from '@/components/ui/CategoryIcon';
import Button from '@/components/ui/Button';
import AppIcon from '../AppIcon';
import s from '../flow.module.css';

const CATEGORY_ROW = ['viewpoint', 'smoke-spot', 'date-spot', 'hiking', 'part', 'park'] as const;

interface WelcomeStepProps {
  /** Signed-in visitor: the returning-user greeting by @username (or without a name). */
  returning: boolean;
  username: string | null;
  onNext: () => void;
}

export default function WelcomeStep({ returning, username, onNext }: Readonly<WelcomeStepProps>) {
  const t = useT();
  const copy = stepCopy('welcome', { returning, hasName: !!username });
  const title = t(copy.title);
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-5 py-4">
        <div className="relative w-[112px] h-[112px] mb-8 shrink-0 [@media(max-height:700px)]:w-[84px] [@media(max-height:700px)]:h-[84px] [@media(max-height:700px)]:mb-5">
          <span className={s.logoGlow} aria-hidden="true" />
          <span className={s.logoRing} aria-hidden="true" />
          <span className={s.logoRing} aria-hidden="true" />
          <span className={s.logoRing} aria-hidden="true" />
          <AppIcon size={112} className={`${s.logo} relative w-full h-full drop-shadow-[0_18px_30px_rgb(0_0_0/0.45)]`} />
        </div>
        {/* A returning user's eyebrow carries the @username: never uppercased (README of the copy). */}
        <p
          className={`${s.rise} mb-3 text-[13px] font-semibold text-brand-400 max-w-full [overflow-wrap:anywhere] ${
            returning ? 'text-[15px]' : 'uppercase tracking-[0.06em]'
          }`}
          style={delay(550)}
        >
          {t(copy.eyebrow ?? copy.title, { username: username ?? '' })}
        </p>
        <h1 className="max-w-[340px] text-[clamp(30px,9.2vw,38px)] leading-[1.06] font-bold tracking-[-0.035em] text-balance [@media(max-height:700px)]:text-[28px]">
          {title.split(' ').map((word, i) => (
            <Fragment key={`${word}${i}`}>
              {i > 0 && ' '}
              <span className={s.word} style={delay(700 + i * 80)}>
                {word}
              </span>
            </Fragment>
          ))}
        </h1>
        <p className={`${s.rise} mt-3.5 max-w-[320px] text-[16px] leading-[1.45] text-label-secondary text-pretty`} style={delay(1250)}>
          {t(copy.body)}
        </p>
        <div className="mt-6 flex gap-2.5 justify-center [@media(max-height:700px)]:hidden" aria-hidden="true">
          {CATEGORY_ROW.map((c, i) => (
            <span key={c} className={`${s.pop} w-9 h-9 rounded-xl grid place-items-center bg-white/7 text-brand-300 ring-[0.5px] ring-white/8`} style={delay(1500 + i * 70)}>
              <CategoryIcon category={c} className="w-[19px] h-[19px]" />
            </span>
          ))}
        </div>
      </div>
      <div className={`${s.rise} px-3 pt-2 w-full max-w-[400px] mx-auto`} style={delay(1450)}>
        <Button block onClick={onNext} data-autofocus>
          {t(returning ? 'onboardingWelcomeBackCta' : 'onboardingStart')}
          <ArrowRight className="w-5 h-5" strokeWidth={2.4} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
