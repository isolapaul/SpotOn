// Shared E2E fixture data: written by scripts/seed-emulator.ts, asserted by e2e/*.spec.ts.
export const E2E = {
  password: 'e2e-password-123',
  user: { uid: 'e2e-user', email: 'user@spoton.test', username: 'e2e_user' },
  admin: { uid: 'e2e-admin', email: 'admin@spoton.test', username: 'e2e_admin' },
  superAdmin: { uid: 'e2e-super', email: 'super@spoton.test', username: 'e2e_super' },
  legacySpot: {
    id: 'e2e-legacy-spot', name: 'E2E Legacy Spot', emoji: '🏔️',
    reviewComment: 'E2E legacy review comment',
  },
  modernSpot: { id: 'e2e-modern-spot', name: 'E2E Modern Spot', emoji: '🌳' },
  pendingSpot: { id: 'e2e-pending-spot', name: 'E2E Pending Spot', emoji: '🥾' },
  // T09: 20 spots (level 5); only approvedSpot is approved, the other 19 are pending.
  level5: {
    uid: 'e2e-level5',
    email: 'level5@spoton.test',
    username: 'e2e_level5',
    approvedSpot: { id: 'e2e-level5-spot-01', name: 'E2E Level5 Spot', emoji: '🎲' },
  },
} as const;

export const EXPECTED_APPROVED_MARKERS = 3; // legacySpot + modernSpot + level5.approvedSpot; update whenever an approved fixture is added
