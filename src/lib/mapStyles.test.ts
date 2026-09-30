import { describe, expect, it } from 'vitest';
import { MAPBOX_STYLES, styleFor } from './mapStyles';

describe('styleFor', () => {
  it('uses the Mapbox style of the theme with a token', () => {
    expect(styleFor('dark', 'pk.test')).toBe('mapbox://styles/mapbox/dark-v11');
    expect(Object.keys(MAPBOX_STYLES).sort()).toEqual(['dark', 'light', 'satellite', 'silver', 'standard']);
  });
  it('without a token: a local background style, no network', () => {
    const style = styleFor('satellite', ' ');
    expect(typeof style).toBe('object');
    expect(JSON.stringify(style)).not.toContain('mapbox://');
  });
});
