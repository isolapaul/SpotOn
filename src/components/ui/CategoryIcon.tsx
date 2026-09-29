import { CATEGORY_GLYPHS, normalizeCategory, type GlyphNode } from '@/lib/categoryGlyphs';

// A category's hand-drawn glyph (design 1D) as React SVG; inherits the text colour.

function Node({ node }: Readonly<{ node: GlyphNode }>) {
  if (node.tag === 'path') return <path d={node.d} />;
  if (node.tag === 'rect') return <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} />;
  return node.filled ? (
    <circle cx={node.cx} cy={node.cy} r={node.r} fill="currentColor" stroke="none" />
  ) : (
    <circle cx={node.cx} cy={node.cy} r={node.r} />
  );
}

export default function CategoryIcon({ category, className }: Readonly<{ category: string | undefined; className?: string }>) {
  const glyph = CATEGORY_GLYPHS[normalizeCategory(category)];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g transform={glyph.transform}>
        {glyph.nodes.map((n, i) => (
          <Node key={i} node={n} />
        ))}
      </g>
    </svg>
  );
}
