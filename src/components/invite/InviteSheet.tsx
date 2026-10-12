'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Share2, UserRound } from 'lucide-react';
import BottomSheet from '../ui/BottomSheet';
import InviteBadge from '../ui/InviteBadge';
import WhoInvitedForm from './WhoInvitedForm';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { shareLink } from '@/hooks/shareLink';
import { SITE_URL } from '@/lib/constants';
import { canStillClaim, inviteBadge, inviteLink, INVITE_STEPS, nextInviteStep, REFERRAL_XP, type InviteBadgeTier } from '@/lib/referral';
import { accountCreatedAt, useReferralStore } from '@/store/useReferralStore';
import { useUserStore } from '@/store/useUserStore';
import { useMyLevelStore } from '@/store/useMyLevelStore';
import { fetchPublicProfile } from '@/store/publicProfiles';
import { track } from '@/store/telemetry';
import type { TranslationKey } from '@/lib/translations';

export const BADGE_NAME: Record<InviteBadgeTier, TranslationKey> = { bronze: 'inviteBadgeBronze', silver: 'inviteBadgeSilver', gold: 'inviteBadgeGold' };

const STEP_TIER: Record<number, InviteBadgeTier | null> = { 1: null, 3: 'bronze', 5: 'silver', 10: 'gold' };

/**
 * "Invite friends" (growth plan §2): the personal link with copy and share, the 1-3-5-10 steps
 * with the badges, the friends who joined, and — in the first week — "Who invited you?".
 */
export default function InviteSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const t = useT();
  const user = useUserStore((s) => s.user);
  const count = useMyLevelStore((s) => s.invites);
  const invitees = useReferralStore((s) => s.invitees);
  const listen = useReferralStore((s) => s.listen);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    listen(user?.uid ?? null);
    return () => listen(null);
  }, [listen, user?.uid]);

  if (!user || user.usernameMissing) return null;
  const link = inviteLink(SITE_URL, user.username);
  const next = nextInviteStep(count);
  const badge = inviteBadge(count);
  const canClaim = !user.referredBy && canStillClaim(accountCreatedAt(), now);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the share button still works.
    }
  };
  const share = async () => {
    const outcome = await shareLink({ title: 'SpotOn', text: t('inviteShareText'), url: link }, t('linkCopied'));
    if (outcome === 'shared' || outcome === 'copied') track('invite_shared');
  };

  return (
    <BottomSheet title={t('inviteTitle')} onClose={onClose}>
      {() => (
        <div className="flex flex-col gap-6 pt-2">
          <p className="text-[15px] text-label-secondary">
            {t('inviteExplain', { perInvite: REFERRAL_XP.perInvite, bonus: REFERRAL_XP.firstSpotBonus, invitee: REFERRAL_XP.invitee })}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 h-12 pl-4 pr-1 rounded-xl bg-white/6">
              <span className="flex-1 min-w-0 truncate text-label text-[15px] font-medium">{link.replace(/^https:\/\//, '')}</span>
              <button type="button" onClick={copy} aria-label={t('inviteCopy')} className="no-min-size w-10 h-10 grid place-items-center rounded-lg bg-white/8">
                {copied ? <Check className="w-4 h-4 text-brand-400" aria-hidden="true" /> : <Copy className="w-4 h-4 text-label-secondary" aria-hidden="true" />}
              </button>
            </div>
            <button type="button" onClick={share} className="h-12 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" aria-hidden="true" />
              {t('inviteShare')}
            </button>
          </div>

          {/* The steps: 1 friend, then the bronze, silver and gold badges */}
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-label font-semibold">{t('inviteProgress', { count })}</span>
              {next && <span className="text-[13px] text-label-tertiary">{t('inviteNext', { left: next - count })}</span>}
            </div>
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {INVITE_STEPS.map((step) => {
                const reached = count >= step;
                const tier = STEP_TIER[step];
                return (
                  <li key={step} className="flex flex-col items-center gap-1.5">
                    <span className={`w-12 h-12 rounded-full grid place-items-center ${reached ? 'bg-brand-500/20 ring-2 ring-brand-400' : 'bg-white/6'} transition-colors`}>
                      {tier ? <InviteBadge tier={tier} size={32} locked={!reached} /> : <UserRound className={`w-5 h-5 ${reached ? 'text-brand-300' : 'text-label-tertiary'}`} aria-hidden="true" />}
                    </span>
                    <span className={`text-[12px] font-semibold tabular-nums ${reached ? 'text-label' : 'text-label-tertiary'}`}>{step}</span>
                  </li>
                );
              })}
            </ol>
            {badge && <p className="mt-3 text-center text-[13px] text-brand-300">{t(BADGE_NAME[badge])}</p>}
          </div>

          {invitees.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">{t('inviteJoined')}</h3>
              {invitees.map((i) => <InviteeRow key={i.uid} uid={i.uid} spotApproved={i.spotApproved} />)}
            </div>
          )}

          {canClaim && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">{t('whoInvitedTitle')}</h3>
              <WhoInvitedForm onDone={() => undefined} />
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function InviteeRow({ uid, spotApproved }: Readonly<{ uid: string; spotApproved: boolean }>) {
  const t = useT();
  const openProfile = useOpenProfile();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchPublicProfile(uid).then((p) => live && setName(p?.username ?? null), () => undefined);
    return () => {
      live = false;
    };
  }, [uid]);
  return (
    <button type="button" onClick={() => openProfile(uid)} className="no-min-size flex items-center gap-3 h-12 px-1 text-left">
      <span className="w-8 h-8 rounded-full bg-brand-600 grid place-items-center text-white text-sm font-semibold">{(name ?? '?').charAt(0).toUpperCase()}</span>
      <span className="flex-1 min-w-0 truncate text-label">{name ?? '…'}</span>
      <span className={`text-[12px] font-semibold ${spotApproved ? 'text-brand-300' : 'text-label-tertiary'}`}>
        {spotApproved ? t('inviteeSpotDone', { xp: REFERRAL_XP.perInvite + REFERRAL_XP.firstSpotBonus }) : t('inviteeJoined', { xp: REFERRAL_XP.perInvite })}
      </span>
    </button>
  );
}
