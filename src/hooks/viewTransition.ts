import { flushSync } from 'react-dom';

// Screen-to-screen transitions (design phase 2) on the View Transitions API. 'sheet': a panel
// slides up on open and down on close (globals.css, the `panel` name on PanelShell). 'morph': the
// place card's photo grows into the spot details hero. Without the API, or with reduced motion, the
// update just happens (PanelShell's own CSS slide-up still plays on open).

export type TransitionKind = 'sheet' | 'morph';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Whether this browser animates panels with view transitions (then PanelShell skips its CSS slide). */
export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof (document as ViewTransitionDocument).startViewTransition === 'function';
}

export function runViewTransition(update: () => void, kind: TransitionKind = 'sheet'): void {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.vt = kind;
  const transition = doc.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => {
    if (root.dataset.vt === kind) delete root.dataset.vt;
  });
}
