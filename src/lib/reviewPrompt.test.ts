import { describe, expect, it } from 'vitest';
import { mayAskForReview } from './reviewPrompt';

describe('mayAskForReview', () => {
  const day = 86_400_000;
  it('asks the first time, then not again for 120 days', () => {
    expect(mayAskForReview(null, 1000)).toBe(true);
    expect(mayAskForReview(0, 119 * day)).toBe(false);
    expect(mayAskForReview(0, 120 * day)).toBe(true);
  });
});
