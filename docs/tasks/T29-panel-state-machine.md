# T29 — Panel state machine in `page.tsx`

**Phase:** 5 · **Depends on:** T27, T28 · **Risk:** med · **Decisions:** —
**Audit refs:** ARCH-02 (page), ARCH-03, DUP-14, DUP-15, BUG-16 (already fixed in T21; keep it fixed)

## Goal
- Replace `page.tsx`'s independent open/close booleans with a single `activePanel` discriminated union in `useUiStore`, plus an explicit add-spot location-selection flow.
- Use one location hook for the whole app.
- Show one "click the map" banner instead of two.

`page.tsx` shrinks to an orchestrator of ≤ ~160 lines (T19's banner wiring included).

## Context
Line numbers are from `eee5668` (T03 removed the filter and distance state and handlers; re-locate by landmark).

- **`page.tsx` state** (currently at :36-62):
  - `isClient`, `isAppReady`, `loadingStates`
  - `authModalOpen`, `addSpotModalOpen`, `profilePanelOpen`, `discoveryPanelOpen`
  - `isSelectingLocation`, `selectedLocation`, `selectedSpot` (a **copy** of the `Spot` object)
  - `userLocation`, `prevMapTheme`
- **Handlers:** `handleAddSpotClick` (:174-184), `handleProfileClick` (:186-192), `handleCancelSelecting` (:194-201), `handleLocationSelect` (:203-208), `handleAddSpotClose` (:210-219), `handleExploreClick` (:226-228).
- **Map theme swap:**
  - add-spot click (signed in) → remember `currentMapTheme` in `prevMapTheme`, `setTheme('satellite')`, start selecting;
  - cancel selecting or close the add form → restore `prevMapTheme` if set, then clear it.
  - The theme is persisted (`spoton-map-theme`).
- **Top buttons** (NotificationCenter + MapThemeSwitcher) are hidden while profile, discovery or spot details are open (`!profilePanelOpen && !discoveryPanelOpen && !selectedSpot`, :271). They are **not** hidden while the auth modal, add-spot modal or selecting mode is active.
- **Empty state** (:361-368): shown when `visibleSpots.length === 0 && !isSelectingLocation`, and since T19 also `&& !movedBannerVisible`.
- **T19 additions (domain-move notice), which this task must keep:**
  - `useUiStore` has `movedBannerVisible: boolean` (default `false`) and `setMovedBannerVisible(v)`, written by `MovedBanner` in an effect with cleanup back to `false`.
  - `page.tsx` renders `{isAppReady && !isSelectingLocation && <MovedBanner />}` **inside** the top-buttons condition block, so the banner hides whenever a panel covers the screen and during location picking.
  - `page.tsx` hides the empty-state pill while `movedBannerVisible` is true (same vertical slot).
  - `NotificationPrompt.tsx` and `InstallGate.tsx` have `getMovedTo()` guards. The guard line is untouched (NotificationPrompt may still lose its `setNotificationPromptVisible` calls, step 1).
- **DUP-15, two banners while selecting:**
  - page `{/* Location Selection Instructions */}` (:370-385): `absolute top-20 … z-10 glass-card px-6 py-4 max-w-sm`, text `t('clickMapToSelect')` + Cancel button;
  - MapView (:208-214): `absolute top-20 … z-[1000] glass-card px-6 py-3 pointer-events-none`, text only.
  - They overlap: the page banner is on top, because MapView's root is a `z-0` stacking context.
- **DUP-14, three location sources:**
  1. page mount effect (:143-156): `getCurrentPosition` with no options. Success → `userLocation`; error → stays `null`. Used by DiscoveryPanel (distance and "nearest" sort).
  2. MapView effect (:179-204): uses the sessionStorage cache (`userLocation`, `userLocationTime`, max age 10 min) if present. Otherwise `getCurrentPosition({enableHighAccuracy:false, timeout:10000, maximumAge:600000})`; success → cache it; **error → `DEFAULT_MAP_CENTER`**. Used for the blue dot and a one-time pan (`LocationPanner`, zoom 13).
  3. SettingsPanel "request location" button (:311-328): `{enableHighAccuracy:true, timeout:10000}`; success → toast + `location.reload()`; error → toast. Without `navigator.geolocation` it returns silently (:313): no toast, no spinner.
- T23 constants in `src/lib/constants.ts`: `DEFAULT_MAP_CENTER: [number, number] = [47.4979, 19.0402]`, `LOCATION_CACHE_MAX_AGE_MS = 600_000`, `GEOLOCATION_TIMEOUT_MS = 10_000`.
- **Sign-out from Settings today:** `SettingsPanel` calls `signOut()` then its own `onClose` (:97-98). The page's `profilePanelOpen` stays `true`; `ProfilePanel` renders nothing because `!user` (ProfilePanel.tsx:102), and the top buttons stay hidden. A later profile click (signed out) sets `authModalOpen` with `profilePanelOpen` still `true`, so the top buttons stay hidden behind the auth modal, and after sign-in the profile panel reappears.
- **CLAUDE.md §3** describes `src/app/page.tsx` as "Orchestrator: loads auth/spots/map, owns panel open/close state"; after this task neither half is true.
- `SpotDetailsPanel` receives the `selectedSpot` **snapshot**. Store updates after actions (new review, approve, edit, primary image) do not reach the open panel until it is reopened.

## Files
- Modify: `CLAUDE.md` (§3 `page.tsx` line only, step 8), `src/store/useUiStore.ts`, `src/app/page.tsx`, `src/components/MapView.tsx`, `src/components/NotificationPrompt.tsx` (only if `notificationPromptVisible` is removed: it writes `setNotificationPromptVisible` at :48-50, :56 and :64), `src/components/SettingsPanel.tsx`, `src/components/DiscoveryPanel.tsx` (location source only), `src/components/spot-details/SpotDetailsPanel.tsx` (receive `spotId`), `src/components/profile/ProfilePanel.tsx` / `DiscoveryPanel` / `AuthModal` / `AddSpotModal` (open/close props wiring only).
- Create:
  - `src/hooks/useUserLocation.ts` (backed by a small store slice in `src/store/useLocationStore.ts`)
  - `src/hooks/useAppBootstrap.ts` (loading orchestration moved out of page)
  - `src/hooks/useVisibleSpots.ts`
  - tests `src/store/useUiStore.test.ts` and `src/store/useLocationStore.test.ts`
  - e2e `e2e/panels.spec.ts`

## Steps
1. **`useUiStore`**. Remove `notificationPromptVisible` if T03 has not already done so, but check for readers first; its only writer is `NotificationPrompt.tsx` (:48-50, :56, :64), whose calls are removed with it. **Keep T19's `movedBannerVisible` / `setMovedBannerVisible` unchanged.**
   ```ts
   export type ActivePanel = 'none' | 'auth' | 'addSpot' | 'profile' | 'discovery' | { type: 'spot'; spotId: string };
   interface UiStore {
     activePanel: ActivePanel;
     selectingLocation: boolean;
     pendingLocation: { lat: number; lng: number } | null;
     prevMapTheme: MapTheme | null;
     openPanel(p: ActivePanel): void;           // replaces whatever is open
     closePanel(): void;                        // → 'none'
     closeSpotPanel(spotId: string): void;      // → 'none' only if activePanel is still { type: 'spot', spotId }; otherwise no change
     startSelectingLocation(currentTheme: MapTheme): void;  // prevMapTheme = currentTheme; selecting = true; pendingLocation = null; setTheme('satellite')
     cancelSelectingLocation(): void;           // selecting = false; restore theme if prevMapTheme; prevMapTheme = null
     selectLocation(loc): void;                 // pendingLocation = loc; selecting = false; activePanel = 'addSpot'
     closeAddSpot(): void;                      // activePanel = 'none'; pendingLocation = null; selecting = false; restore theme if prevMapTheme; prevMapTheme = null
     onMapClick(): void;                        // if isSpotPanel(activePanel) → closePanel(); otherwise no change
     // + T19's movedBannerVisible / setMovedBannerVisible, unchanged
   }
   ```
   - Theme changes call `useMapThemeStore.getState().setTheme`. `prevMapTheme` is not persisted; `setTheme` persists as today.
   - Add a selector helper `isSpotPanel(p): p is { type: 'spot'; spotId: string }`.
   - Selectors used by components must return primitives or stable references (zustand 5, T31).
2. **`page.tsx`:**
   - replace the 7 booleans and objects with the store;
   - move loading orchestration into `useAppBootstrap()`, which returns `{ isAppReady, onMapLoad }`. The hook explicitly owns:
     - the `initAuth()` and `fetchSpots()` calls (`initAdminListener` was removed by T11a; admin listeners live in the user store);
     - the auth/spots/map flags and the 300 and 500 ms timers, with their T21 cleanups (clear each timer on unmount);
     - T21's BUG-01 spots-listener cleanup, moved verbatim: `stopSpots()`, or `useSpotStore.getState().unsubscribeSpots` read at cleanup time, whichever T21 shipped. Never a render-time `unsubscribeSpots` value;
   - move the role filter into `useVisibleSpots()`;
   - the handlers become:
     - add click: `user ? startSelectingLocation(theme) : openPanel('auth')`
     - profile click: `user ? openPanel('profile') : openPanel('auth')`
     - explore: `openPanel('discovery')`
     - Discovery `onSpotSelect(spot)`: `openPanel({ type: 'spot', spotId: spot.id })` (this replaces "close discovery, then set spot")
     - MapView `onSpotDetailsOpen(spot)`: `openPanel({ type: 'spot', spotId: spot.id })`
     - MapView `onMapClick`: the store's `onMapClick()` (if `isSpotPanel(activePanel)` then `closePanel()`)
   - Top buttons are hidden iff `activePanel` is `'profile'`, `'discovery'` or a spot.
   - Keep `{isAppReady && !selectingLocation && <MovedBanner />}` inside the top-buttons block (T19).
   - Empty state: `visibleSpots.length === 0 && !selectingLocation && !movedBannerVisible`.
3. **SpotDetailsPanel** receives `spotId` and reads `const spot = useSpotStore(s => s.spots.find(x => x.id === spotId))`. If it is not found (deleted), close it in an effect:
   ```ts
   useEffect(() => { if (spotId && !spot) closeSpotPanel(spotId); }, [spotId, spot]);
   ```
   `closeSpotPanel` closes only if `activePanel` is still that spot, so a late effect never closes a different panel the user has opened since.
   - Remove T11b's now-redundant live lookup (`const fresh = useSpotStore(...) ?? spot`, possibly moved by T28). `spot` is now the live copy; use it wherever `fresh` was used (highlight state, gallery images).
4. **DUP-15:** delete MapView's `isAddingSpot &&` banner block. Keep the page banner (with Cancel). MapView still gets `isAddingSpot` for click handling.
   - If MapView no longer uses `t` after this, remove its translation hook call and the import (`useT` after T24, or `useLanguageStore` if still present).
5. **DUP-14, one location hook.** `useLocationStore` holds `{ status: 'idle' | 'pending' | 'granted' | 'denied', location: LatLng | null }` and `request({ highAccuracy?: boolean })`:
   - It reuses the sessionStorage cache (same keys, same 10-min rule) on the first automatic request.
   - On success it writes the cache and sets `status: 'granted'`.
   - Only the **automatic first** request sets `status: 'denied'` and `location: null` on error. An error from a manual `request()` (SettingsPanel) never clears an existing `location` or a `granted` status; it only reports failure to the caller (for the toast).
   - Without `navigator.geolocation`, no request is made and `status` stays `'idle'`: no dot and no pan, as today (MapView :180 returns early).
   - `useUserLocation()` triggers one automatic request on first use and returns `{ location, status, request }`.

   Consumers:
   - DiscoveryPanel and page: use `location`, which is `null` on error, as today.
   - MapView: `location ?? (status === 'denied' ? DEFAULT_MAP_CENTER-as-LatLng : null)`, which preserves the dot and pan at the default centre on error.
   - SettingsPanel: `request({ highAccuracy: true })`, then the same toasts, **and keep `globalThis.location.reload()` on success** (conservative, so the map re-pans).
6. **Tests:**
   - `useUiStore.test.ts`: every transition, including the theme restore when selecting is cancelled, when the add form closes after a selection, and when `prevMapTheme` is null (no restore). `onMapClick()` with a spot panel open → `'none'`; with `'profile'`, `'discovery'` or `'none'` → unchanged. `movedBannerVisible` is still present and settable.
   - `useLocationStore.test.ts`: cache hit within 10 min, cache miss, automatic error → denied, manual error after a success → location and `granted` kept, no `navigator.geolocation` → stays `idle`, high-accuracy option passed through, success writes the cache.
7. **E2E `panels.spec.ts`:**
   1. Signed in: click add → exactly **one** element with text `t('clickMapToSelect')` is visible, and a satellite tile (`img.leaflet-tile[src*="arcgisonline"]`) is present.
   2. Click Cancel → the standard tile (`tile.openstreetmap.org`) is back.
   3. Add again, click the map → AddSpotModal (`#spot-name`) is visible; close it → the theme is restored.
   4. Explore → click the first spot → details open, and discovery is not in the DOM.
   5. Signed out: profile click opens AuthModal.

   (A "map click while details are open" e2e step is not possible: the details panel is `fixed inset-0 z-[60]` over the map. The `onMapClick` → `closePanel` path is covered by `useUiStore.test.ts`.)

**Intended behaviour changes:**
- Only one "click the map" banner is shown (the MapView copy is removed).
- The spot details panel shows live store data (reviews, status, name, primary image update without reopening), and closes itself if the spot disappears.
- Discovery distances use the shared (possibly ≤ 10-min cached) location instead of a separate fresh fix.
- Only one geolocation request runs at startup instead of two.
- A successful SettingsPanel location request now writes the sessionStorage cache, so after the reload the map uses that fresh position instead of an older cached one.

## Must NOT change
- Add-spot flow: auth gate; satellite during selection and while the add form is open; theme restore on cancel or close; theme persistence semantics.
- Selecting mode is orthogonal to panels. Opening profile or explore during selection behaves as today: the selection continues.
- Which top buttons show when; the empty-state visibility rule (including T19's `!movedBannerVisible`).
- T19's domain-move wiring: `movedBannerVisible` / `setMovedBannerVisible` in `useUiStore`, and `<MovedBanner />` inside the top-buttons block gated by `isAppReady && !selectingLocation`.
- UsernameSetupModal (driven by `needsUsername`), LanguageSelector, NotificationCenter, MapThemeSwitcher and SettingsPanel keep their own state.
- Loading screen timing (auth + spots + map, the 300 ms and 500 ms delays), with the T21 cleanups kept.
- Map default centre, zoom levels, one-time pan, and the blue dot at the default centre when location is denied.
- The SettingsPanel reload after granting location.

## Acceptance
```bash
npm run verify
npx vitest run src/store/useUiStore.test.ts src/store/useLocationStore.test.ts
npm run test:e2e                                          # includes panels.spec.ts
wc -l src/app/page.tsx                                    # → ≤ 160
grep -n "useState" src/app/page.tsx                       # → at most isClient
grep -rn "clickMapToSelect" src/components src/app        # → exactly one render site (page)
grep -rn "getCurrentPosition" src | grep -v "src/store/useLocationStore.ts"   # → none
```

## Rollback
`git revert`. The persisted map theme and the location cache keys are unchanged, so rolling back is safe.

## Stop and ask Paul if…
- He wants selecting mode to be exclusive with panels (for example, opening Profile cancels the selection).
- He wants the SettingsPanel reload removed. That needs a "re-pan when location becomes available" change in `LocationPanner`.
- The live-updating details panel conflicts with an in-progress edit. For example, the name changes remotely while the user is editing. Today's snapshot hides this; decide whether edit fields should freeze.
