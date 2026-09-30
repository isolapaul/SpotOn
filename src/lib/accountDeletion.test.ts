import { describe, expect, it } from 'vitest';
import { deleteAccountErrorKey, deletionConfirmWord } from './accountDeletion';

describe('deletionConfirmWord', () => {
  it('prefers the username, then the e-mail, then "delete"', () => {
    expect(deletionConfirmWord({ username: 'anna', email: 'a@example.com' })).toBe('anna');
    expect(deletionConfirmWord({ username: '', email: 'a@example.com' })).toBe('a@example.com');
    expect(deletionConfirmWord({ username: null, email: null })).toBe('delete');
  });
});

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
