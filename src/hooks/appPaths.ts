import { spotIdFromPath, userIdFromPath } from '@/lib/spotLinks';
import { useUiStore } from '@/store/useUiStore';
import { runViewTransition } from './viewTransition';
import { invitePathCode } from '@/lib/referral';
import { useReferralStore } from '@/store/useReferralStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * An invite link: the inviter is remembered for "Who invited you?" (asked after sign-up); a
 * signed-out visitor sees the sign-in sheet. The own link does nothing.
 */
export function openInvite(code: string): void {
  const user = useUserStore.getState().user;
  if (user && user.username === code) return;
  useReferralStore.getState().setPendingCode(code);
  if (!user) useUiStore.getState().openPanel('auth');
}

/**
 * Opens an in-app address in place (no reload, so uploads and forms survive): a spot flies to its
 * place card, a profile opens, /feed opens the feed, an invite link is remembered. False for any
 * other address.
 */
export function openAppPath(path: string): boolean {
  const pathname = new URL(path, 'https://app.invalid').pathname;
  const spotId = spotIdFromPath(pathname);
  if (spotId) {
    useUiStore.getState().openSpotLink(spotId);
    return true;
  }
  const uid = userIdFromPath(pathname);
  if (uid) {
    runViewTransition(() => useUiStore.getState().openUserProfile(uid));
    return true;
  }
  const invite = invitePathCode(pathname);
  if (invite) {
    openInvite(invite);
    return true;
  }
  if (/^\/feed\/?$/.test(pathname)) {
    runViewTransition(() => useUiStore.getState().openPanel('feed'));
    return true;
  }
  return false;
}
