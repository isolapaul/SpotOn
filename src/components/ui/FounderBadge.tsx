/** The launch season's "Founder" badge (growth plan §8): a green-gold hexagon with a star and a pin. */
export default function FounderBadge({ size = 28, title }: Readonly<{ size?: number; title?: string }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="founder-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ccb8c" />
          <stop offset="1" stopColor="#0d6a40" />
        </linearGradient>
        <linearGradient id="founder-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe28a" />
          <stop offset="1" stopColor="#d4921c" />
        </linearGradient>
      </defs>
      <path d="M16 1.8l12.3 7.1v14.2L16 30.2 3.7 23.1V8.9z" fill="url(#founder-fill)" stroke="url(#founder-gold)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 7.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8z" fill="url(#founder-gold)" />
    </svg>
  );
}
