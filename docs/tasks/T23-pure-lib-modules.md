# T23 — Pure `lib/` modules with characterisation tests

**Phase:** 5 · **Depends on:** T22 · **Risk:** low · **Decisions:** D12
**Audit refs:** DUP-01, DUP-05, DUP-06, DUP-07, DUP-11, code smells (magic numbers)

## Goal
Replace duplicated inline logic with single, pure, unit-tested modules in `src/lib/`. The tests prove that **every call site's current output is preserved**. This is a behaviour-preserving refactor: no user-visible change.

## Context
Line numbers are from `eee5668`; T03–T22 have moved them, so re-locate by landmark.

- **Haversine (DUP-01).**
  - `page.tsx` `calculateDistance` (currently at :68-78; T03 may have removed it with the dead distance filter, so re-grep).
  - `DiscoveryPanel.tsx` module function `calculateDistance` (currently at :23-33).
  - Both are the same formula with R = 6371.
- **Average rating (DUP-07).**
  - `ProfilePanel.tsx` favourites `avgRating` (currently at :815-817).
  - `SpotDetailsPanel.tsx` `averageRating` (:303-305).
  - `SpotInfoWindow.tsx` `averageRating` (:36-38).
  - `DiscoveryPanel.tsx` `getAverageRating` (:65-68).
  - `useSpotStore.ts` `addReview` computes it too (:247).
  - All of them return `sum/len`, or `0` when there are no reviews.
- **Image URL expressions (DUP-06): three different fallback orders; preserve each.**
  - *Thumbnail* (ProfilePanel :580, :781, :823, :880; DiscoveryPanel :290): `imageUrls?.[primaryImageIndex || 0] || imageUrls?.[0] || (spot as any).imageUrl || '/placeholder-spot.jpg'`. Paired with `unoptimized={!spot.imageUrls && !(spot as any).imageUrl}`.
  - *Hero* (SpotDetailsPanel `heroImageUrl` :306-310): `imageUrls?.[primary||0] || imageUrls?.[0] || sortedSpotImages[0]?.url || placeholder`. It has **no** legacy `imageUrl`. Paired with `unoptimized={!spot.imageUrls && !(spot as any).imageUrl}` (:482).
  - *Preview* (SpotInfoWindow `previewImageUrl` :119-124): `sortedSpotImages[0]?.url || imageUrls?.[primary||0] || imageUrls?.[0] || imageUrl || placeholder`. The **most-liked image comes first**.
- **Sorting spot images by likes: two different tie-breaks.**
  - SpotDetailsPanel `sortedSpotImages` (:140-145): likes desc, then `(b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0)`, so a missing timestamp counts as 0 (oldest).
  - SpotInfoWindow `sortedSpotImages` (:110-117): likes desc, then the time difference **only if both** have `toMillis`, else `0`. That makes it non-transitive when timestamps are mixed, so the result depends on the input order.
  - Both filter out `'/placeholder-spot.jpg'`.
  - SpotDetailsPanel `allGalleryImages` (:147-152): sorted spotImage urls, then `imageUrls` not already included, with placeholder removed and duplicates removed.
  - `getSpotImages()` already exists in `src/lib/spotImages.ts` (T11b). Keep its behaviour and tests.
- **Categories (DUP-05).**
  - `src/lib/spotUtils.ts` `categoryEmojis` and `categoryTranslationKeys`.
  - AddSpotModal `<option>` list (:248-256) and DiscoveryPanel `categories` array (:43-53), both in the order scenic, smoke-spot, viewpoint, hiking, random, date-spot, park, part, other.
  - MapView `getCategoryIcon` `switch` (:24-34) has **no `other` case**, so `other` and any unknown category fall through to the default `'📍'`. Because `categoryEmojis.other` is also `'📍'`, a lookup with a `'📍'` fallback yields byte-identical SVG.
  - DiscoveryPanel uses `categoryEmojis[c] || '📍'` (:299). SpotDetailsPanel (:521) and SpotInfoWindow (:169) use `categoryEmojis[c]` with **no** fallback, so they render nothing for an unknown category. Preserve that.
  - Marker colour is status-based, not category-based: approved `#10b981`, otherwise `#eab308`, highlighted `#FFD700` (MapView :36-37).
