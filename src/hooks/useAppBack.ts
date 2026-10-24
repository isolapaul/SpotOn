import { useEffect, useRef } from 'react';
import { hasBackStep, useUiStore } from '@/store/useUiStore';
import { closeTopOverlay, useOverlayStore } from '@/store/useOverlayStore';
import { runViewTransition } from './viewTransition';
import { useSystemBack } from './useSystemBack';

/**
 * The app's one way back: a sheet over a panel (comments, likers, follower lists) closes first,
 * then the panel steps back. Escape and the system back (Android back gesture, browser Back) do
 * the same; Escape not while the tour is open (it has its own keys). Returns the back action.
 */
export function useAppBack(showTour: boolean): () => void {
  const activePanel = useUiStore((s) => s.activePanel);
  const previewSpotId = useUiStore((s) => s.previewSpotId);
  const canGoBack = useUiStore(hasBackStep);
  const overlays = useOverlayStore((s) => s.stack.length);
  const back = () => {
    if (closeTopOverlay()) return;
    runViewTransition(useUiStore.getState().goBack);
  };
  // Escape does what the system back does (keyboards, ChromeOS, desktop); the tour has its own keys.
  const tourRef = useRef(showTour);
  useEffect(() => {
    tourRef.current = showTour;
  }, [showTour]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || tourRef.current) return;
      // Not while typing: Escape there must never throw away a draft (a review, a new spot).
      if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (closeTopOverlay()) return;
      if (hasBackStep(useUiStore.getState())) runViewTransition(useUiStore.getState().goBack);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // The system back steps back in the app while anything is open.
  useSystemBack(canGoBack || overlays > 0, `${JSON.stringify(activePanel)}|${previewSpotId}|${overlays}`, back);
  return back;
}
