import type { CSSProperties } from 'react';
import { CATEGORY_GLYPHS, normalizeCategory, type GlyphNode } from '@/lib/categoryGlyphs';
import { PIN_COLORS, PIN_PATH } from '@/lib/mapMarkers';

// The app's map pin (lib/mapMarkers buildPinHtml), drawn with React elements for the demo map: the
// same geometry, colours and status cues (pending: white with a dashed ring and a clock).

function Node({ node, ink }: Readonly<{ node: GlyphNode; ink: string }>) {
  if (node.tag === 'path') return <path d={node.d} />;
  if (node.tag === 'rect') return <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} />;
  return node.filled ? <circle cx={node.cx} cy={node.cy} r={node.r} fill={ink} stroke="none" /> : <circle cx={node.cx} cy={node.cy} r={node.r} />;
}

interface ScenePinProps {
  category: string;
  variant?: 'approved' | 'pending';
  selected?: boolean;
  /** Entrance stagger (globals.css .spot-pin pin-in). */
  delayMs?: number;
}

export default function ScenePin({ category, variant = 'approved', selected = false, delayMs = 0 }: Readonly<ScenePinProps>) {
  const glyph = CATEGORY_GLYPHS[normalizeCategory(category)];
  const pending = variant === 'pending';
  const fill = pending ? '#FFFFFF' : PIN_COLORS.approved;
  const ink = pending ? PIN_COLORS.pendingInk : '#FFFFFF';
  return (
    <div
      className="spot-pin"
      data-variant={variant}
      data-selected={selected}
      style={{ '--pin-delay': `${delayMs}ms` } as CSSProperties}
    >
      <svg className="spot-pin__svg" width="44" height="54" viewBox="0 0 44 54" aria-hidden="true" focusable="false">
        <ellipse cx="22" cy="50.6" rx="6" ry="2" fill="#000" opacity=".22" />
        <path d={PIN_PATH} fill="none" stroke="#000" strokeOpacity=".2" strokeWidth="5.5" />
        <path
          d={PIN_PATH}
          fill={fill}
          stroke={pending ? PIN_COLORS.pendingRing : '#FFFFFF'}
          strokeWidth="3"
          strokeDasharray={pending ? '4 3' : undefined}
        />
        <g
          transform={`translate(12 10) scale(.8333)${glyph.transform ? ` ${glyph.transform}` : ''}`}
          fill="none"
          stroke={ink}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {glyph.nodes.map((n, i) => (
            <Node key={i} node={n} ink={ink} />
          ))}
        </g>
        {pending && (
          <>
            <circle cx="36" cy="7" r="7" fill="#111418" stroke="#fff" strokeWidth="1.5" />
            <path d="M36 3.8V7l2.1 1.3" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
}
