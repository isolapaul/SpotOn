# T25 — Shared UI primitives (PanelShell, ModalShell, swipe, stars, z-index)

**Phase:** 5 · **Depends on:** T24 · **Risk:** med · **Decisions:** —
**Audit refs:** DUP-02, DUP-03, DUP-04, DUP-08, BUG-22

## Goal
- Extract the hand-rolled overlays, swipe gestures and star rows into shared primitives.
- Migrate every call site to them, one component per commit.
- The rendered DOM, classes, gestures and stacking order stay identical, and the e2e suite stays green after each commit.

## Context
Line numbers are from `eee5668`; re-locate by landmark. FilterPanel and DistanceSelector were deleted by T03. The z-index scale `Z` lives in `src/lib/constants.ts` (T23); Tailwind scans `src/lib` since T22.

**Full-screen panels (DUP-03).** Three copies:

| Site | Root | Backdrop | Inner panel classes | aria-label |
|---|---|---|---|---|
| ProfilePanel root (currently at :232) | `fixed inset-0 z-[60] animate-slide-up`, style `backgroundColor:'#0f172a'` | `<button type="button" tabIndex={-1}>` `absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default`, click and Escape close | `absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl` | `Close profile panel` |
| DiscoveryPanel root (:161) | same | same | same | `Close discovery panel` |
| SpotDetailsPanel root (:457) | same | same **plus** `pointer-events-auto` | `absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 pointer-events-none` | `Close spot details` |

All three put `transform: translateX(px)` on the inner panel, with `transition: dragging ? 'none' : 'transform 0.3s ease-out'`, and attach the touch handlers there.

**Swipe (DUP-02).** Per-site behaviour to preserve:

| Site | Threshold | Direction | Tracking | Action |
|---|---|---|---|---|
| ProfilePanel `handleTouch*` (:196-229) | 150 | right only | `touchmove` updates current X **only while `diff > 0`**; translate = `max(0, cur-start)` | close |
| DiscoveryPanel `handleTouch*` (:110-148) | 150 | right only | same as Profile | close |
| SpotDetailsPanel `useSwipeDismiss` (:31-49) | 100 | **both** (`Math.abs(dx) > 100`) | always updates; translate = `cur-start` (can be negative) | close |
| SpotDetailsPanel gallery (inline, :818-826) | 50 | both | always updates; translate = `cur-start`, transition `transform 0.2s ease-out` | `dx > 50` → prev, `dx < -50` → next, only when `>1` image |

All sites reset to the initial state on touchend and ignore move/end while not dragging.

**Centered modals (DUP-04).** Two visual variants:
- **`glass` variant:**
  - AuthModal (:216): `z-[2000]`, outer `fixed inset-0 flex items-center justify-center p-4 animate-fade-in` with style `backgroundColor:'rgba(15, 23, 42, 0.5)'`; backdrop button `bg-black/70 backdrop-blur-xl cursor-default` (click + Escape); panel `relative glass-card max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-8 animate-slide-up` plus safe-area margin style.
  - AddSpotModal (:160): same, but `z-[60]`, panel `max-w-lg … p-6`, backdrop closes via `handleClose`.
  - UsernameSetupModal (:97): `z-[3500]`; backdrop is a **non-interactive `<div>`** `absolute inset-0 bg-black/70 backdrop-blur-xl`; panel `relative glass-card max-w-md w-full p-8 animate-slide-up`, with no max-h, scroll or margins.
- **`slate` variant:**
  - NotificationCenter modal (:110): `z-[2000]`, outer `… p-4 animate-fade-in` (no bg style); backdrop button `bg-black/50 backdrop-blur-sm touch-manipulation`; panel `relative bg-slate-900 w-[90%] max-w-md rounded-3xl shadow-2xl border-2 border-white/20 overflow-hidden animate-scale-in max-h-[80vh] flex flex-col`.
  - FeedbackPanel (:87): `z-[2000]`, outer `items-start` with safe-area padding style; panel `… w-[92%] max-w-2xl … max-h-[90vh] …`.
- **Out of scope** (distinct markup, left as is and listed in the commit): LanguageSelector (non-dismissible, `bg-black/60 backdrop-blur-md`), MapThemeSwitcher modal, the ProfilePanel level-info modal (`z-[70]`, `bg-black/80`, `glass-card … rounded-2xl animate-scale-in`), NotificationSettingsModal (`z-[9999]`, no backdrop element), InstallGate. Migrate one of these only if its classes can be reproduced exactly through `ModalShell` props.