- **Image compression (DUP-11). Options per call site:**
  - Spot uploads: `useSpotStore.ts` `IMAGE_COMPRESSION_OPTIONS` `{maxSizeMB:0.3, maxWidthOrHeight:1280, useWebWorker:false}` (:108-112).
  - Store profile picture and banner: `useUserStore.ts` `compressProfileImage` `{maxSizeMB:1, maxWidthOrHeight:1920, useWebWorker:false}` (:75-82).
  - SettingsPanel profile picture: `{1, 800, useWebWorker:true}` (:50-54).
  - SettingsPanel banner: `{1, 1920, true}` (:78-82).
  - FeedbackPanel: `{maxSizeMB:1, maxWidthOrHeight:1600}`, with `useWebWorker` left at the library default (:50).
  - Profile images are compressed **twice** (SettingsPanel, then the store). T11a may have changed the store path, so re-read it.
- **Magic numbers:**
  - `MAX_SPOT_IMAGES` (already in `src/lib/constants.ts` from T21).
  - 5 MB upload cap: AddSpotModal :54, SettingsPanel :43, :71.
  - Feedback file cap: `slice(0, 6)` at FeedbackPanel :26; T14 may have changed it, so use the current value.
  - Swipe thresholds: 150 (Profile/Discovery), 100 (SpotDetails), 50 (gallery).
  - Default map centre `[47.4979, 19.0402]`, initial zoom 6, locate zoom 13 (MapView :166, :218, :133).
  - MapView's `zoomLevel` state starts at 13 (`useState(13)`, :165) although the map opens at zoom 6; it only drives `getMarkerSize` until the first zoom event.
  - Location cache 10 min and geolocation timeout 10 000 ms (MapView :187, :201).
  - Discovery batch 20 (DiscoveryPanel :20).
  - Timers: 100 (map ready), 300 (spots settle, language selector, hero guard), 500 (app ready), 1000 (approve close), 3000 (notification prompt).
  - Level thresholds re-typed as `[0,0,3,10,15,20]` at ProfilePanel :1160.
  - Marker sizes in `getMarkerSize` (MapView :171-177).
