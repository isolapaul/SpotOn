# T21 — Data and logic bug fixes

**Phase:** 4 · **Depends on:** T11b (and T01, T03, T04) · **Risk:** low · **Decisions:** D12
**Audit refs:** BUG-01, BUG-02 (residual check), BUG-03, BUG-04, BUG-16, BUG-19

## Goal
Fix six small correctness bugs in data and lifecycle code: the spots listener leak, the wrong primary image being stored, the 15-vs-20 image limit, leftover risk from the user-mapping bug, timers that fire after unmount, and map marker icons rebuilt on every render. Each fix is local. The intended behaviour changes are listed explicitly below, and nothing else may change.

## Context
Line numbers are from commit `eee5668`. T03, T05, T06 and T08–T11b have shifted them since, so **find every site by its landmark first** (function, component or JSX name) and use the line number only as a hint.

- **BUG-01**: `src/app/page.tsx`, `Home`, the mount `useEffect` (currently at :118-167). It destructures `unsubscribeSpots` from `useSpotStore()` at render time (currently at :58). The cleanup (currently at :159-165) calls that captured value. That value is always `null` at first render, so the listener registered by `fetchSpots` (`useSpotStore.ts` `fetchSpots`, currently at :153-186, stored via `set({ unsubscribeSpots })` at :179) is never unsubscribed. In practice this only happens on dev StrictMode double-mount and HMR, but it leaks a listener each time.
- **BUG-03**: in `src/components/SpotDetailsPanel.tsx`, find the "Manage images (owner/admin)" block (`showManageImages &&` grid, currently at :635-654):
  - It maps over `(spot.imageUrls || []).filter(url => url !== '/placeholder-spot.jpg')` and uses the **filtered** `index`, both for the ★ badge (`(spot.primaryImageIndex || 0) === index`, :640) and for `handleSetPrimaryImage(index)` (:644, handler at :424-431).
  - The hero reads the **unfiltered** array: `spot.imageUrls?.[spot.primaryImageIndex || 0]` (`heroImageUrl`, :306-310).
  - So whenever `imageUrls` contains a placeholder (or any other filtered entry) before a real image, the wrong image becomes primary.
  - Images that exist only in `spotImages` (not in `imageUrls`) are not listed, so they cannot be deleted from the manager.
  - After T11b, `src/lib/spotImages.ts` exports `getSpotImages(spot)`: it returns `spot.spotImages` when that is non-empty, and otherwise maps `imageUrls` with ids `${spot.id}_${index}`. `setPrimaryImage(spotId, index)` is still a direct `updateDoc({ primaryImageIndex })`, where the index points into `imageUrls` (T11b table). T12 rules restrict it to admins or the owner of an approved spot, with `0 <= index < 20`. Re-read both before starting.
- **BUG-04 (D12 = 20)**: `src/components/AddSpotModal.tsx`:
  - The store and `handleImageChange` enforce 20 (`imageFiles.length + files.length > 20`, currently at :44).
  - The UI says 15 in three places: the label counter `({imageFiles.length}/15)` (:282), the upload button `disabled={loading || imageFiles.length >= 15}` (:299), and the hardcoded `Max 15 kép` (:307, Hungarian in every language).
  - `maxSpotImages` in `src/lib/translations.ts` already says 20 in hu, en and de.
- **BUG-02 residual**: T11a introduced `mapUserDoc()` (DUP-16), so `customNameColor`, `customNameFont` and `notificationSettings` survive sign-in and reload. `src/hooks/usePushNotifications.ts` `saveUserToken` (currently at :66-83) writes default `notificationSettings` whenever `user.notificationSettings` is falsy in the **store**. If any code path still builds a `User` without those fields, user choices get overwritten.
- **BUG-16 (timers with no cleanup)**:
  - `page.tsx`: the app-ready `setTimeout(..., 500)` (currently at :112, in the `loadingStates` effect) and the spots-ready `setTimeout(..., 300)` inside `initializeSpots` (currently at :134).
  - `src/components/LanguageSelector.tsx`: `setTimeout(() => setIsOpen(true), 300)` (currently at :17).
  - `src/components/NotificationPrompt.tsx`: `setTimeout(() => setShowPrompt(true), 3000)` inside `checkPrompt` (currently at :36).
  - An additional site found during this review: `SpotDetailsPanel.tsx` `handleApprove` → `setTimeout(() => onClose(), 1000)` (currently at :379). If the user opens a different spot within 1 s of approving, that new spot gets closed.
