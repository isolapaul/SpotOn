'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, MapPin, Search, UserRound } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useFollowStore, type PersonResult } from '@/store/useFollowStore';
import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import type { Spot } from '@/store/useSpotStore';
import { getLevelInfo } from '@/lib/levelUtils';
import { matchesSpotQuery, MIN_SEARCH_LENGTH, SPOT_SEARCH_LIMIT } from '@/lib/search';
import LevelBadge from '@/components/ui/LevelBadge';
import SpotRow from './SpotRow';

type Mode = 'spots' | 'people';
type PeopleState = { q: string; results: PersonResult[] | null; error: 'rate' | 'failed' | null };

interface SearchViewProps {
  spots: Spot[];
  rowProps: (spot: Spot) => Omit<Parameters<typeof SpotRow>[0], 'index'>;
  onCancel: () => void;
}

/**
 * Explore search (item 8): Spots (the loaded approved spots, by name) | People (usernames by
 * prefix on the server, signed in only, 2+ characters, 10 results).
 */
export default function SearchView({ spots, rowProps, onCancel }: Readonly<SearchViewProps>) {
  const t = useT();
  const signedIn = useUserStore((s) => !!s.user);
  const searchPeople = useFollowStore((s) => s.searchPeople);
  const openProfile = useOpenProfile();
  const search = useDiscoveryStore((s) => s.search);
  const setSearch = useDiscoveryStore((s) => s.setSearch);
  const mode: Mode = search?.mode ?? 'spots';
  const query = search?.query ?? '';
  const setMode = (m: Mode) => setSearch({ query, mode: m });
  const setQuery = (q: string) => setSearch({ query: q, mode });
  const [people, setPeople] = useState<PeopleState>({ q: '', results: null, error: null });
  const q = query.trim();
  const ready = q.length >= MIN_SEARCH_LENGTH;

  const spotResults = useMemo(
    () => (ready ? spots.filter((s) => s.status === 'approved' && matchesSpotQuery(s.name, q)).slice(0, SPOT_SEARCH_LIMIT) : []),
    [spots, q, ready],
  );

  // People: debounced, only the latest query's answer is kept.
  useEffect(() => {
    if (mode !== 'people' || !signedIn || !ready) return;
    let live = true;
    const timer = setTimeout(() => {
      searchPeople(q)
        .then((results) => live && setPeople({ q, results, error: null }))
        .catch((error: { details?: unknown; message?: string }) => {
          if (!live) return;
          setPeople({ q, results: null, error: error?.message === 'SEARCH_RATE_LIMIT' ? 'rate' : 'failed' });
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [mode, q, ready, signedIn, searchPeople]);

  const segment = (id: Mode, label: string, Icon: typeof MapPin) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={mode === id}
      onClick={() => setMode(id)}
      className="no-min-size relative h-8 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-label touch-manipulation"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  const peopleBody = () => {
    if (!signedIn) {
      return (
        <Empty text={t('signInToSearchPeople')}>
          <button type="button" onClick={() => useUiStore.getState().openPanel('auth')} className="mt-3 px-5 h-10 rounded-full bg-brand-600 text-white font-semibold">
            {t('signIn')}
          </button>
        </Empty>
      );
    }
    if (!ready) return <Empty text={t('searchMinChars', { count: MIN_SEARCH_LENGTH })} />;
    if (people.error === 'rate') return <Empty text={t('searchRateLimited')} />;
    if (people.error === 'failed') return <Empty text={t('genericError')} />;
    if (people.q !== q || people.results === null) return <Empty text={t('searching')} />;
    if (!people.results.length) return <Empty text={t('noPeopleFound')} />;
    return (
      <div className="rounded-[18px] bg-surface-1 overflow-hidden divide-y divide-white/6">
        {people.results.map((p, i) => <PersonRow key={p.uid} person={p} index={i} onOpen={() => openProfile(p.uid)} />)}
      </div>
    );
  };

  return (
    <div className="motion-safe:animate-fade-in">
      <div className="px-5 flex items-center gap-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <label className="flex-1 h-10 px-3 rounded-[12px] bg-white/8 flex items-center gap-2">
          <Search className="w-4 h-4 text-label-tertiary shrink-0" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('search')}
            placeholder={mode === 'spots' ? t('searchSpotsPlaceholder') : t('searchPeoplePlaceholder')}
            className="flex-1 min-w-0 bg-transparent text-label placeholder:text-label-tertiary focus:outline-hidden text-[16px]"
          />
        </label>
        <button type="button" onClick={onCancel} className="no-min-size h-10 px-1 text-brand-400 font-semibold text-[15px]">
          {t('cancel')}
        </button>
      </div>

      <div className="px-5 mt-3">
        <div role="radiogroup" aria-label={t('search')} className="relative grid grid-cols-2 p-0.5 rounded-[10px] bg-white/8">
          <span
            aria-hidden="true"
            className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-r1 bg-white/16 shadow-xs transition-transform duration-350 ease-ios"
            style={{ transform: mode === 'spots' ? 'translateX(0)' : 'translateX(100%)' }}
          />
          {segment('spots', t('spots'), MapPin)}
          {segment('people', t('people'), UserRound)}
        </div>
      </div>

      <div key={mode} className="px-4 mt-4">
        {mode === 'people' ? peopleBody() : !ready ? (
          <Empty text={t('searchMinChars', { count: MIN_SEARCH_LENGTH })} />
        ) : spotResults.length ? (
          <div className="rounded-[18px] bg-surface-1 overflow-hidden divide-y divide-white/6">
            {spotResults.map((spot, i) => <SpotRow key={spot.id} {...rowProps(spot)} index={i} />)}
          </div>
        ) : (
          <Empty text={t('noSpotsFound')} />
        )}
      </div>
    </div>
  );
}

function Empty({ text, children }: Readonly<{ text: string; children?: React.ReactNode }>) {
  return (
    <div className="flex flex-col items-center py-14 px-6 text-center motion-safe:animate-item-in">
      <p className="text-label-secondary">{text}</p>
      {children}
    </div>
  );
}

function PersonRow({ person, index, onOpen }: Readonly<{ person: PersonResult; index: number; onOpen: () => void }>) {
  const t = useT();
  const level = person.level ?? 1;
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="no-min-size w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/4 motion-safe:animate-item-in"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      <span aria-hidden="true" className="w-11 h-11 rounded-full overflow-hidden grid place-items-center bg-brand-600 text-white font-semibold shrink-0">
        {person.profilePictureURL && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
          <img src={person.profilePictureURL} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        ) : (
          person.username.charAt(0).toUpperCase()
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-label font-semibold text-[16px]">
          <span className="truncate">{person.username}</span>
          {person.isPrivate && <Lock className="w-3.5 h-3.5 text-label-tertiary shrink-0" aria-label={t('privateProfile')} />}
        </span>
        <span className="flex items-center gap-1 text-[13px] text-label-secondary">
          <LevelBadge level={level} size={14} />
          {t(getLevelInfo(level).nameKey)}
        </span>
      </span>
    </button>
  );
}