- **Z-index values in use** (the scale is defined here and applied in T25):
  - `z-0` map container; `z-10` page banners; `z-[1000]` in-map overlays (inside the map's stacking context).
  - `z-50` dock and notification prompt; `z-[60]` panels and AddSpotModal; `z-[70]` level-info modal; `z-[100]` gallery.
  - `z-[1500]` floating top buttons; `z-[2000]` Auth, Language, Notification centre, Feedback and MapTheme modals; `z-[3500]` UsernameSetupModal.
  - `z-[9999]` InstallGate, LoadingScreen, NotificationSettingsModal.
  - SettingsPanel uses `z-40`/`z-50` inside ProfilePanel's `z-[60]` context.

## Files
- Create:
  - `src/lib/geo.ts`, `src/lib/rating.ts`, `src/lib/categories.ts`, `src/lib/mapMarkers.ts`, `src/lib/imageCompression.ts`.
  - Tests for each: `src/lib/*.test.ts`, following T01's vitest `include` glob.
  - `src/lib/__oracles__/` (old implementations copied verbatim, imported only by tests; excluded from coverage).
- Modify:
  - `src/lib/spotImages.ts` (+ test), `src/lib/constants.ts` (+ test), `src/lib/spotUtils.ts` (re-export from `categories.ts` or delete the moved maps).
  - Every call site listed in Context.
  - `vitest.config.*` (coverage thresholds for `src/lib/**`), `package.json` (add `@vitest/coverage-v8`, **same exact version as `vitest`**, if T01 did not add it).

## Steps
1. **Oracles first (one commit, tests only).**
   - Oracles are copied from the code **at implementation time**; the Context snippets above are pre-T11b and may differ (for example T11b's `getSpotImages`/`PLACEHOLDER_URL` use). Where they differ, the current code wins.
   - Copy each old implementation verbatim into `src/lib/__oracles__/legacy.ts`: both haversines; the four rating expressions; the thumbnail, hero and preview expressions; both sort comparators and `allGalleryImages`; the `getCategoryIcon` SVG string builder with emoji switch and colour logic (without `L.divIcon`); `getMarkerSize`; each compression options object.
   - Write the characterisation tests, initially comparing each oracle against itself so they pass, then commit.
   - **Sample inputs, at minimum:**
     - *Coordinates:* equal points, Budapest↔Vienna, antipodes, negative lat/lng, lng wrap ±180.
     - *Reviews:* `undefined`, `[]`, `[5]`, `[1,2]`, `[4,5,5]`.
     - *Spots:* legacy with only `imageUrl`; `imageUrls:['/placeholder-spot.jpg']`; `imageUrls:[]`; `primaryImageIndex` out of range; `spotImages` only; mixed `addedAt` (Timestamp-like `{toMillis}`, missing, `null`); equal likes; placeholder inside `spotImages`; duplicate urls across both arrays.
     - *Categories:* each of the 9, plus `'unknown'` and `undefined`.
     - *Markers:* status approved, pending and rejected × highlighted true/false × sizes 24/32/48/64/80/58.
2. **Implement the modules:**
   - `geo.ts`: `haversineKm(lat1, lng1, lat2, lng2): number` (same formula and same operation order, so results are **bit-identical**; assert with `toBe`, not `toBeCloseTo`).
   - `rating.ts`: `averageRating(reviews?: ReadonlyArray<{ rating: number }>): number`.
   - `spotImages.ts`: keep `getSpotImages`, and add:
     - reuse T11b's existing `PLACEHOLDER_URL` (do not add a second placeholder constant)
     - `getThumbnailUrl(spot)`, `getHeroImageUrl(spot, sorted)`, `getPreviewImageUrl(spot, sorted)`. The thumbnail and preview helpers keep the legacy singular `imageUrl` fallback exactly where today's expressions have it; the hero has none.
     - `isImageUnoptimized(spot)` (`!spot.imageUrls && !legacyImageUrl`)
     - `sortSpotImagesByLikes(images, tieBreak: 'missingAsZero' | 'bothRequired')`
     - `getGalleryUrls(spot)` (uses `'missingAsZero'`, same as SpotDetailsPanel).
     - Read the legacy `imageUrl` through a typed helper, not `as any`.
     - Sort a copy (`[...images]`). Today's code sorts a fresh `filter()` result, so the input is never mutated; keep it that way.
   - `categories.ts`:
     - `CATEGORIES: ReadonlyArray<{ id: SpotCategory; emoji: string; labelKey: TranslationKey }>` in the AddSpot/Discovery order.
     - Derived `CATEGORY_EMOJI` and `CATEGORY_LABEL_KEY` records (no fallback).
     - `getMarkerEmoji(category): string` (fallback `'📍'`).
     - `MARKER_COLORS = { approved: '#10b981', other: '#eab308', highlighted: '#FFD700' }`.
     - `spotUtils.ts` keeps `getPlatform` and `getNavigationUrl`, and re-exports `categoryEmojis = CATEGORY_EMOJI` and `categoryTranslationKeys = CATEGORY_LABEL_KEY` so imports keep working. Alternatively update the imports; then grep to confirm nothing is broken.
   - `mapMarkers.ts`: `buildMarkerSvg(category, status, isHighlighted, size): string` (byte-identical to the oracle, **including whitespace**) and `getMarkerSize(zoom)`. MapView keeps `L.divIcon` creation and the T21 cache, and calls `buildMarkerSvg`.
   - `imageCompression.ts`:
     - **Note:** T14 and T15 run before this task and set `useWebWorker: false` in FeedbackPanel and SettingsPanel (the library worker loads code from cdn.jsdelivr.net, which the CSP blocks). Copy the option objects **exactly as they appear in the code at implementation time**, not the values listed above.
   - `COMPRESSION_PRESETS = { spot, profileStore, settingsProfilePicture, settingsBanner, feedback }`, with the exact objects above. `feedback` has **no** `useWebWorker` key, which keeps the library default.
     - `compressImage(file, preset)` wraps `browser-image-compression`.
     - **Decision (conservative): keep the double compression of profile images exactly as it is** (SettingsPanel preset, then the store preset). Removing a pass changes output bytes and quality, so it needs Paul's OK (see Stop and ask).
   - `constants.ts`: add `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`, `FEEDBACK_MAX_FILES`, `SWIPE_THRESHOLDS = { panel: 150, spotDetails: 100, gallery: 50 } as const`, `DEFAULT_MAP_CENTER: [number, number] = [47.4979, 19.0402]`, `DEFAULT_MAP_ZOOM = 6`, `LOCATE_ZOOM = 13`, `INITIAL_MARKER_ZOOM = 13` (MapView's initial `zoomLevel` state; it stays 13 and must never be replaced by `DEFAULT_MAP_ZOOM`), `LOCATION_CACHE_MAX_AGE_MS = 600_000`, `GEOLOCATION_TIMEOUT_MS = 10_000`, `DISCOVERY_BATCH_SIZE = 20`, a `DELAYS` object with the named timers above, and:
     ```ts
     export const Z = {
       mapOverlay: 'z-10', mapInner: 'z-[1000]', dock: 'z-50', prompt: 'z-50', panel: 'z-[60]',
       panelModal: 'z-[70]', gallery: 'z-[100]', floatingButton: 'z-[1500]', modal: 'z-[2000]',
       usernameSetup: 'z-[3500]', blocking: 'z-[9999]',
     } as const;
     ```
     These are static class strings, visible to Tailwind because of T22's content glob. Test that the numeric values of all entries **except `mapInner`** are in ascending (non-decreasing) order as listed. `mapInner` is excluded because it lives inside the map container's `z-0` stacking context.
   - `levelUtils.ts`: add `getLevelThreshold(level)` derived from `LEVEL_THRESHOLDS`. ProfilePanel's `[0,0,3,10,15,20][level]` becomes `getLevelThreshold(level)`. Test that it equals the old array for levels 1-5.
3. **Switch the characterisation tests** to compare `new(x)` with `oracle(x)` for every sample (`toEqual`/`toBe`). For `'bothRequired'`, feed the same input order to both, since the result depends on order.
4. **Replace call sites**, one module per commit: geo, rating, spotImages, categories + markers, compression, constants. Run `npm run verify` and `npm run test:e2e` after each.
5. **Coverage:**
   - `vitest run --coverage` with `coverage.include: ['src/lib/**']`.
   - `coverage.exclude: ['src/lib/firebase.ts', 'src/lib/translations.ts', 'src/lib/__oracles__/**', '**/*.test.ts']`. Justify each exclusion in the config comment: side-effectful init, and pure data covered by the parity test.
   - Thresholds `{ lines: 90, statements: 90, functions: 90, branches: 90 }` scoped to `src/lib/**`. Test `getPlatform` and `getNavigationUrl` by stubbing `navigator.userAgent`.

## Must NOT change
- Rendered output of every call site: URLs chosen, emoji, labels, marker SVG, sort orders, distances and ratings displayed (`toFixed` formatting stays at call sites).
- Compression options per call site, and the number of compression passes.
- MapView's initial `zoomLevel` state stays 13 (`INITIAL_MARKER_ZOOM`), never `DEFAULT_MAP_ZOOM`.
- Public names imported elsewhere (`categoryEmojis`, `categoryTranslationKeys`, `getNavigationUrl`, `getSpotImages`, `LEVEL_THRESHOLDS`, `getLevelInfo`, …). Keep them or update every importer.
- No React, Firebase or DOM (other than `navigator` in `spotUtils`) imports in the new lib modules, except `imageCompression.ts`, which imports the library.

## Acceptance
```bash
npm run verify
npx vitest run src/lib
npx vitest run --coverage            # thresholds ≥ 90 % for src/lib/** enforced by config
npm run test:e2e
grep -rn "6371" src --include=*.ts --include=*.tsx | grep -v "src/lib/geo.ts\|__oracles__"                           # → none
grep -rn "reduce((acc, r) => acc + r.rating" src | grep -v "src/lib/\|__oracles__"                                   # → none
grep -rn "placeholder-spot.jpg" src --include=*.tsx                                                                  # → none (constant used)
grep -rn "imageCompression(" src | grep -v "src/lib/imageCompression.ts\|__oracles__"                                # → none
grep -rn "case 'scenic'" src/components                                                                              # → none
```

## Rollback
`git revert` the commits (one per module). No data implications.

## Stop and ask Paul if…
- You want to **unify** the two tie-break orders, or the hero-vs-preview image priority (the info window shows the most-liked image, while the details hero shows the primary image). Either is a visible change; do not do it in this task.
- You want to remove the double compression of profile images.
- A characterisation test shows the new code cannot match an oracle without copying a quirk. Copy the quirk, and report it.
