'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Navigation, Users, X } from 'lucide-react';
import PanelShell from '../ui/PanelShell';
import FeedCard from './FeedCard';
import FeedComments from './FeedComments';
import { CaughtUp, FeedInvite, FeedSkeleton, PeopleToFollow } from './FeedStates';
import { useT } from '@/hooks/useT';
import { useFeed } from '@/hooks/useFeed';
import { useFeedStore } from '@/store/useFeedStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import { runViewTransition } from '@/hooks/viewTransition';
import { FEED_CAUGHT_UP_MIN, FEED_NEAR_KM, FEED_PREFETCH_CARDS, feedPhotos, suggestedPeople } from '@/lib/feed';
import { useImagePrefetch } from '@/hooks/useImagePrefetch';
import { useLocationStore } from '@/store/useLocationStore';
import { useToastStore } from '@/store/useToastStore';

/** Scrolled this far down, new posts announce themselves with the pill instead of shifting the list. */
const PILL_SCROLL_PX = 300;
const PEOPLE_TO_FOLLOW = 8;

interface FeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  /** Flies the map to the spot; back from its card returns here. */
  onShowOnMap: (spotId: string) => void;
}

/**
 * The following feed (Instagram-like): the newest spots of the people the user follows, each with
 * who shared it, then everyone else's earlier spots so the feed is never empty. Cards render a page
 * at a time as the list scrolls; the place and the scroll survive a trip to the map and back.
 */
export default function FeedPanel({ isOpen, onClose, userLocation, onShowOnMap }: Readonly<FeedPanelProps>) {
  if (!isOpen) return null;
  return <Feed onClose={onClose} userLocation={userLocation} onShowOnMap={onShowOnMap} />;
}

