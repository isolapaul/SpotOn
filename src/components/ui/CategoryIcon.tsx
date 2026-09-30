'use client';

import { useCategory } from '@/hooks/useCategory';
import GlyphIcon from './GlyphIcon';

// A category's hand-drawn glyph (design 1D; item 7: the super admin's categories too) as React
// SVG; inherits the text colour. Unknown ids draw the 'other' glyph.
export default function CategoryIcon({ category, className }: Readonly<{ category: string | undefined; className?: string }>) {
  return <GlyphIcon glyph={useCategory(category).glyph} className={className} />;
}
