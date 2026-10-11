'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import FounderBadge from '../ui/FounderBadge';
import ConfettiBurst from '../ui/ConfettiBurst';
import { useT } from '@/hooks/useT';
import { useLaunchChallenge } from '@/hooks/useLaunchChallenge';
import { CHALLENGE_STEPS, doneCount, FOUNDER_XP, STEP_TEXT } from '@/lib/challenge';
import { useToastStore } from '@/store/useToastStore';
import { playSound } from '@/store/useSoundStore';

/**
 * The launch challenge card (growth plan §8): five easy steps toward the Founder badge, ticked as
 * they are done; the badge is claimed with one tap once all are. Hidden outside the season, signed
 * out and once claimed.
 */
export default function ChallengeCard() {
  const t = useT();
  const { active, done, allDone, claimed, claim } = useLaunchChallenge();
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  if (!active || (claimed && !celebrate)) return null;
  const count = doneCount(done);

  const onClaim = async () => {
    setBusy(true);
    try {
      const result = await claim();
      if (result.badge) {
        setCelebrate(true);
        playSound('levelUp');
        useToastStore.getState().showToast(t('challengeClaimed', { xp: FOUNDER_XP }), 'success');
      } else {
        useToastStore.getState().showToast(t('challengeNotYet'), 'info');
      }
    } catch (error) {
      console.error('Challenge claim failed:', error);
      useToastStore.getState().showToast(t('genericError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative rounded-[20px] p-4 bg-gradient-to-br from-brand-700/40 to-surface-1 ring-1 ring-brand-400/25 overflow-hidden motion-safe:animate-item-in">
      <div className="flex items-center gap-3">
        <span className="relative">
          <FounderBadge size={44} />
          {celebrate && <ConfettiBurst />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-300">{t('challengeSeason')}</p>
          <h3 className="text-[17px] font-bold text-label leading-tight">{t(celebrate ? 'challengeDoneTitle' : 'challengeTitle')}</h3>
        </div>
        <span className="text-[13px] font-semibold text-label-secondary tabular-nums">{count}/{CHALLENGE_STEPS.length}</span>
      </div>
      {!celebrate && (
        <>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-brand-400 transition-[width] duration-700 ease-ios" style={{ width: `${(count / CHALLENGE_STEPS.length) * 100}%` }} />
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {CHALLENGE_STEPS.map((step) => (
              <li key={step} className="flex items-center gap-2.5 text-[14px]">
                <span className={`w-5 h-5 shrink-0 rounded-full grid place-items-center ${done[step] ? 'bg-brand-500 text-white' : 'ring-1 ring-white/25'}`}>
                  {done[step] && <Check className="w-3 h-3 motion-safe:animate-badge-pop" strokeWidth={3.5} aria-hidden="true" />}
                </span>
                <span className={done[step] ? 'text-label-tertiary line-through' : 'text-label'}>{t(STEP_TEXT[step])}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-label-tertiary">{t('challengeReward', { xp: FOUNDER_XP })}</p>
          {allDone && (
            <button type="button" onClick={onClaim} disabled={busy} className="mt-3 w-full h-11 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {t('challengeClaim')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