function Feed({ onClose, userLocation, onShowOnMap }: Readonly<Omit<FeedPanelProps, 'isOpen'>>) {
  const t = useT();
  const signedIn = useUserStore((s) => !!s.user);
  const nearMe = useFeedStore((s) => s.nearMe);
  const { followed, suggested, ready, followsAnyone } = useFeed(nearMe ? userLocation : null);
  const visibleCount = useFeedStore((s) => s.visibleCount);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  // A stable callback for the memoised cards (the page passes a new arrow on every render).
  const showRef = useRef(onShowOnMap);
  useEffect(() => {
    showRef.current = onShowOnMap;
  }, [onShowOnMap]);
  const showOnMap = useCallback((id: string) => showRef.current(id), []);
  const [scrolled, setScrolled] = useState(false);
  // The newest followed spot when the feed opened: posts above it arrived meanwhile.
  const [topId, setTopId] = useState<string | null | undefined>(undefined);

  // Opening the feed counts as seeing it (the launcher's dot goes out).
  useEffect(() => {
    useFeedStore.getState().markSeen(Date.now());
  }, [followed.length]);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = useFeedStore.getState().scrollTop;
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the first loaded top is the reference
  useEffect(() => { if (ready && topId === undefined) setTopId(followed[0]?.id ?? null); }, [ready, topId, followed]);
  const newCount = topId === undefined ? 0 : topId === null ? followed.length : Math.max(0, followed.findIndex((s) => s.id === topId));

  const items = useMemo(
    () => [...followed.map((spot) => ({ spot, suggested: false })), ...suggested.map((spot) => ({ spot, suggested: true }))],
    [followed, suggested],
  );
  const shown = items.slice(0, visibleCount);
  const shownFollowed = shown.filter((i) => !i.suggested);
  const shownSuggested = shown.filter((i) => i.suggested);
  const people = useMemo(() => (signedIn ? suggestedPeople(suggested, PEOPLE_TO_FOLLOW) : []), [signedIn, suggested]);
  const hasMore = visibleCount < items.length;
  // The next cards' first photos load ahead, so scrolling never waits for them.
  const ahead = useMemo(
    () => items.slice(visibleCount, visibleCount + FEED_PREFETCH_CARDS).map((i) => feedPhotos(i.spot)[0]?.url ?? ''),
    [items, visibleCount],
  );
  useImagePrefetch(ahead);

  // "Near me" needs the location: ask for it once (the chip shows it is waiting), else stay on
  // everyone. A location that goes away later switches back too.
  const [locating, setLocating] = useState(false);
  const pickNearMe = async () => {
    if (userLocation) return useFeedStore.getState().setNearMe(true);
    setLocating(true);
    const result = await useLocationStore.getState().request();
    setLocating(false);
    if (result === 'granted') useFeedStore.getState().setNearMe(true);
    else useToastStore.getState().showToast(t('locationDenied'), 'error');
  };
  useEffect(() => {
    if (nearMe && !userLocation && !locating) useFeedStore.getState().setNearMe(false);
  }, [nearMe, userLocation, locating]);
  const pickScope = (near: boolean) => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (near) void pickNearMe();
    else useFeedStore.getState().setNearMe(false);
  };

  // The next page when the end of the list comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) useFeedStore.getState().showMore();
    }, { root: scrollRef.current, rootMargin: '600px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  const toTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setTopId(followed[0]?.id ?? null);
  };
  const findPeople = () => runViewTransition(() => {
    useDiscoveryStore.getState().setSearch({ query: '', mode: 'people' });
    useUiStore.getState().openPanel('discovery');
  });
  const commentsSpot = commentsFor ? items.find((i) => i.spot.id === commentsFor)?.spot : undefined;

  const card = ({ spot, suggested: s }: { spot: (typeof items)[number]['spot']; suggested: boolean }, i: number) => (
    <FeedCard
      key={spot.id}
      spot={spot}
      index={i}
      suggested={s}
      now={now}
      userLocation={userLocation}
      onShowOnMap={showOnMap}
      onComments={setCommentsFor}
    />
  );

  return (
    <PanelShell
      onClose={onClose}
      backdropLabel="Close feed"
      variant="surface"
      overlays={commentsSpot && <FeedComments key={commentsSpot.id} spot={commentsSpot} onClose={() => setCommentsFor(null)} />}
    >
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          useFeedStore.getState().rememberScroll(top);
          if (top > PILL_SCROLL_PX !== scrolled) setScrolled(top > PILL_SCROLL_PX);
        }}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        {/* One phone-width column, also on tablets */}
        <div className="mx-auto w-full max-w-[560px]">
        {/* Large title */}
        <header className="px-5 pb-3 flex items-end justify-between gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}>
          <div className="min-w-0 motion-safe:animate-rise-in">
            <h2 className="text-[34px] leading-tight font-bold text-label">{t('feedTitle')}</h2>
            <p className="text-[15px] text-label-secondary">{t('feedSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="no-min-size mb-1.5 -mr-1.5 w-11 h-11 grid place-items-center rounded-full touch-manipulation"
          >
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </header>

        {/* Scope: everyone or near me */}
        <div role="radiogroup" aria-label={t('feedScope')} className="flex gap-2 px-5 pb-4">
          {([false, true] as const).map((near) => {
            const active = nearMe === near;
            const Icon = near ? Navigation : Users;
            return (
              <button
                key={String(near)}
                type="button"
                role="radio"
                aria-checked={active}
                aria-busy={near && locating}
                disabled={near && locating}
                onClick={() => pickScope(near)}
                className={`no-min-size h-11 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 touch-manipulation
                  transition-colors duration-200 active:scale-95 ${active ? 'bg-brand-600 text-white' : 'bg-white/8 text-label-secondary'}`}
              >
                <Icon className={`w-4 h-4 ${near && locating ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true" />
                {t(near ? 'feedNearMe' : 'feedEveryone')}
              </button>
            );
          })}
        </div>

        {!signedIn && <FeedInvite kind="signedOut" onAction={() => useUiStore.getState().openAuth()} />}
        {signedIn && ready && !followsAnyone && <FeedInvite kind="noFollows" onAction={findPeople} />}

        {!ready ? (
          <FeedSkeleton />
        ) : (
          <>
            {shownFollowed.map(card)}
            {shownSuggested.length > 0 && (
              <>
                {followed.length >= FEED_CAUGHT_UP_MIN && <CaughtUp />}
                <div className="flex items-center gap-3 px-5 mb-3 motion-safe:animate-item-in">
                  <span className="h-px flex-1 bg-white/10" />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">
                    {t(followed.length ? 'feedEarlierSpots' : 'feedSuggestedSpots')}
                  </h3>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <PeopleToFollow people={people} />
                {shownSuggested.map((item, i) => card(item, i))}
              </>
            )}
            {items.length === 0 && (
              <p className="px-8 py-16 text-center text-label-secondary">{nearMe ? t('feedNothingNear', { km: FEED_NEAR_KM }) : t('noSpotsFound')}</p>
            )}
            {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
        </div>
      </div>

      {/* New posts while scrolled down */}
      {scrolled && newCount > 0 && (
        <button
          type="button"
          onClick={toTop}
          className="no-min-size absolute left-1/2 -translate-x-1/2 z-10 h-10 pl-3 pr-4 rounded-full bg-brand-600 text-white
            text-[14px] font-semibold shadow-float inline-flex items-center gap-1.5 touch-manipulation active:scale-95 motion-safe:animate-toast-in"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
        >
          <ArrowUp className="w-4 h-4" aria-hidden="true" />
          {t(newCount === 1 ? 'feedNewPostsOne' : 'feedNewPostsMany', { count: newCount })}
        </button>
      )}
    </PanelShell>
  );
}
