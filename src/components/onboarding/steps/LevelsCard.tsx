import { useEffect, useRef, type CSSProperties } from 'react';
import { UserRound, Users } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { LEVEL_THRESHOLDS } from '@/lib/levelUtils';
import { levelTheme } from '@/lib/levelTheme';
import type { TranslationKey } from '@/lib/translations';
import LevelBadge from '@/components/ui/LevelBadge';
import PerkIcon from '@/components/ui/PerkIcon';
import s from '../flow.module.css';

// The levels step's card: a demo profile earns its first 30 XP (the ring fills and the counter
// counts), steps up from level 1 to 2 with a burst, and the ladder shows what levels 3 to 5 unlock.

const R = 40;
const RING = 2 * Math.PI * R;
const DEMO_XP = LEVEL_THRESHOLDS[1].xpRequired;
const COUNT = { delayMs: 900, durationMs: 2400 } as const;
const XP_CHIPS = [10, 3, 10, 3, 2, 2] as const;
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = ((i * 360) / 18 + ((i * 37) % 13) - 6) * (Math.PI / 180);
  const distance = 54 + ((i * 29) % 34);
  return { dx: Math.round(Math.cos(angle) * distance), dy: Math.round(Math.sin(angle) * distance) - 30, rot: ((i * 97) % 540) - 270, round: i % 3 === 0 };
});

const LADDER: readonly { level: 3 | 4 | 5; perk: TranslationKey; icon: 'highlight' | 'icons' | 'style' }[] = [
  { level: 3, perk: 'onboardingPerkLevel3', icon: 'highlight' },
  { level: 4, perk: 'onboardingPerkLevel4', icon: 'icons' },
  { level: 5, perk: 'onboardingPerkLevel5', icon: 'style' },
];

/** Counts the XP up once (text only, no re-renders); reduced motion shows the final value. */
function XpCounter({ to }: Readonly<{ to: number }>) {
  const t = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let frame = 0;
    const start = performance.now() + COUNT.delayMs;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT.durationMs));
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      el.textContent = t('xpTotal', { xp: Math.round(eased * to) });
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduced, t]);
  return (
    <span ref={ref} className="tabular-nums">
      {t('xpTotal', { xp: to })}
    </span>
  );
}

function Avatar({ name }: Readonly<{ name: string | null }>) {
  const first = levelTheme(1);
  const second = levelTheme(2);
  return (
    <span className="relative w-[84px] h-[84px] shrink-0 [@media(max-height:700px)]:w-16 [@media(max-height:700px)]:h-16" aria-hidden="true">
      <span className={s.burstGlow} />
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece absolute left-1/2 top-1/2 ${p.round ? 'w-2 h-2 rounded-full' : 'w-1.5 h-3 rounded-[2px]'}`}
          style={{ background: [...second.stops, '#FFFFFF', '#FFD60A'][i % 4], '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, animationDelay: `${3300 + (i % 5) * 25}ms` } as CSSProperties}
        />
      ))}
      <svg viewBox="0 0 84 84" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="3.5" />
        <circle cx="42" cy="42" r={R} fill="none" stroke={first.accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={RING} className={s.ringFill} style={{ '--ring-len': RING } as CSSProperties} />
        <circle cx="42" cy="42" r={R} fill="none" stroke={second.accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${RING * 0.08} ${RING}`} className={s.ringNext} />
      </svg>
      <span className="absolute inset-2 rounded-full grid place-items-center bg-linear-145 from-[#1aa86a] to-brand-700 text-[30px] font-bold [@media(max-height:700px)]:text-[22px]">
        {name ? name.charAt(0).toUpperCase() : <UserRound className="w-1/2 h-1/2 text-white/85" strokeWidth={1.8} />}
      </span>
      <LevelBadge level={1} size={30} className={`${s.lvFirst} absolute -right-1.5 -bottom-1.5`} />
      <LevelBadge level={2} size={30} className={`${s.badgeNext} absolute -right-1.5 -bottom-1.5`} />
    </span>
  );
}

export default function LevelsCard({ name }: Readonly<{ name: string | null }>) {
  const t = useT();
  return (
    <section className={`${s.riseBig} material-sheet shadow-sheet rounded-r4 px-[18px] pt-4 pb-3 [@media(max-height:700px)]:pt-3`} style={{ animationDelay: '380ms' }}>
      <div className="flex items-center gap-4">
        <Avatar name={name} />
        <div className="relative min-w-0 flex-1">
          <p className="relative h-[26px] text-[21px] font-bold tracking-[-0.02em]">
            <span className={`${s.lvFirst} absolute left-0 top-0 whitespace-nowrap`} aria-hidden="true">
              {t(LEVEL_THRESHOLDS[0].nameKey)}
            </span>
            <span className={`${s.lvSecond} absolute left-0 top-0 whitespace-nowrap`}>{t(LEVEL_THRESHOLDS[1].nameKey)}</span>
          </p>
          <p className="mt-1 text-[15px] text-label-secondary">
            <XpCounter to={DEMO_XP} />
          </p>
          <p className={`${s.levelUp} mt-1 inline-flex h-6 px-2.5 rounded-full items-center text-[12px] font-bold uppercase tracking-[0.08em] bg-[#0A84FF]/20 text-[#6FD3FF]`}>
            {t('levelUpTitle')}
          </p>
          <span className="absolute left-0 top-0" aria-hidden="true">
            {XP_CHIPS.map((xp, i) => (
              <span
                key={i}
                className={`${s.xpChip} h-[26px] px-2 rounded-full inline-flex items-center whitespace-nowrap text-[13px] font-bold bg-brand-500/22 text-brand-300`}
                style={{ left: `${90 + (i % 3) * 46}px`, animationDelay: `${1000 + i * 350}ms` }}
              >
                {t('onboardingXpGain', { xp })}
              </span>
            ))}
          </span>
        </div>
      </div>
      <ul className="mt-3 [@media(max-height:700px)]:mt-2">
        {LADDER.map((row, i) => {
          const threshold = LEVEL_THRESHOLDS[row.level - 1];
          return (
            <li
              key={row.level}
              className={`${s.rise} flex items-center gap-3 py-2 border-t border-separator [@media(max-height:700px)]:py-1.5`}
              style={{ animationDelay: `${1100 + i * 100}ms` }}
            >
              <LevelBadge level={row.level} size={30} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight">{t(threshold.nameKey)}</span>
                <span className="block text-[13px] leading-tight text-label-secondary [@media(max-height:640px)]:hidden">{t(row.perk)}</span>
              </span>
              <PerkIcon icon={row.icon} className="w-[18px] h-[18px] shrink-0 text-label-tertiary" />
              <span className="w-[54px] text-right text-[13px] text-label-tertiary tabular-nums whitespace-nowrap">{t('xpTotal', { xp: threshold.xpRequired })}</span>
            </li>
          );
        })}
      </ul>
      <p className={`${s.rise} flex gap-3 items-start pt-2.5 border-t border-separator text-[14px] leading-snug`} style={{ animationDelay: '1450ms' }}>
        <span className="w-[30px] h-[30px] shrink-0 rounded-[9px] grid place-items-center bg-white/6 text-brand-300" aria-hidden="true">
          <Users className="w-4 h-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          {t('onboardingCommunityLine')}
          <span className="block text-[13px] text-label-tertiary [@media(max-height:700px)]:hidden">{t('onboardingCommunityProfileLine')}</span>
        </span>
      </p>
    </section>
  );
}
