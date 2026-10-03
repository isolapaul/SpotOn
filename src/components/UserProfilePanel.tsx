'use client';

import { actionErrorKey } from '@/lib/callableErrors';
import { ListCards, ListView } from './lists/ListsRow';
import type { SpotList as SpotListType } from '@/lib/lists';
import { useEffect, useMemo, useState } from 'react';
import { Lock, X } from 'lucide-react';
import PanelShell from './ui/PanelShell';
import LevelBadge from './ui/LevelBadge';
import StarRating from './ui/StarRating';
import ProfileSpotCard from './profile/ProfileSpotCard';
import FollowButton from './profile/FollowButton';
import ProfileMenu from './profile/ProfileMenu';
import { useT } from '@/hooks/useT';
import { useCategoryLabel } from '@/hooks/useCategory';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { useFollowStore, type ProfileView } from '@/store/useFollowStore';
import { fetchPublicProfile, type PublicProfile } from '@/store/publicProfiles';
import { getLevelInfo, getUserNameColor, profileLevel } from '@/lib/levelUtils';
import { resolveNameFontClass } from '@/lib/nameStyle';
import { averageRating } from '@/lib/rating';

interface UserProfilePanelProps {
  /** The profile shown; null closes the panel. */
  uid: string | null;
  onClose: () => void;
  onOpenSpot: (spotId: string) => void;
}

type Tab = 'spots' | 'saved' | 'lists';

/**
 * Someone's profile page (item 8): header (picture, name, level, bio), counts, follow button.
 * A public profile shows their approved spots (and saved spots if they share them); a private one
 * only to accepted followers. Opened from a spot's creator, a reviewer or the people search.
 */
export default function UserProfilePanel({ uid, onClose, onOpenSpot }: Readonly<UserProfilePanelProps>) {
  if (!uid) return null;
  return <UserProfile key={uid} uid={uid} onClose={onClose} onOpenSpot={onOpenSpot} />;
}

