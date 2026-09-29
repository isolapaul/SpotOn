import { useId } from 'react';
import { levelTheme } from '@/lib/levelTheme';
import type { GlyphNode } from '@/lib/categoryGlyphs';

// A level's badge (design): a soft hexagon medal in the level's gradient with its white glyph.
// Level 5 gets a slow light sweep (motion-safe, CSS `.level-badge__shine`).

const HEX = 'M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5z';

function Node({ node }: Readonly<{ node: GlyphNode }>) {
  if (node.tag === 'path') return <path d={node.d} />;
  if (node.tag === 'rect') return <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} />;
  return <circle cx={node.cx} cy={node.cy} r={node.r} fill={node.filled ? '#fff' : 'none'} />;
}

interface LevelBadgeProps {
  level: number;
  /** Rendered size in px (square). */
  size: number;
  className?: string;
}

export default function LevelBadge({ level, size, className }: Readonly<LevelBadgeProps>) {
  const theme = levelTheme(level);
  const id = useId().replaceAll(':', '');
  const shine = level >= 5;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          {theme.stops.map((stop, i) => (
            <stop key={stop} offset={theme.stops.length === 1 ? 0 : i / (theme.stops.length - 1)} stopColor={stop} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={HEX} />
        </clipPath>
      </defs>
      {/* Rounded corners: the same hexagon, stroked with round joins in the fill colour */}
      <path d={HEX} fill={`url(#${id}-fill)`} stroke={`url(#${id}-fill)`} strokeWidth="5" strokeLinejoin="round" />
      <path d={HEX} fill={`url(#${id}-gloss)`} />
      {shine && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect className="level-badge__shine" x="-30" y="-10" width="14" height="70" fill="#fff" opacity=".45" transform="rotate(20)" />
        </g>
      )}
      <g
        transform={`translate(12 12)${theme.glyph.transform ? ` ${theme.glyph.transform}` : ''}`}
        fill="none"
        stroke="#fff"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme.glyph.nodes.map((n, i) => (
          <Node key={i} node={n} />
        ))}
      </g>
    </svg>
  );
}
