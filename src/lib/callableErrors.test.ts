import { describe, expect, it } from 'vitest';
import { actionErrorKey, callableReason, isRateLimited } from './callableErrors';

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

describe('callableReason', () => {
  it('reads the reason with or without the SDK\'s status suffix', () => {
    expect(callableReason(new Error('VISIT_TOO_FAR [400]'))).toBe('VISIT_TOO_FAR');
    expect(callableReason(new Error('INVITE_SELF'))).toBe('INVITE_SELF');
    expect(callableReason({ message: 'Firebase: CATEGORY_IN_USE [400]' })).toBe('CATEGORY_IN_USE');
    expect(callableReason(new Error('Something else happened'))).toBeNull();
    expect(callableReason(null)).toBeNull();
  });
});
