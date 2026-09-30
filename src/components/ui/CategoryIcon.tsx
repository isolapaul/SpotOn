import { CATEGORY_GLYPHS, normalizeCategory } from '@/lib/categoryGlyphs';
import GlyphIcon from './GlyphIcon';

// A category's hand-drawn glyph (design 1D) as React SVG; inherits the text colour.
export default function CategoryIcon({ category, className }: Readonly<{ category: string | undefined; className?: string }>) {
  return <GlyphIcon glyph={CATEGORY_GLYPHS[normalizeCategory(category)]} className={className} />;
}