**Stars (DUP-08).** Current variants:
- SpotDetailsPanel `StarRow` (:51-63): wrapper `flex gap-0.5`, size `sm` = `w-4 h-4`, `md` = `w-5 h-5`, filled `text-yellow-400 fill-yellow-400`, empty `text-white/30`.
- SpotDetailsPanel review form (:707-711): interactive `<button>`s with class `transition-all duration-200 active:scale-95` wrapping `w-5 h-5` stars, wrapper `flex gap-1`, empty `text-white/30`.
- ProfilePanel favourites (:837-848) and DiscoveryPanel (:311-322): wrapper `flex gap-0.5`, `w-3 h-3`, empty `text-white/20`, rating rounded.
- SpotInfoWindow (:471-480): **no wrapper**. The five `<Star className="w-4 h-4 …">` are direct children of the row `flex items-center gap-1`; empty `text-white/30`.

**BUG-22:** SettingsPanel uses `z-40` (backdrop) and `z-50` (sheet) while mounted inside ProfilePanel's `fixed … z-[60]` root. They stack correctly only because they are inside that context. Express these with the scale (`Z.panelInner*`, see step 1) and add a comment explaining the nesting. The numbers stay the same.

**E2E landmarks that must survive:** every `aria-label` above; ids `spot-name`, `spot-category`, `spot-description`, `spot-image`, `review-comment`, `edit-username`, `admin-email`, `username`, `email`, `password`; visible texts; `role="button"` on the hero. Grep the T04 specs for `getByRole|getByLabel|getByText|locator(` and keep every target.

## Files
- Create:
  - `src/components/ui/PanelShell.tsx`, `src/components/ui/ModalShell.tsx`, `src/components/ui/StarRating.tsx`
  - `src/hooks/useHorizontalSwipe.ts`, `src/hooks/useSwipeToClose.ts`
  - tests: `src/hooks/useHorizontalSwipe.test.ts` (and component tests if T01 has jsdom and Testing Library; otherwise a pure reducer test, see step 2).
- Modify: `src/lib/constants.ts` (extend `Z` for nested layers), ProfilePanel, DiscoveryPanel, SpotDetailsPanel, SpotInfoWindow, AuthModal, AddSpotModal, UsernameSetupModal, NotificationCenter, FeedbackPanel, SettingsPanel, and every remaining `z-[…]` literal site that maps 1:1 to `Z`.

