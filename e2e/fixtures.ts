// Shared E2E fixture data: written by scripts/seed-emulator.ts, asserted by e2e/*.spec.ts.
export const E2E = {
  password: 'e2e-password-123',
  user: { uid: 'e2e-user', email: 'user@spoton.test', username: 'e2e_user' },
  admin: { uid: 'e2e-admin', email: 'admin@spoton.test', username: 'e2e_admin' },
  legacySpot: {
    id: 'e2e-legacy-spot', name: 'E2E Legacy Spot', emoji: '🏔️',
    reviewComment: 'E2E legacy review comment',
  },
  modernSpot: { id: 'e2e-modern-spot', name: 'E2E Modern Spot', emoji: '🌳' },
  pendingSpot: { id: 'e2e-pending-spot', name: 'E2E Pending Spot', emoji: '🥾' },
} as const;
