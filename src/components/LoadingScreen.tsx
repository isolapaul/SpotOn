'use client';

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
}

/** Fade-out length (Tailwind `duration-500`). */
const EXIT_DELAY_MS = 300;

/**
 * Splash (design phase 3): the app mark (the icon's pin and heart, redrawn as a vector) springs in
 * and breathes quietly while the app loads, then the screen fades out.
 */
export default function LoadingScreen({ isLoading }: Readonly<LoadingScreenProps>) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShow(false), EXIT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show && !isLoading) return null;

  return (
    <div
      data-testid="loading-screen"
      className={`fixed inset-0 z-[9999] bg-surface-0 flex flex-col items-center justify-center transition-[opacity,transform] duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0 scale-[1.04]'
      }`}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        role="img"
        aria-label="SpotOn"
        className="motion-safe:animate-level-pop"
      >
        <defs>
          <linearGradient id="splash-gloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".14" />
            <stop offset="1" stopColor="#000" stopOpacity=".10" />
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="22" fill="#16A064" />
        <rect width="96" height="96" rx="22" fill="url(#splash-gloss)" />
        <g className="motion-safe:animate-splash-breathe" style={{ transformOrigin: '48px 48px' }}>
          <path d="M48 78S26 60 26 41a22 22 0 0 1 44 0c0 19-22 37-22 37z" fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
          <path
            d="M48 49.5s-9-5.2-9-10.9c0-3 2.2-5.1 4.9-5.1 1.8 0 3.3 1 4.1 2.4.8-1.4 2.3-2.4 4.1-2.4 2.7 0 4.9 2.1 4.9 5.1 0 5.7-9 10.9-9 10.9z"
            fill="#fff"
          />
        </g>
      </svg>
      <p className="mt-5 text-[22px] font-bold tracking-tight text-label motion-safe:animate-rise-in" style={{ animationDelay: '200ms' }}>
        SpotOn
      </p>
    </div>
  );
}
