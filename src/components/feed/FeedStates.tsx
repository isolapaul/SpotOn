'use client';

import { useState } from 'react';
import { CheckCircle2, LogIn, UserRoundSearch, Users } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import FollowChip from '../profile/FollowChip';

/** The feed's loading cards: avatar, a 4:5 photo and two lines, with a moving sheen. */
export function FeedSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 pt-2">
      {[0, 1].map((i) => (
        <div key={i} className="motion-safe:animate-item-in" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center gap-3 px-4 h-[60px]">
            <span className="w-10 h-10 rounded-full skeleton motion-safe:animate-shimmer" />
            <span className="flex flex-col gap-1.5">
              <span className="h-3.5 w-28 rounded skeleton motion-safe:animate-shimmer" />
              <span className="h-3 w-20 rounded skeleton motion-safe:animate-shimmer" />
            </span>
          </div>
          <div className="mx-3 aspect-[4/5] rounded-r3 skeleton motion-safe:animate-shimmer" />
          <div className="px-4 mt-3 flex flex-col gap-2">
            <span className="h-4 w-48 rounded skeleton motion-safe:animate-shimmer" />
            <span className="h-3 w-64 rounded skeleton motion-safe:animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** After the last followed spot: an animated tick and "You're all caught up". */
export function CaughtUp() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 px-8 pt-4 pb-8 text-center">
      <span className="relative w-16 h-16 grid place-items-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-brand-400/50 motion-safe:animate-ring-ping" />
        <CheckCircle2 className="w-14 h-14 text-brand-400 motion-safe:animate-check-draw" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <p className="text-label text-[17px] font-semibold">{t('feedCaughtUp')}</p>
      <p className="text-label-secondary text-[14px]">{t('feedCaughtUpHint')}</p>
    </div>
  );
}

/** A big friendly card at the top: signed out (sign in) or following nobody yet (find people). */
export function FeedInvite({ kind, onAction }: Readonly<{ kind: 'signedOut' | 'noFollows'; onAction: () => void }>) {
  const t = useT();
  const Icon = kind === 'signedOut' ? LogIn : UserRoundSearch;
  return (
    <div className="mx-4 mb-5 overflow-hidden rounded-r3 bg-linear-to-br from-brand-700/70 via-surface-1 to-surface-1 p-5 motion-safe:animate-rise-in">
      <span className="mb-3 w-12 h-12 rounded-full grid place-items-center bg-white/12 motion-safe:animate-float-1">
        <Users className="w-6 h-6 text-brand-200" aria-hidden="true" />
      </span>
      <p className="text-label text-[19px] font-bold leading-tight">{t(kind === 'signedOut' ? 'feedSignedOutTitle' : 'feedNoFollowsTitle')}</p>
      <p className="mt-1 text-label-secondary text-[15px] leading-snug">{t(kind === 'signedOut' ? 'feedSignedOutText' : 'feedNoFollowsText')}</p>
      <button
        type="button"
        onClick={onAction}
        className="no-min-size mt-4 h-11 px-5 rounded-full bg-brand-600 text-white font-semibold text-[15px] inline-flex items-center gap-2
          touch-manipulation active:scale-95 transition-transform"
      >
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        {t(kind === 'signedOut' ? 'signIn' : 'feedFindPeople')}
      </button>
    </div>
  );
}

export interface SuggestedPerson {
  uid: string;
  name: string;
  photo?: string;
  count: number;
}

/** "People to follow": a horizontal row of the most active posters the user does not follow. */
export function PeopleToFollow({ people }: Readonly<{ people: SuggestedPerson[] }>) {
  const t = useT();
  if (!people.length) return null;
  return (
    <section aria-label={t('feedPeopleToFollow')} className="mb-5">
      <h3 className="px-5 mb-2 text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">{t('feedPeopleToFollow')}</h3>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar snap-x">
        {people.map((p, i) => <PersonTile key={p.uid} person={p} index={i} />)}
      </div>
    </section>
  );
}

function PersonTile({ person, index }: Readonly<{ person: SuggestedPerson; index: number }>) {
  const t = useT();
  const openProfile = useOpenProfile();
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="snap-start shrink-0 w-[132px] rounded-r2 bg-surface-1 p-3 flex flex-col items-center gap-2 text-center motion-safe:animate-item-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button type="button" onClick={() => openProfile(person.uid)} className="no-min-size flex flex-col items-center gap-1.5 min-w-0 w-full">
        <span className="w-16 h-16 rounded-full overflow-hidden grid place-items-center bg-brand-600 text-white text-[22px] font-semibold ring-2 ring-white/10">
          {person.photo && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
            <img src={person.photo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setFailed(true)} />
          ) : (
            person.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="w-full truncate text-label text-[14px] font-semibold">{person.name}</span>
        <span className="text-label-tertiary text-[12px] tabular-nums">
          {t(person.count === 1 ? 'spotCountOne' : 'spotCountMany', { count: person.count })}
        </span>
      </button>
      <FollowChip uid={person.uid} />
    </div>
  );
}