## Steps
1. **Z scale:** extend `Z` with `panelInnerBackdrop: 'z-40'` and `panelInnerSheet: 'z-50'` (SettingsPanel), and `mapBase: 'z-0'`. Replace z-index literals in the migrated components with `Z.*`. The class strings are the same, so the DOM is unchanged.
2. **`useHorizontalSwipe({ threshold, direction: 'right' | 'both', onSwipe: (dir: 'left' | 'right') => void, enabled?: boolean })`** returns `{ dragging, offset, handlers: { onTouchStart, onTouchMove, onTouchEnd } }`.
   - Implement the state transitions as a pure reducer (`swipeReducer`), so it is unit-testable without a DOM.
   - `direction: 'right'` reproduces the Profile/Discovery quirks: only update while `cur - start > 0`, and `offset = max(0, cur - start)`.
   - `'both'` always updates, with `offset = cur - start`.
   - On end: if `right` and `dx > threshold`, call `onSwipe('right')`. If `both`: `dx > threshold` gives `'right'`, and `dx < -threshold` gives `'left'` (SpotDetails' `Math.abs` means either direction closes).
   - **`useSwipeToClose({ onClose, threshold, direction })`** is a thin wrapper that calls `onClose` on any swipe.
   - Call sites:

     | Site | Hook | Options |
     |---|---|---|
     | ProfilePanel | `useSwipeToClose` | `threshold: SWIPE_THRESHOLDS.panel (150)`, `direction: 'right'` |
     | DiscoveryPanel | `useSwipeToClose` | `threshold: 150`, `direction: 'right'` |
     | SpotDetailsPanel | `useSwipeToClose` | `threshold: SWIPE_THRESHOLDS.spotDetails (100)`, `direction: 'both'` |
     | Gallery | `useHorizontalSwipe` | `threshold: 50`, `direction: 'both'`, `enabled: images.length > 1` for the navigation callbacks. The drag translate still follows the finger when there is 1 image, as today. |
   - **AddSpotModal must not get a swipe** (intentionally disabled today).
3. **`PanelShell`** props: `{ onClose, backdropLabel, variant: 'gray' | 'slate', swipe: ReturnType<typeof useSwipeToClose>, children }`.
   - Renders exactly the root, backdrop button and inner div from the table.
   - `variant: 'slate'` adds SpotDetails' `pointer-events-none` on the inner panel and `pointer-events-auto` on the backdrop.
   - The caller keeps its `if (!isOpen) return null` logic; PanelShell does not add open/close animation logic.
4. **`ModalShell`** props: `{ variant: 'glass' | 'slate', z: keyof typeof Z, onBackdropClick?: () => void, backdropLabel?: string, align?: 'center' | 'start', outerStyle?, panelClassName: string, panelStyle?, children }`.
   - The variant supplies the default outer, backdrop and panel base classes from the table.
   - Without `onBackdropClick`, the backdrop renders as a plain `<div>` (UsernameSetupModal).
   - `panelClassName` carries the per-site size classes, so the final class string equals today's. Order may differ, but the **set** of classes must be identical; verify with the DOM snapshot check in Acceptance.
5. **`StarRating`** props: `{ rating: number, size: 'xs' | 'sm' | 'md', emptyTone: 'faint' | 'dim', gap?: 'gap-0.5' | 'gap-1', wrapper?: boolean, onSelect?: (n: number) => void }`.
   - `xs` = `w-3 h-3`, `sm` = `w-4 h-4`, `md` = `w-5 h-5`; `faint` = `text-white/20`, `dim` = `text-white/30`.
   - `wrapper={false}` renders a fragment (SpotInfoWindow).
   - `onSelect` renders the review form's buttons.
   - The caller passes the already-rounded rating, as each site does today.
6. **Migrate one component per commit**, running `npm run verify` and `npm run test:e2e` after each: DiscoveryPanel → ProfilePanel → SpotDetailsPanel (panel, gallery, StarRow, review stars) → SpotInfoWindow → AuthModal → AddSpotModal → UsernameSetupModal → NotificationCenter → FeedbackPanel → SettingsPanel (z-scale only).
7. **DOM equality check**, for each migrated component:
   - Before migrating, capture `outerHTML` of the open overlay in a small Playwright helper, or in a Vitest + RTL render if available. Store the snapshots under the e2e dir as `__dom__/<component>.html`.
   - After migrating, compare with class lists normalised (split, sort, join). Delete the snapshots at the end of the task, or keep them as regression tests if they are stable.

## Must NOT change
- Swipe thresholds and directions per site (table above), including the Profile/Discovery "ignore leftward move" quirk and the SpotDetails either-direction close.
- DOM structure, class sets, inline styles, aria-labels, ids and `tabIndex` of every migrated overlay.
- Stacking order: all numeric z-index values stay the same.
- Which modals close on backdrop click or Escape (UsernameSetupModal and LanguageSelector do not).
- Star rounding and colours per site.

## Acceptance
```bash
npm run verify
npx vitest run src/hooks/useHorizontalSwipe.test.ts
npm run test:e2e
grep -rn "dragStartX\|useSwipeDismiss\|SWIPE_INITIAL" src/components             # → none
grep -rn "\[1, 2, 3, 4, 5\].map" src/components | grep -v "ProfilePanel"         # → none (level list in ProfilePanel is not stars)
grep -rnE "z-\[(60|70|100|1500|2000|3500|9999)\]" src/components | wc -l         # → only in out-of-scope modals (LanguageSelector, MapThemeSwitcher, level-info, NotificationSettingsModal, InstallGate, LoadingScreen)
```
The swipe reducer test must cover: right-only ignores leftward moves; right-only 151 px closes and 150 px does not; both-direction −101 closes; the gallery ±51 navigates and ±50 does not.

Manual (mobile emulation in Playwright or on a real device):
- A 160 px right swipe closes Profile and Discovery.
- A 110 px left swipe closes SpotDetails.
- The gallery swipes between images.

## Rollback
`git revert` the per-component commits in reverse order. No data implications.

## Stop and ask Paul if…
- A site cannot be expressed with the primitives without changing its DOM or classes. Leave it un-migrated and report it; do not alter the look.
- You think the Profile/Discovery quirk or the SpotDetails either-direction close should be "fixed". That is a UX change.
