import { describe, expect, it } from 'vitest';
import { MAX_SPOT_IMAGES } from './constants';

describe('constants', () => {
  it('pins the per-spot image limit (D12)', () => {
    expect(MAX_SPOT_IMAGES).toBe(20);
  });
});
