import { useEffect, useRef, useState } from 'react';
import { useT } from './useT';
import { nativePlatform } from '@/lib/nativeApp';
import { activityChanges, activityStatusKey, type JobView } from '@/lib/liveActivity';
import { DELAYS } from '@/lib/constants';
import { useUploadStore } from '@/store/useUploadStore';
import { useUiStore } from '@/store/useUiStore';
import { useFeedStore } from '@/store/useFeedStore';
import { endActivity, listenQuickActions, setQuickActions, startActivity, updateActivity } from '@/store/nativeExtras';

/**
 * iPhone extras of the app (no-ops elsewhere):
 * - a running upload shows as a Live Activity in the Dynamic Island and on the lock screen;
 * - the home-screen quick actions (Add a spot, Feed, Near me), in the app's language.
 * `onAddSpot` is the map's own add flow (sign-in first when signed out).
 */
export function useIosExtras(ready: boolean, onAddSpot: () => void) {
  const t = useT();
  const ios = nativePlatform() === 'ios';

  // Quick actions: the labels follow the language.
  useEffect(() => {
    if (!ios) return;
    void setQuickActions([
      { type: 'add', title: t('quickActionAdd'), icon: 'plus.circle' },
      { type: 'feed', title: t('quickActionFeed'), icon: 'square.stack' },
      { type: 'nearby', title: t('quickActionNearby'), icon: 'location' },
    ]);
  }, [ios, t]);

  // An action waits until the app is ready (the map and the spots are there).
  // An object per action: the same action twice runs twice; `handled` keeps one from running again.
  const [action, setAction] = useState<{ type: string } | null>(null);
  const handled = useRef<{ type: string } | null>(null);
  useEffect(() => {
    if (!ios) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenQuickActions((type) => setAction({ type })).then((remove) => {
      if (cancelled) remove();
      else stop = remove;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [ios]);
  const addSpot = useRef(onAddSpot);
  useEffect(() => {
    addSpot.current = onAddSpot;
  });
  useEffect(() => {
    if (!ready || !action || handled.current === action) return;
    handled.current = action;
    if (action.type === 'add') addSpot.current();
    else if (action.type === 'feed' || action.type === 'nearby') {
      useFeedStore.getState().setNearMe(action.type === 'nearby');
      useUiStore.getState().openPanel('feed');
    }
  }, [ready, action]);

  // Uploads → Live Activities.
  const jobs = useUploadStore((state) => state.jobs);
  const running = useRef(new Map<string, number>());
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  useEffect(() => {
    if (!ios) return;
    const views: JobView[] = jobs.map(({ id, kind, status, progress }) => ({ id, kind, status, progress }));
    for (const change of activityChanges(views, running.current)) {
      const job = jobs.find((j) => j.id === change.id);
      const kind = job?.kind ?? 'spot';
      const state = { phase: change.phase, progress: change.progress, status: tRef.current(activityStatusKey(kind, change.phase)) };
      if (change.op === 'start') void startActivity(change.id, job?.label ?? '', kind, state);
      else if (change.op === 'update') void updateActivity(change.id, state);
      else void endActivity(change.id, state, DELAYS.liveActivityLinger / 1000);
      if (change.op === 'end') running.current.delete(change.id);
      else running.current.set(change.id, change.progress);
    }
  }, [ios, jobs]);
}
