'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Search, Users, X } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import PersonRow from './PersonRow';
import FollowChip from './FollowChip';
import { useT } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useFollowStore, type FollowListKind, type PersonResult } from '@/store/useFollowStore';
import { useUserStore } from '@/store/useUserStore';
import { actionErrorKey } from '@/lib/callableErrors';

/** The exit animation (Tailwind `animate-card-out`). */
const CLOSE_MS = 260;
const KINDS: readonly FollowListKind[] = ['followers', 'following'];

type Loaded = { kind: FollowListKind; people: PersonResult[]; truncated: boolean } | { kind: FollowListKind; error: string };

interface FollowListSheetProps {
  uid: string;
  initial: FollowListKind;
  onClose: () => void;
}

/**
 * Someone's followers and the people they follow (tapping the counts on a profile): a bottom sheet
 * with a sliding two-way switch and a name filter. A row opens that profile; people the viewer does
 * not follow yet get a Follow chip.
 */
export default function FollowListSheet({ uid, initial, onClose }: Readonly<FollowListSheetProps>) {
  const t = useT();
  const me = useUserStore((s) => s.user?.uid ?? null);
  const openProfile = useOpenProfile();
  const getFollowList = useFollowStore((s) => s.getFollowList);
  const [kind, setKind] = useState<FollowListKind>(initial);
  const [loaded, setLoaded] = useState<Partial<Record<FollowListKind, Loaded>>>({});
  const [filter, setFilter] = useState('');
  const [closing, setClosing] = useState(false);
  const current = loaded[kind];

  useEffect(() => {
    if (loaded[kind]) return;
    let live = true;
    getFollowList(uid, kind)
      .then((r) => live && setLoaded((prev) => ({ ...prev, [kind]: { kind, ...r } })))
      .catch((error: unknown) => {
        console.error('Follow list failed:', error);
        const code = (error as { code?: unknown } | null)?.code;
        const msg = code === 'functions/permission-denied' ? 'private' : t(actionErrorKey(error));
        if (live) setLoaded((prev) => ({ ...prev, [kind]: { kind, error: msg } }));
      });
    return () => {
      live = false;
    };
  }, [uid, kind, loaded, getFollowList, t]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };
  const open = (person: string) => {
    close();
    openProfile(person);
  };

  const shown = useMemo(() => {
    if (!current || 'error' in current) return [];
    const q = filter.trim().toLowerCase().replace(/^@/, '');
    return q ? current.people.filter((p) => p.username.toLowerCase().includes(q)) : current.people;
  }, [current, filter]);

  return createPortal(
    <ModalShell
      variant="sheet"
      z="modal"
      align="center"
      onBackdropClick={close}
      backdropLabel={t('close')}
      outerClassName="items-end! px-0 pb-0"
      backdropClassName={`absolute inset-0 bg-black/50 touch-manipulation ${
        closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
      }`}
      panelClassName={`w-full max-w-[560px] h-[85vh] rounded-b-none! ${closing ? 'motion-safe:animate-card-out' : 'motion-safe:animate-card-in'}`}
    >
      <div role="dialog" aria-modal="true" aria-label={t(kind === 'followers' ? 'followers' : 'followingCount')} className="flex flex-col min-h-0 h-full">
        <span aria-hidden="true" className="mx-auto mt-2 w-9 h-[5px] rounded-full bg-white/25" />
        <div className="flex items-center gap-2 px-4 pt-3">
          {/* The switch: the thumb slides between the two halves */}
          <div role="tablist" className="relative flex-1 grid grid-cols-2 rounded-xl bg-white/6 p-1">
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white/15 transition-transform duration-300 ease-ios"
              style={{ transform: kind === 'following' ? 'translateX(100%)' : 'translateX(0)' }}
            />
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`no-min-size relative h-9 rounded-lg text-sm font-semibold transition-colors ${kind === k ? 'text-label' : 'text-label-secondary'}`}
              >
                {t(k === 'followers' ? 'followers' : 'followingCount')}
              </button>
            ))}
          </div>
          <button type="button" onClick={close} aria-label={t('close')} className="no-min-size w-11 h-11 grid place-items-center rounded-full">
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </div>
        <label className="mx-4 mt-3 flex items-center gap-2 h-10 px-3 rounded-xl bg-white/6 text-label-secondary">
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterPeople')}
            aria-label={t('filterPeople')}
            className="flex-1 min-w-0 bg-transparent text-label text-[15px] outline-none placeholder:text-label-tertiary"
          />
        </label>

        <div key={kind} className="flex-1 overflow-y-auto overscroll-contain mt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          {!current ? (
            <div aria-busy="true" className="px-4 pt-2 flex flex-col gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-white/6 motion-safe:animate-pulse" />
                  <span className="h-4 w-36 rounded bg-white/6 motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ) : 'error' in current ? (
            <Empty icon={current.error === 'private' ? 'lock' : 'users'} text={current.error === 'private' ? t('profilePrivate') : current.error} />
          ) : shown.length === 0 ? (
            <Empty icon="users" text={filter ? t('followListNoMatch') : t(kind === 'followers' ? 'followListEmptyFollowers' : 'followListEmptyFollowing')} />
          ) : (
            <>
              {shown.map((p, i) => (
                <PersonRow
                  key={p.uid}
                  person={p}
                  index={i}
                  onOpen={() => open(p.uid)}
                  trailing={me && p.uid !== me ? <FollowChip uid={p.uid} isPrivate={p.isPrivate} /> : undefined}
                />
              ))}
              {current.truncated && <p className="px-4 py-3 text-center text-[13px] text-label-tertiary">{t('followListTruncated')}</p>}
            </>
          )}
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}

function Empty({ icon, text }: Readonly<{ icon: 'lock' | 'users'; text: string }>) {
  const Icon = icon === 'lock' ? Lock : Users;
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center motion-safe:animate-item-in">
      <span className="w-14 h-14 rounded-full grid place-items-center bg-white/6">
        <Icon className="w-6 h-6 text-label-secondary" aria-hidden="true" />
      </span>
      <p className="text-label-secondary text-[15px]">{text}</p>
    </div>
  );
}
