'use client';

import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { recentPublicLists, searchPublicLists, type PublicListHit } from '@/store/publicLists';
import { useUiStore } from '@/store/useUiStore';
import { MIN_SEARCH_LENGTH } from '@/lib/search';

/**
 * Explore search, "Lists" (growth plan §7): public lists by name (prefix), or the newest ones
 * before typing. A row opens the list's sheet.
 */
export default function ListSearchResults({ query }: Readonly<{ query: string }>) {
  const t = useT();
  const q = query.trim();
  const ready = q.length >= MIN_SEARCH_LENGTH;
  const key = ready ? q.toLowerCase() : '';
  const [state, setState] = useState<{ key: string; hits: PublicListHit[] | null; failed: boolean }>({ key: '\u0000', hits: null, failed: false });

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      (key ? searchPublicLists(key) : recentPublicLists()).then(
        (hits) => live && setState({ key, hits, failed: false }),
        (error: unknown) => {
          console.error('List search failed:', error);
          if (live) setState({ key, hits: null, failed: true });
        },
      );
    }, key ? 300 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (state.key !== key) return <p className="py-14 text-center text-label-secondary">{t('searching')}</p>;
  if (state.failed) return <p className="py-14 text-center text-label-secondary">{t('genericError')}</p>;
  if (!state.hits?.length) return <p className="py-14 text-center text-label-secondary">{t(key ? 'noListsFound' : 'noPublicListsYet')}</p>;
  return (
    <div className="flex flex-col gap-2">
      {!key && <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-label-tertiary">{t('newPublicLists')}</h3>}
      <div className="rounded-[18px] bg-surface-1 overflow-hidden divide-y divide-white/6">
        {state.hits.map((h, i) => (
          <button
            key={`${h.uid}/${h.id}`}
            type="button"
            onClick={() => useUiStore.getState().openPublicList({ uid: h.uid, listId: h.id })}
            className="no-min-size w-full flex items-center gap-3 px-4 h-[60px] text-left motion-safe:animate-item-in"
            style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
          >
            <span className="w-9 h-9 rounded-xl grid place-items-center bg-brand-500/15 text-brand-300 shrink-0">
              <ListChecks className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-label font-semibold">{h.name}</span>
              <span className="block text-[12px] text-label-tertiary">{t(h.spotIds.length === 1 ? 'listSpotCountOne' : 'listSpotCount', { count: h.spotIds.length })}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