- **BUG-19**: `src/components/MapView.tsx`, `spots.map(...)` in the JSX (currently at :247-262). It calls `new Date().toISOString()` **per marker** (:248) and `getCategoryIcon(...)` (module function at :23-63, which builds a fresh `L.divIcon`) per marker on every render (:255). react-leaflet calls `setIcon` whenever the icon reference changes, so every render re-creates every marker's DOM.

## Files
- Modify: `src/app/page.tsx`, `src/store/useSpotStore.ts` (only if a `stopSpots` action is added, see step 1), `src/components/SpotDetailsPanel.tsx`, `src/components/AddSpotModal.tsx`, `src/components/LanguageSelector.tsx`, `src/components/NotificationPrompt.tsx`, `src/components/MapView.tsx`, `src/lib/translations.ts` (one new key), `src/hooks/usePushNotifications.ts` and the `mapUserDoc` module (only if the residual check in step 4 finds a gap).
- Create: `src/lib/constants.ts` (containing only `MAX_SPOT_IMAGES = 20`; T23 extends it), `src/lib/constants.test.ts` (trivial), and the e2e spec described in step 7.
- Modify: the T04 seed fixtures (find them with `grep -rl "demo-spoton" e2e scripts 2>/dev/null`) to add the fixture spot in step 7.

## Steps
1. **BUG-01**:
   - Remove `unsubscribeSpots` from the render-time destructuring in `Home`.
   - In the mount-effect cleanup, read it from the store at cleanup time. Either:
     - `const unsub = useSpotStore.getState().unsubscribeSpots; if (unsub) { unsub(); useSpotStore.setState({ unsubscribeSpots: null }); }`, or
     - add a `stopSpots()` action to `useSpotStore` that does exactly that, and call it.
   - Keep `fetchSpots`'s own "unsubscribe the existing listener first" logic unchanged.
2. **BUG-03**: change the manager in the `showManageImages` block to:
   1. Build the list from the **unfiltered** `spot.imageUrls`, keeping each entry's original index: `(spot.imageUrls || []).map((url, index) => ({ url, index })).filter(e => e.url !== PLACEHOLDER)`. Use `e.index` for the ★ badge comparison and for `handleSetPrimaryImage(e.index)`.
   2. Then append the images that `getSpotImages(spot)` returns whose `url` is **not** in `spot.imageUrls`, as manageable entries: delete is available; set-primary is **hidden**, because `primaryImageIndex` indexes `imageUrls` and those images have no index. This is the expected case, because the T11b API is index-based.
   3. The count badge (`{allGalleryImages.length} 📸`) stays as it is.
3. **BUG-04**:
   - Create `src/lib/constants.ts` with `export const MAX_SPOT_IMAGES = 20;`.
   - In `AddSpotModal`, replace the literals 20 (:44) and 15 (:282, :299) with `MAX_SPOT_IMAGES`.
   - Replace `Max 15 kép` (:307) with a new translation key `maxImagesShort`: hu `Max {max} kép`, en `Max {max} photos`, de `Max. {max} Fotos`. Render it with `.replace('{max}', String(MAX_SPOT_IMAGES))`.
   - Keep the `{t('maxSize')} • ` prefix exactly.
4. **BUG-02 residual check** (read-only unless a gap is found):
   - `grep -rn "User = {" src` and `grep -rn "set({ user" src/store`. Every `User` object built from Firestore data must go through `mapUserDoc()`.
   - `mapUserDoc`'s unit test (from T11a) must assert that `customNameColor`, `customNameFont` and `notificationSettings` are copied through.
   - In `saveUserToken`, confirm it only adds the default `notificationSettings` when the store user came from `mapUserDoc` and truly has none.
   - If a gap exists, fix it there (add the field to the mapping or the test). If the fix would need anything beyond `mapUserDoc`/`saveUserToken`, stop and ask.
   - Record the result ("BUG-02 residual: none found" or what was fixed) in the commit body.
5. **BUG-16**: give every timer a cleanup.
   - **page.tsx, app-ready effect**: `const id = setTimeout(...); return () => clearTimeout(id);`, placed inside the `if`.
   - **page.tsx, spots-ready**: declare `let spotsTimer: ReturnType<typeof setTimeout> | undefined; let cancelled = false;` in the mount effect. In `initializeSpots`, skip the `setTimeout` when `cancelled`, otherwise assign it. In the cleanup, set `cancelled = true; clearTimeout(spotsTimer)`.
   - **LanguageSelector**: `const id = setTimeout(...); return () => clearTimeout(id);`.
   - **NotificationPrompt**: make `checkPrompt` synchronous (it has no `await`), keep the timer id, and return `() => clearTimeout(id)` from the effect.
   - **SpotDetailsPanel `handleApprove`**: store the timer in a `useRef`. Clear it in an effect cleanup keyed on `spot?.id` (the component never unmounts; it returns `null` while there is no spot).
