'use client';

import { useEffect, useState } from 'react';
import { Globe2, Share } from 'lucide-react';
import BottomSheet from '../ui/BottomSheet';
import ProfileSpotCard from '../profile/ProfileSpotCard';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { shareLink } from '@/hooks/shareLink';
import { fetchPublicList, type PublicListHit } from '@/store/publicLists';
import { fetchPublicProfile } from '@/store/publicProfiles';
import { useSpotStore } from '@/store/useSpotStore';
import { useUiStore } from '@/store/useUiStore';
import { publicListPath } from '@/lib/lists';
import { SITE_URL } from '@/lib/constants';
import type { Spot } from '@/store/useSpotStore';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; list: PublicListHit; owner: string };

/** A public list (growth plan §7): its owner, its spots (a tap flies to one) and a share button. */
export default function PublicListSheet({ uid, listId, onClose }: Readonly<{ uid: string; listId: string; onClose: () => void }>) {
  const t = useT();
  const openProfile = useOpenProfile();
  const spots = useSpotStore((s) => s.spots);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    Promise.all([fetchPublicList(uid, listId), fetchPublicProfile(uid).catch(() => null)]).then(([list, profile]) => {
      if (!live) return;
      setState(list ? { status: 'ready', list, owner: profile?.username ?? '' } : { status: 'missing' });
    });
    return () => {
      live = false;
    };
  }, [uid, listId]);

  const title = state.status === 'ready' ? state.list.name : t('publicList');
  const inList = state.status === 'ready'
    ? state.list.spotIds.map((id) => spots.find((s) => s.id === id && s.status === 'approved')).filter((s): s is Spot => !!s)
    : [];

  return (
    <BottomSheet title={title} onClose={onClose} heightClassName="h-[85vh]">
      {(close) => (
        <div className="flex flex-col gap-3 pt-1">
          {state.status === 'loading' && <p className="py-10 text-center text-label-secondary">{t('loading')}</p>}
          {state.status === 'missing' && <p className="py-10 text-center text-label-secondary">{t('publicListMissing')}</p>}
          {state.status === 'ready' && (
            <>
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-brand-300 shrink-0" aria-hidden="true" />
                <p className="flex-1 min-w-0 text-[14px] text-label-secondary">
                  {state.owner ? (
                    <button type="button" onClick={() => { close(); openProfile(uid); }} className="no-min-size font-semibold text-label">
                      @{state.owner}
                    </button>
                  ) : null}
                  {' · '}
                  {t(inList.length === 1 ? 'listSpotCountOne' : 'listSpotCount', { count: inList.length })}
                </p>
                <button
                  type="button"
                  onClick={() => void shareLink({ title: state.list.name, url: `${SITE_URL}${publicListPath(uid, listId)}` }, t('linkCopied'))}
                  aria-label={t('share')}
                  className="no-min-size w-10 h-10 grid place-items-center rounded-full bg-white/8"
                >
                  <Share className="w-4 h-4 text-label-secondary" aria-hidden="true" />
                </button>
              </div>
              {inList.length === 0 ? (
                <p className="py-8 text-center text-label-secondary text-sm">{t('listEmpty')}</p>
              ) : (
                inList.map((spot) => (
                  <ProfileSpotCard key={spot.id} spot={spot} onOpen={() => { close(); useUiStore.getState().openSpotLink(spot.id); }}>
                    <span />
                  </ProfileSpotCard>
                ))
              )}
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
