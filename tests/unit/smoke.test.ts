import { describe, expect, it } from 'vitest';
import { LEVEL_THRESHOLDS } from '@/lib/levelUtils';

describe('tooling smoke', () => {
  it('runs vitest and resolves the @/ alias', () => {
    expect(Array.isArray(LEVEL_THRESHOLDS)).toBe(true);
  });
});
