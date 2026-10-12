import type { CSSProperties } from 'react';

/** A small confetti burst around its parent's centre (the apps' upload success; .confetti-piece in globals.css). */
const COLOURS = ['#3ccb8c', '#16a064', '#fbbf24', '#ffffff', '#69d9a5'];

const PIECES = Array.from({ length: 14 }, (_, i) => {
  const angle = ((i * 360) / 14 + ((i * 41) % 13) - 6) * (Math.PI / 180);
  const distance = 34 + ((i * 29) % 26);
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance) - 40}px`,
    rot: `${((i * 97) % 360) - 180}deg`,
    round: i % 3 === 0,
  };
});

export default function ConfettiBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece absolute left-0 top-0 ${p.round ? 'w-1.5 h-1.5 rounded-full' : 'w-1 h-2 rounded-[1px]'}`}
          style={{ background: COLOURS[i % COLOURS.length], '--dx': p.dx, '--dy': p.dy, '--rot': p.rot } as CSSProperties}
        />
      ))}
    </span>
  );
}
