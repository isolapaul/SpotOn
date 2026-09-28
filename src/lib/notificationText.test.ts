import { describe, expect, it } from 'vitest';
import { isSameLocalDay, stripEdgeEmoji } from './notificationText';

describe('stripEdgeEmoji', () => {
  it('removes emoji at the start and the end', () => {
    expect(stripEdgeEmoji('✅ Siker')).toBe('Siker');
    expect(stripEdgeEmoji('ℹ️ Info')).toBe('Info');
    expect(stripEdgeEmoji('New review received! ⭐')).toBe('New review received!');
    expect(stripEdgeEmoji('🎉 Spot approved! 🎉')).toBe('Spot approved!');
    expect(stripEdgeEmoji('👨‍👩‍👧 Family')).toBe('Family');
  });

  it('keeps emoji inside the text, digits and plain text', () => {
    expect(stripEdgeEmoji('Rated ⭐ 5')).toBe('Rated ⭐ 5');
    expect(stripEdgeEmoji('3 new spots')).toBe('3 new spots');
    expect(stripEdgeEmoji('#1 spot')).toBe('#1 spot');
  });

  it('returns the input when only emoji is left', () => {
    expect(stripEdgeEmoji('🎉')).toBe('🎉');
    expect(stripEdgeEmoji('')).toBe('');
  });
});

describe('isSameLocalDay', () => {
  it('compares local calendar days', () => {
    const noon = new Date(2026, 8, 28, 12).getTime();
    expect(isSameLocalDay(noon, new Date(2026, 8, 28, 0, 1).getTime())).toBe(true);
    expect(isSameLocalDay(noon, new Date(2026, 8, 27, 23, 59).getTime())).toBe(false);
  });
});
