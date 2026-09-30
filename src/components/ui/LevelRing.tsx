'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { levelTheme } from '@/lib/levelTheme';

// Progress ring toward the next level around an avatar (design; owner: colour per level). The ring
// fills smoothly when the XP changes, and new XP sends out a ping in the level colour.

const SIZE = 48;
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

interface LevelRingProps {
  level: number;
  /** 0–100 toward the next level (100 at the top level). */
  progress: number;
  /** The XP: a rise after the first seconds (not the initial load) pings. */
  xp: number;
  children: ReactNode;
}

/** The level listener answers from the cache first; rises before this are loading, not new XP. */
const SETTLE_MS = 4000;

export default function LevelRing({ level, progress, xp, children }: Readonly<LevelRingProps>) {
  const theme = levelTheme(level);
  const id = useId().replaceAll(':', '');
  const offset = CIRC * (1 - Math.min(100, Math.max(0, progress)) / 100);
  const [settled, setSettled] = useState(false);
  const [prevXp, setPrevXp] = useState(xp);
  const [pings, setPings] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);

  if (xp !== prevXp) {
    setPrevXp(xp);
    if (settled && xp > prevXp) setPings((p) => p + 1);
  }

  return (
    <span className="relative grid place-items-center" style={{ width: SIZE, height: SIZE }}>
      {pings > 0 && (
        <span
          key={pings}
          aria-hidden="true"
          className="absolute inset-0 rounded-full motion-safe:animate-ring-ping opacity-0"
          style={{ boxShadow: `0 0 0 3px ${theme.accent}` }}
        />
      )}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="absolute inset-0 -rotate-90"
      >
        <defs>
          <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
            {theme.stops.map((stop, i) => (
              <stop key={stop} offset={theme.stops.length === 1 ? 0 : i / (theme.stops.length - 1)} stopColor={stop} />
            ))}
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-black/10 chrome-dark:stroke-white/15" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={`url(#${id}-ring)`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {children}
    </span>
  );
}
