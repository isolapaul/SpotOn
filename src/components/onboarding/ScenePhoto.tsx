import { useId } from 'react';

// Stand-ins for spot photos in the demo scenes: small SVG paintings (gradients and shapes), so the
// tour loads no images and shows no one's photo.

export type ScenePhotoKind = 'sunset' | 'lake' | 'beach' | 'alley' | 'city' | 'hill';

function Sunset({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2d1b54" />
          <stop offset=".45" stopColor="#c2507a" />
          <stop offset=".72" stopColor="#ffb067" />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b3a5e" />
          <stop offset="1" stopColor="#1c1430" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <circle cx="60" cy="74" r="15" fill="#ffd79a" />
      <rect y="76" width="120" height="44" fill={`url(#${id}w)`} />
      <g fill="#ffc98a" opacity=".55">
        <rect x="48" y="82" width="24" height="1.6" rx=".8" />
        <rect x="52" y="88" width="16" height="1.4" rx=".7" />
        <rect x="55" y="94" width="10" height="1.2" rx=".6" />
      </g>
      <path d="M0 70h120v6H0z" fill="#1d1430" />
      <path d="M22 70V50h3v20M95 70V50h3v20" stroke="#1d1430" strokeWidth="3" />
      <path d="M0 60Q23 50 23.5 50T60 64 96.5 50 120 60" fill="none" stroke="#1d1430" strokeWidth="1.4" />
    </>
  );
}

function Lake({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16324a" />
          <stop offset=".6" stopColor="#3f6f8a" />
          <stop offset="1" stopColor="#f2b880" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <rect y="72" width="120" height="48" fill="#12283a" />
      <g fill="#0b1c14">
        <path d="M0 74c6-20 12-26 16-26s8 10 10 26z" />
        <path d="M14 74c6-28 12-34 18-34s10 16 12 34z" />
        <path d="M84 74c4-22 10-28 15-28s10 14 12 28z" />
        <path d="M100 74c4-16 8-20 12-20s6 8 8 20z" />
      </g>
      <path d="M44 72c4-10 9-18 16-18s12 8 16 18z" fill="#c9a36b" opacity=".85" />
      <path d="M50 56h20l-10-9z" fill="#8a6a44" />
      <g fill="#f2b880" opacity=".45">
        <rect x="40" y="80" width="40" height="1.4" />
        <rect x="48" y="86" width="24" height="1.2" />
      </g>
    </>
  );
}

function Beach({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fb3e8" />
          <stop offset="1" stopColor="#bfe6ff" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <path d="M0 70h120v20H0z" fill="#3c8fb8" />
      <path d="M0 88q60-10 120 0v32H0z" fill="#f0d29a" />
      <path d="M78 62a20 20 0 0 1 36 6z" fill="#ff6b61" />
      <path d="M96 64l-6 34" stroke="#5a3b22" strokeWidth="2" />
      <rect x="20" y="96" width="26" height="8" rx="2" fill="#16a064" />
    </>
  );
}

function Alley({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1f3a" />
          <stop offset="1" stopColor="#3a2a3c" />
        </linearGradient>
        <radialGradient id={`${id}l`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <path d="M0 0h34v120H0zM86 0h34v120H86z" fill="#26213a" />
      <path d="M34 120V46a26 26 0 0 1 52 0v74z" fill="#3b3148" />
      <path d="M42 120V52a18 18 0 0 1 36 0v68z" fill="#1a1626" />
      <circle cx="60" cy="40" r="22" fill={`url(#${id}l)`} />
      <circle cx="60" cy="40" r="3" fill="#ffe2a8" />
      <g fill="#ffcf7a" opacity=".75">
        <rect x="8" y="20" width="10" height="14" rx="1" />
        <rect x="100" y="34" width="10" height="14" rx="1" />
      </g>
    </>
  );
}

function City({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1530" />
          <stop offset="1" stopColor="#3a3060" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <path d="M0 80h14V58h10v-8h8v30h10V40l8-8 8 8v40h12V54h10v26h12V62h10v18h10v40H0z" fill="#141a33" />
      <g fill="#ffd27a" opacity=".85">
        <rect x="44" y="46" width="3" height="3" />
        <rect x="52" y="54" width="3" height="3" />
        <rect x="72" y="60" width="3" height="3" />
        <rect x="16" y="64" width="3" height="3" />
      </g>
      <rect y="92" width="120" height="28" fill="#0a1024" />
    </>
  );
}

function Hill({ id }: Readonly<{ id: string }>) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fc3ff" />
          <stop offset="1" stopColor="#d9f0ff" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}s)`} />
      <circle cx="92" cy="28" r="10" fill="#fff6d5" />
      <path d="M0 78 30 52l22 18 26-30 42 40v40H0z" fill="#3e8c66" />
      <path d="M0 92 40 70l30 16 22-12 28 14v32H0z" fill="#2b6e4e" />
      <path d="M0 104 50 88l70 14v18H0z" fill="#1d5139" />
    </>
  );
}

const KINDS = { sunset: Sunset, lake: Lake, beach: Beach, alley: Alley, city: City, hill: Hill } as const;

export default function ScenePhoto({ kind, className = '' }: Readonly<{ kind: ScenePhotoKind; className?: string }>) {
  const id = useId().replaceAll(':', '');
  const Painting = KINDS[kind];
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      <Painting id={id} />
    </svg>
  );
}