6. **BUG-19**:
   - In `MapView`, compute `const nowIso = new Date().toISOString()` **once per render**, before `spots.map`.
   - Add a module-level `const iconCache = new Map<string, L.DivIcon>()` and a `getCachedCategoryIcon(category, status, isHighlighted, size)` that keys on `` `${category}|${status}|${isHighlighted ? 1 : 0}|${size}` `` and calls the unchanged `getCategoryIcon` on a miss.
   - Use it in the marker loop. SVG and size math stay byte-identical.
7. **E2E**: add `e2e/primary-image.spec.ts` to T04's Playwright directory.
   - **Seed** one legacy spot owned by the seeded test user, status `approved`, with `imageUrls: ['/placeholder-spot.jpg', urlA, urlB]`, no `spotImages` and `primaryImageIndex: 0`. Use URLs the emulator/Storage seed already serves, or local `/icon-192x192.png` and `/icon-512x512.png`.
   - **Test**:
     1. Sign in as the owner and open the spot.
     2. Open "manage images", hover the tile for `urlB` and click its "set primary" button (`title` = `t('setPrimaryImage')`).
     3. Close the panel and reopen it; until T29 the panel shows a snapshot of the spot.
     4. Assert that the hero `<img>` `src` contains `urlB`'s file name and that the ★ badge is on the `urlB` tile.
   - **Before the fix** this test must fail (hero shows `urlA`). Verify that once, locally.
   - Add a unit test `src/lib/constants.test.ts` asserting `MAX_SPOT_IMAGES === 20`, so the D12 value is pinned.

**Intended behaviour changes (the only allowed ones):**
- Set-primary in the manager now targets the image the user clicked.
- Images present only in `spotImages` now appear in the manager and can be deleted (set-primary only if the API supports it, see step 2).
- The add-spot form allows selecting up to 20 images. The counter shows `/20`, and the hint reads "Max 20 kép / photos / Fotos" in the user's language.
- In dev/StrictMode, the spots listener is unsubscribed on unmount.
- Timers no longer fire after unmount. In particular, approving a spot and then opening another spot within 1 s no longer closes the new one.
- Marker DOM is no longer rebuilt on renders where nothing about the marker changed. Visually identical.

## Must NOT change
- Hero image selection logic (`heroImageUrl`) and gallery ordering.
- `fetchSpots` query, ordering and first-snapshot resolve semantics. The loading screen still waits for auth, spots and map, plus the 300 ms and 500 ms delays.
- Language selector still appears after 300 ms on first visit. Notification prompt still appears after 3 s for signed-in users with `Notification.permission === 'default'`.
- Marker SVG markup, sizes (`getMarkerSize`), highlight scaling (×1.2), `zIndexOffset`, and highlight-expiry comparison (`h.expiresAt > now`).
- The 5 MB per-file check and error texts in AddSpotModal.
- All DOM landmarks used by the T04 suite (aria-labels, ids, visible texts).

## Acceptance
```bash
npm run verify
npx vitest run src/lib/constants.test.ts
npm run test:e2e                                   # includes e2e/primary-image.spec.ts
grep -n "/15\|>= 15\|Max 15" src/components/AddSpotModal.tsx   # → no output
grep -n "unsubscribeSpots" src/app/page.tsx                    # → no render-time destructuring (only getState()/stopSpots in cleanup)
grep -n "new Date()" src/components/MapView.tsx                # → exactly one occurrence, outside spots.map
```
Manual (dev server with emulator):
- Open the add-spot form and select 16 images: all are accepted. The 21st shows `maxSpotImages`.
- Switch the language to en and de: the hint reads "Max 20 photos" / "Max. 20 Fotos".

## Rollback
`git revert` the commit. No data migration. The seed fixture change only affects the emulator.

## Stop and ask Paul if…
- The post-T11b primary-image API takes neither an `imageUrls` index nor an image id/url, or it rewrites `imageUrls` order.
- `getSpotImages()` returns images whose url is absent from `imageUrls` **and** the product should allow making them primary. That would need a data/API change.
- The BUG-02 residual check finds a path that overwrites `notificationSettings` outside `mapUserDoc`/`saveUserToken`.
