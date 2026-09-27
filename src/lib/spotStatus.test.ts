import { describe, expect, it } from 'vitest';
import type { TranslationKey } from './translations';
import { STATUS_CLASS, STATUS_LABEL_KEY, statusClass, statusLabelKey } from './spotStatus';

// Oracles: ProfilePanel's pre-T27 helpers, verbatim (getStatusText returned t(key); the key is compared).
const getStatusClassName = (status: string) => {
  if (status === 'approved') return 'bg-green-500/20 text-green-400';
  if (status === 'pending') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
};
const getStatusText = (status: string): TranslationKey => {
  if (status === 'approved') return 'approved';
  if (status === 'pending') return 'pending';
  return 'rejected';
};

describe('spotStatus', () => {
  it.each(['approved', 'pending', 'rejected', 'x', '', 'constructor', 'toString', '__proto__'])(
    'matches the old helpers for %j',
    (status) => {
      expect(statusClass(status)).toBe(getStatusClassName(status));
      expect(statusLabelKey(status)).toBe(getStatusText(status));
    },
  );

  it('static maps equal the old helper outputs for the known statuses', () => {
    for (const status of ['approved', 'pending', 'rejected'] as const) {
      expect(STATUS_CLASS[status]).toBe(getStatusClassName(status));
      expect(STATUS_LABEL_KEY[status]).toBe(getStatusText(status));
    }
  });
});
