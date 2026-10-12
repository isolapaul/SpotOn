import type { InviteBadgeTier } from '@/lib/referral';

/** The tiers' metal: the medal's two gradient stops and the ribbon. */
const METAL: Record<InviteBadgeTier, { from: string; to: string; ribbon: string }> = {
  bronze: { from: '#f0b27a', to: '#a0582a', ribbon: '#7c3f1d' },
  silver: { from: '#f4f6f8', to: '#9aa4ae', ribbon: '#5d6873' },
  gold: { from: '#ffe28a', to: '#d4921c', ribbon: '#16a064' },
};

interface InviteBadgeProps {
  tier: InviteBadgeTier;
  size?: number;
  /** Greyed out: a badge not earned yet (the invite sheet's steps). */
  locked?: boolean;
  title?: string;
}

/**
 * The Ambassador badges (growth plan §2: 3, 5 and 10 invitees): a medal on a ribbon with two
 * people, drawn as a vector so it stays sharp at every size.
 */
export default function InviteBadge({ tier, size = 28, locked = false, title }: Readonly<InviteBadgeProps>) {
  const m = METAL[tier];
  const id = `invite-${tier}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={locked ? 'opacity-35 grayscale' : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.from} />
          <stop offset="1" stopColor={m.to} />
        </linearGradient>
      </defs>
      <path d="M10 2h5l-2 9h-5zM17 2h5l2 9h-5z" fill={m.ribbon} />
      <circle cx="16" cy="19" r="11" fill={`url(#${id})`} stroke="rgba(0,0,0,.18)" />
      <circle cx="16" cy="19" r="8.2" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
      <circle cx="13" cy="16.6" r="2.1" fill="rgba(0,0,0,.55)" />
      <circle cx="19" cy="16.6" r="2.1" fill="rgba(0,0,0,.55)" />
      <path d="M8.9 23.6c.6-2.4 2.2-3.7 4.1-3.7s3.5 1.3 4.1 3.7zM14.9 23.6c.6-2.4 2.2-3.7 4.1-3.7s3.5 1.3 4.1 3.7z" fill="rgba(0,0,0,.55)" />
    </svg>
  );
}
