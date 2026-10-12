'use client';

import { useState } from 'react';
import BottomSheet from '../ui/BottomSheet';
import WhoInvitedForm from './WhoInvitedForm';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { accountCreatedAt, useReferralStore } from '@/store/useReferralStore';
import { canStillClaim } from '@/lib/referral';

/**
 * "Who invited you?" right after signing up, or when an invite link was opened on this device
 * (growth plan §2). Once per account and device: skipping dismisses it (the invite sheet still
 * offers it during the first week). Rendered by the page only when nothing else is in the way.
 */
export default function InvitePrompt() {
  const t = useT();
  const user = useUserStore((s) => s.user);
  const needsUsername = useUserStore((s) => s.needsUsername);
  const { pendingCode, justSignedUp, dismissed, dismiss } = useReferralStore();
  const [now] = useState(() => Date.now());
  if (!user || needsUsername || user.usernameMissing || user.referredBy || dismissed.includes(user.uid)) return null;
  if (!justSignedUp && !pendingCode) return null;
  if (pendingCode === user.username || !canStillClaim(accountCreatedAt(), now)) return null;

  return (
    <BottomSheet title={t('whoInvitedTitle')} onClose={() => dismiss(user.uid)}>
      {(close) => (
        <div className="flex flex-col gap-4 pt-1">
          <p className="text-[15px] text-label-secondary">{t('whoInvitedExplain')}</p>
          <WhoInvitedForm onDone={close} onSkip={close} />
        </div>
      )}
    </BottomSheet>
  );
}
