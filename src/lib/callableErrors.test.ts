import { describe, expect, it } from 'vitest';
import { actionErrorKey, isRateLimited } from './callableErrors';

describe('callableErrors', () => {
  it('tells a rate limit from other failures', () => {
    expect(isRateLimited({ code: 'functions/resource-exhausted' })).toBe(true);
    expect(isRateLimited({ code: 'functions/internal' })).toBe(false);
    expect(isRateLimited(new Error('x'))).toBe(false);
    expect(isRateLimited(null)).toBe(false);
    expect(actionErrorKey({ code: 'functions/resource-exhausted' })).toBe('rateLimited');
    expect(actionErrorKey(new Error('x'))).toBe('genericError');
  });
});
