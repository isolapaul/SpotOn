import { describe, expect, it } from 'vitest';
import { buildPinHtml, markerVariant, zoomBand } from './mapMarkers';
import { CATEGORY_GLYPHS, glyphToSvgMarkup, normalizeCategory } from './categoryGlyphs';

describe('markerVariant', () => {
  it('approved spots are green, every other status is pending', () => {
    expect(markerVariant('approved')).toBe('approved');
    expect(markerVariant('rejected')).toBe('rejected');
    for (const status of ['pending', '', undefined, 'APPROVED']) expect(markerVariant(status)).toBe('pending');
  });
});

describe('normalizeCategory', () => {
  it('keeps known ids and maps anything else to other', () => {
    expect(normalizeCategory('scenic')).toBe('scenic');
    for (const c of [undefined, '', 'unknown', 'toString', '__proto__', '"><img src=x onerror=alert(1)>']) {
      expect(normalizeCategory(c)).toBe('other');
    }
  });
});

describe('buildPinHtml', () => {
  it('exposes variant, category and highlight as data attributes', () => {
    const html = buildPinHtml({ category: 'park', variant: 'approved', highlighted: false });
    expect(html).toContain('data-variant="approved" data-category="park" data-highlighted="false"');
    expect(html).toContain(glyphToSvgMarkup(CATEGORY_GLYPHS.park, '#FFFFFF'));
    expect(html).toContain('class="spot-pin__dot"');
  });

  it('pending: white pin, dashed ring, clock badge; highlighted: gold ring and star, no dash', () => {
    const pending = buildPinHtml({ category: 'park', variant: 'pending', highlighted: false });
    expect(pending).toContain('stroke-dasharray="4 3"');
    expect(pending).toContain('#111418');
    const gold = buildPinHtml({ category: 'park', variant: 'approved', highlighted: true });
    expect(gold).toContain('stroke="#F7C948"');
    expect(gold).not.toContain('stroke-dasharray');
    expect(gold).toContain('data-highlighted="true"');
  });

  it('never echoes an unknown or hostile category', () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    const html = buildPinHtml({ category: hostile, variant: 'approved', highlighted: false });
    expect(html).not.toContain('onerror');
    expect(html).toContain('data-category="other"');
    expect(html).toContain(glyphToSvgMarkup(CATEGORY_GLYPHS.other, '#FFFFFF'));
  });

  it('every category renders its own glyph', () => {
    const markups = Object.keys(CATEGORY_GLYPHS).map((c) => buildPinHtml({ category: c, variant: 'approved', highlighted: false }));
    expect(new Set(markups).size).toBe(Object.keys(CATEGORY_GLYPHS).length);
  });
});

describe('zoomBand', () => {
  it('collapses pins to dots at region zoom and below', () => {
    expect(zoomBand(6)).toBe('far');
    expect(zoomBand(10)).toBe('far');
    expect(zoomBand(11)).toBe('near');
    expect(zoomBand(18)).toBe('near');
  });
});
