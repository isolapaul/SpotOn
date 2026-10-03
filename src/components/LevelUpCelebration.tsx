'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/hooks/useT';
import { useLevelUpCelebration } from '@/hooks/useLevelUpCelebration';
import { getLevelInfo } from '@/lib/levelUtils';
import { LEVEL_PERKS, levelTheme, type LevelNumber } from '@/lib/levelTheme';
import { Z } from '@/lib/constants';
import LevelBadge from '@/components/ui/LevelBadge';
import PerkIcon from '@/components/ui/PerkIcon';

// Level-up moment (design; owner: "more dopamine"): the new badge springs in over a burst of
// confetti in the level's colours, with what the level unlocks. Reduced motion: shown still.

const CONFETTI = 32;
const CLOSE_MS = 220;

/** Deterministic confetti: evenly spread angles with a little jitter, varied distance and spin. */
const PIECES = Array.from({ length: CONFETTI }, (_, i) => {
  const angle = ((i * 360) / CONFETTI + ((i * 37) % 17) - 8) * (Math.PI / 180);
  const distance = 120 + ((i * 53) % 90);
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    rot: ((i * 97) % 540) - 270,
    delay: (i % 5) * 25,
    round: i % 3 === 0,
  };
});

export default function LevelUpCelebration() {
  const { level, dismiss } = useLevelUpCelebration();
  const [closing, setClosing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (level === null) return;
    button.current?.focus();
    navigator.vibrate?.([15, 60, 25]);
  }, [level]);

  if (level === null) return null;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      dismiss();
    }, CLOSE_MS);
  };

  return (
    <Celebration level={level as LevelNumber} closing={closing} onClose={close} buttonRef={button} />
  );
}

function Celebration({
  level,
  closing,
  onClose,
  buttonRef,
}: Readonly<{ level: LevelNumber; closing: boolean; onClose: () => void; buttonRef: React.RefObject<HTMLButtonElement | null> }>) {
  const t = useT();
  const theme = levelTheme(level);
  const info = getLevelInfo(level);
  const perks = LEVEL_PERKS[level].filter((p) => !p.muted && p.icon);
  const colours = [...theme.stops, '#FFFFFF', '#FFD60A'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
      className={`fixed inset-0 ${Z.modal} grid place-items-center px-6 ${
        closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
      }`}
      style={{
        background: `radial-gradient(circle at 50% 30%, ${theme.accent}59 0%, rgb(8 10 14 / 0.94) 62%)`,
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      }}
      onClick={onClose}
    >
      <div className="relative w-full max-w-[320px] flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
        {/* Badge over rays and confetti */}
        <div className="relative w-[200px] h-[200px] grid place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full motion-safe:animate-rays-spin opacity-60"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${theme.accent}66 0deg 8deg, transparent 8deg 30deg)`,
              maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
            }}
          />
          {PIECES.map((p, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`confetti-piece absolute left-1/2 top-1/2 ${p.round ? 'w-2 h-2 rounded-full' : 'w-1.5 h-3 rounded-[2px]'}`}
              style={
                {
                  background: colours[i % colours.length],
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  '--rot': `${p.rot}deg`,
                  animationDelay: `${120 + p.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
          <LevelBadge level={level} size={132} className="relative drop-shadow-2xl motion-safe:animate-level-pop" />
        </div>

        <p
          className="mt-2 text-[13px] font-bold uppercase tracking-[0.18em] motion-safe:animate-rise-in"
          style={{ color: theme.stops[0], animationDelay: '250ms' }}
        >
          {t('levelUpTitle')}
        </p>
        <h2 id="level-up-title" className="mt-1 text-[34px] leading-tight font-bold text-white motion-safe:animate-rise-in" style={{ animationDelay: '330ms' }}>
          {t(info.nameKey)}
        </h2>
        <p className="text-[15px] text-white/60 motion-safe:animate-rise-in" style={{ animationDelay: '400ms' }}>
          {t('levelLabel', { level })}
        </p>

        {perks.length > 0 && (
          <div className="mt-5 w-full motion-safe:animate-rise-in" style={{ animationDelay: '480ms' }}>
            <p className="text-[13px] font-semibold text-white/50 mb-2">{t('levelUpUnlocked')}</p>
            <ul className="flex flex-col gap-2">
              {perks.map((perk, i) => (
                <li
                  key={perk.keys.join(' ')}
                  className="flex items-center gap-3 rounded-2xl bg-white/[.08] ring-1 ring-white/10 px-3.5 py-2.5 text-left text-[15px] text-white motion-safe:animate-item-in"
                  style={{ animationDelay: `${560 + i * 80}ms` }}
                >
                  {perk.icon && <PerkIcon icon={perk.icon} className={`w-5 h-5 flex-shrink-0 ${info.textColor}`} />}
                  {perk.keys.map((k) => t(k)).join(' ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full h-[52px] rounded-full text-[17px] font-bold text-white shadow-float touch-manipulation
            active:scale-[.97] transition-transform motion-safe:animate-rise-in"
          style={{ backgroundImage: `linear-gradient(135deg, ${theme.stops.join(', ')})`, animationDelay: '640ms' }}
        >
          {t('levelUpContinue')}
        </button>
      </div>
    </div>
  );
}
