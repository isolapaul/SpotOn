import { describe, expect, it } from 'vitest';
import { deleteAccountErrorKey } from './accountDeletion';

describe('deleteAccountErrorKey', () => {
  it('maps the server refusals', () => {
    expect(deleteAccountErrorKey({ details: { reason: 'is-admin' } })).toBe('deleteAccountAdmin');
    expect(deleteAccountErrorKey({ details: { reason: 'confirmation-mismatch' } })).toBe('deleteAccountMismatch');
  });

  it('falls back to the generic text', () => {
    for (const error of [new Error('x'), null, { details: { reason: 'toString' } }, { details: 'x' }]) {
      expect(deleteAccountErrorKey(error)).toBe('deleteAccountError');
    }
  });
});