function UserProfile({ uid, onClose, onOpenSpot }: Readonly<{ uid: string; onClose: () => void; onOpenSpot: (id: string) => void }>) {
  const t = useT();
  const me = useUserStore((s) => s.user?.uid ?? null);
  const openAuth = () => useUiStore.getState().openPanel('auth');
  const showToast = useToastStore((s) => s.showToast);
  const follows = useFollowStore();
  const spots = useSpotStore((s) => s.spots);
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [view, setView] = useState<ProfileView | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('spots');

  useEffect(() => {
    let live = true;
    Promise.all([fetchPublicProfile(uid), follows.getProfile(uid)])
      .then(([p, v]) => {
        if (!live) return;
        setProfile(p);
        setView(v);
      })
      .catch((error) => {
        console.error('Profile failed to load:', error);
        if (live) setProfile(null);
      });
    return () => {
      live = false;
    };
    // `follows` is a stable store; `version` reloads after a follow change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, me, version]);

  const byId = useMemo(() => new Map(spots.filter((s) => s.status === 'approved').map((s) => [s.id, s])), [spots]);
  const pick = (ids: string[] | undefined): Spot[] => (ids ?? []).map((id) => byId.get(id)).filter((s): s is Spot => !!s);
  const ownSpots = pick(view?.spotIds);
  const savedSpots = view?.savedSpotIds ? pick(view.savedSpotIds) : null;
  const list = tab === 'saved' && savedSpots ? savedSpots : ownSpots;
  const lists: SpotListType[] = (view?.lists ?? []).map((l) => ({ ...l, shared: true, updatedAt: 0 }));
  const [openList, setOpenList] = useState<string | null>(null);
  const shownList = tab === 'lists' ? lists.find((l) => l.id === openList) : undefined;
  const tabs: Tab[] = ['spots', ...(savedSpots ? ['saved' as const] : []), ...(lists.length ? ['lists' as const] : [])];

  const act = async (run: (me: string) => Promise<unknown>, done?: string) => {
    if (!me) return openAuth();
    setBusy(true);
    try {
      await run(me);
      if (done) showToast(done, 'success');
      setVersion((v) => v + 1);
    } catch (error) {
      console.error('Follow action failed:', error);
      showToast(t(actionErrorKey(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const level = profileLevel(profile);
  const name = profile?.username ?? '';

  return (
    <PanelShell onClose={onClose} backdropLabel="Close user profile" variant="surface">
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        <div className="flex justify-end px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
          {profile && view && me && me !== uid && (
            <ProfileMenu uid={uid} name={profile.username ?? ''} blocked={view.blocked === true} onChanged={() => setVersion((v) => v + 1)} />
          )}
          <button type="button" onClick={onClose} aria-label={t('close')} className="no-min-size w-11 h-11 grid place-items-center rounded-full">
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </div>

        {profile === undefined ? (
          <div className="px-5 pt-6 flex flex-col items-center gap-3" aria-busy="true">
            <div className="w-24 h-24 rounded-full bg-white/6 motion-safe:animate-pulse" />
            <div className="w-40 h-6 rounded-lg bg-white/6 motion-safe:animate-pulse" />
          </div>
        ) : profile === null ? (
          <p className="px-5 pt-10 text-center text-label-secondary">{t('profileNotFound')}</p>
        ) : (
          <div className="px-5 motion-safe:animate-item-in">
            <Header profile={profile} level={level} />
            <Stats spots={view?.spotIds?.length ?? null} followers={profile.followersCount ?? 0} following={profile.followingCount ?? 0} />

            {view?.blocked ? (
              <p className="mt-6 text-center text-label-secondary text-sm">{t('youBlockedThem')}</p>
            ) : view && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <FollowButton
                  relation={view.relation}
                  isPrivate={profile.isPrivate === true}
                  busy={busy}
                  onFollow={() => act((m) => follows.follow(m, uid))}
                  onUnfollow={() => act((m) => follows.unfollow(m, uid))}
                />
                {view.followsYou && (
                  <p className="text-[13px] text-label-secondary">
                    {t('followsYou')} ·{' '}
                    <button type="button" disabled={busy} onClick={() => act((m) => follows.removeFollower(m, uid), t('followerRemoved'))} className="no-min-size text-red-300 font-medium">
                      {t('removeFollower')}
                    </button>
                  </p>
                )}
              </div>
            )}

            {view?.blocked ? null : view && !view.canView ? (
              <div className="mt-8 rounded-[18px] bg-surface-1 p-6 text-center motion-safe:animate-item-in">
                <span className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center bg-white/6">
                  <Lock className="w-5 h-5 text-label-secondary" aria-hidden="true" />
                </span>
                <p className="text-label font-semibold">{t('profilePrivate')}</p>
                <p className="text-label-secondary text-sm mt-1">{t('profilePrivateHint', { name })}</p>
              </div>
            ) : view ? (
              <div className="mt-6">
                {tabs.length > 1 && (
                  <div role="tablist" className={`mb-3 grid ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} rounded-xl bg-white/6 p-1`}>
                    {tabs.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={tab === k}
                        onClick={() => { setTab(k); setOpenList(null); }}
                        className={`no-min-size h-9 rounded-lg text-sm font-semibold transition-colors ${tab === k ? 'bg-white/15 text-label' : 'text-label-secondary'}`}
                      >
                        {{ spots: t('spots'), saved: t('favorites'), lists: t('lists') }[k]}
                      </button>
                    ))}
                  </div>
                )}
                {tab === 'lists' ? (
                  shownList ? (
                    <ListView list={shownList} spots={[...byId.values()]} onBack={() => setOpenList(null)} onOpenSpot={onOpenSpot} editable={false} />
                  ) : (
                    <ListCards lists={lists} onOpen={setOpenList} title={false} />
                  )
                ) : (
                  <SpotList spots={list} onOpenSpot={onOpenSpot} empty={tab === 'saved' ? t('noSavedSpotsShared') : t('noSpotsYet')} />
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function Header({ profile, level }: Readonly<{ profile: PublicProfile; level: number }>) {
  const info = getLevelInfo(level);
  const name = profile.username ?? '';
  const [failed, setFailed] = useState(false);
  const picture = !failed ? profile.profilePictureURL : null;
  return (
    <div className="flex flex-col items-center text-center">
      <span className="w-24 h-24 rounded-full overflow-hidden grid place-items-center bg-brand-600 text-white text-[36px] font-semibold ring-4 ring-white/6">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
          <img src={picture} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        ) : (
          name.charAt(0).toUpperCase() || 'U'
        )}
      </span>
      <h2
        className={`mt-3 text-[26px] font-bold leading-tight break-all ${resolveNameFontClass(profile.customNameFont)}`}
        style={{ color: getUserNameColor(level, profile.customNameColor ?? undefined) }}
      >
        {name}
      </h2>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${info.bgColor} ${info.textColor}`}>
        <LevelBadge level={level} size={18} />
        <LevelName level={level} />
      </span>
      {profile.bio && <p className="mt-3 max-w-sm text-[15px] text-label-secondary whitespace-pre-line wrap-break-word">{profile.bio}</p>}
    </div>
  );
}

function LevelName({ level }: Readonly<{ level: number }>) {
  const t = useT();
  return <>{t('levelLabel', { level })} · {t(getLevelInfo(level).nameKey)}</>;
}

function Stats({ spots, followers, following }: Readonly<{ spots: number | null; followers: number; following: number }>) {
  const t = useT();
  const stat = (value: number | null, label: string) => (
    <div className="flex-1 flex flex-col items-center py-3">
      <span className="text-[20px] font-bold leading-tight text-label tabular-nums">{value ?? '–'}</span>
      <span className="text-[13px] text-label-secondary">{label}</span>
    </div>
  );
  return (
    <div className="mt-5 w-full flex rounded-[18px] bg-surface-1 divide-x divide-white/6">
      {stat(spots, t('spots'))}
      {stat(followers, t('followers'))}
      {stat(following, t('followingCount'))}
    </div>
  );
}

function SpotList({ spots, onOpenSpot, empty }: Readonly<{ spots: Spot[]; onOpenSpot: (id: string) => void; empty: string }>) {
  const categoryLabel = useCategoryLabel();
  if (!spots.length) return <p className="py-8 text-center text-label-secondary text-sm">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {spots.map((spot, i) => (
        <div key={spot.id} className="motion-safe:animate-item-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <ProfileSpotCard spot={spot} onOpen={() => onOpenSpot(spot.id)}>
            <span className="mt-1.5 flex items-center gap-2 text-[13px] text-label-tertiary">
              <StarRating rating={Math.round(averageRating(spot.reviews))} size="sm" emptyTone="dim" />
              <span>{categoryLabel(spot.category)}</span>
            </span>
          </ProfileSpotCard>
        </div>
      ))}
    </div>
  );
}
