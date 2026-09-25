# Code Review — SpotOn (whole project)

**Date:** 2026-09-25 · **Commit:** `eee5668` · **Size:** ~12k LOC (TS/TSX), 21 components, 7 stores, 3 hooks, 1 functions file.
**Baseline:** `tsc --noEmit` is clean, `next build` succeeds, and there are no tests, no lint config (Next 16 removed `next lint`), and no CI.
Security issues are tracked separately in `security-review.md`. This document covers maintainability, correctness and structure.

---

## 1. Architecture problems

### ARCH-01: No layering; Firebase is called from everywhere
Components talk to Firestore directly:
- `ProfilePanel.tsx`: onSnapshot at :71 and :89, addDoc at :181
- `SpotDetailsPanel.tsx`: getDoc/getDocs at :184, :202-205, :246, :271-274, and httpsCallable at :332
- `SpotInfoWindow.tsx`: :73-83
- `NotificationSettingsModal.tsx`: updateDoc at :123

Stores mix app state, Firebase side effects, auth flows, image compression and authorization helpers. For example, `isAdmin` and `isSuperAdmin` live in `useSpotStore.ts` and are imported by `useUserStore`. This one-way dependency points the wrong way.

**Target layering:** `components` (render only) → `hooks` (compose) → `store` (state + side effects) → `lib` (pure logic, unit tested). The `src/domain` types are shared across these layers (see CLAUDE.md §6).

### ARCH-02: God components
| File | LOC | useState | useEffect | Responsibilities |
|---|---|---|---|---|
| `ProfilePanel.tsx` | 1272 | 18 | 2+ | header/avatar, username edit, level card, 4 tabs, highlight manager, level-5 name customizer, admin management, category CRUD, level-info modal |
| `SpotDetailsPanel.tsx` | 871 | 22 | 7 | hero, favourite/share/highlight, admin approve, edit form, image manager, delete, creator info, review form, review list, add photos, fullscreen gallery |
| `page.tsx` | 398 | 17 | 4 | loading orchestration, 6 panel booleans, add-spot flow, theme swapping, filtering, geolocation |

Splits are in T27 (ProfilePanel), T28 (SpotDetailsPanel) and T29 (page panel state).

### ARCH-03: Panel state as independent booleans
`page.tsx:43-55` holds `authModalOpen`, `addSpotModalOpen`, `profilePanelOpen`, `filterPanelOpen`, `distanceSelectorOpen`, `discoveryPanelOpen` and `selectedSpot`. Nothing prevents two overlays being open at once. Every component is always mounted and returns `null` when closed. The fix is a single `activePanel` discriminated union (T29).

### ARCH-04: Five different translation mechanisms
1. The store's `t()`.
2. Direct `translations[language]` access (`SettingsPanel.tsx:36`, `NotificationSettingsModal.tsx:90`, `usePushNotifications.ts:26`).
3. Inline `texts` objects (`AuthModal.tsx:29-132`, `InstallGate.tsx:9-55`).
4. Inline ternaries (`LanguageSelector.tsx:36-40`, `DistanceSelector.tsx:25-30`).
5. Hardcoded Hungarian strings (see BUG-06).

The fallback language also differs: `hu` in some places, `en` in others. The fix is one `useT()` hook (T24).

### ARCH-05: Duplicated, drifting domain types
`src/types/index.ts` is never imported, and its `Spot`, `Review` and `User` differ from the real ones in `useSpotStore.ts` and `useUserStore.ts`: different category union, `status` without `'rejected'`, `lat`/`lng` at top level. There are also two different `User` interfaces. Delete the unused file (T03) and consolidate the types while splitting stores.

---

## 2. Duplication (DRY violations)

| ID | What | Copies | Where | Fix |
|---|---|---|---|---|
| DUP-01 | Haversine distance | 2 | `page.tsx:68-78`, `DiscoveryPanel.tsx:23-33` | `lib/geo.ts` (T23) |
| DUP-02 | Swipe-to-close logic | 5 | ProfilePanel :46-48/:197-229, DiscoveryPanel :111-148, FilterPanel :56-88, SpotDetailsPanel :31-49 (uses `Math.abs`, so it closes in either direction), gallery :818-826 | `useSwipeToClose` (T25) |
| DUP-03 | Full-screen panel shell | 4 | ProfilePanel :232, SpotDetailsPanel :457, DiscoveryPanel :161, FilterPanel :94 | `PanelShell` (T25) |
| DUP-04 | Centered modal shell | 6 (2 styles) | AuthModal :216, AddSpotModal :160, DistanceSelector :33, UsernameSetupModal :97, NotificationCenter :110, FeedbackPanel :87 | `ModalShell` (T25) |
| DUP-05 | Category list | 5 | AddSpotModal :248, FilterPanel :41, DiscoveryPanel :43, MapView :24 (`switch` with no `other` case), `spotUtils.ts:4` | `lib/categories.ts` (T23) |
| DUP-06 | Thumbnail URL expression | 7 | ProfilePanel :580,:781,:823,:880, DiscoveryPanel :290, SpotDetailsPanel :306, SpotInfoWindow :119 (different fallback order) | `lib/spotImages.ts` (T23) |
| DUP-07 | Average rating | 4 | ProfilePanel :815, SpotDetailsPanel :303, SpotInfoWindow :36, DiscoveryPanel :65 | `lib/rating.ts` (T23) |
| DUP-08 | Star row | 5 | SpotDetailsPanel :51 (`StarRow`) and :707, ProfilePanel :838, DiscoveryPanel :312, SpotInfoWindow :189 | `StarRating` (T25) |
| DUP-09 | Creator info fetch | 2 | SpotDetailsPanel :189-219, SpotInfoWindow :67-102 | `usePublicProfile` (T26) |
| DUP-10 | Count a user's spots by downloading them | 5 | ProfilePanel :71, SpotDetailsPanel :184, :204, :273 (N+1 per reviewer), SpotInfoWindow :81 | server `spotsCount` (T09), `usePublicProfile` (T26) |
| DUP-11 | Image compression | 4 (+ double compression) | SettingsPanel :43-57 and :71-85, FeedbackPanel :50, the stores; profile pictures are compressed twice (SettingsPanel :56, then `useUserStore.ts:607`) | `lib/imageCompression.ts` (T23) |
| DUP-12 | Favourite and approve handlers, status badge | 3 | SpotInfoWindow :41-63/:210-243, SpotDetailsPanel :315-385/:532-550, ProfilePanel :54-65/:903 | shared hook and components (T25/T26) |
| DUP-13 | Admin check from two sources | — | SpotDetailsPanel receives an `isAdmin` prop (:532) **and** computes `checkIsAdmin` (:299) | `useIsAdmin` (T26) |
| DUP-14 | Getting user location | 3 | `page.tsx:144`, `MapView.tsx:179` (sessionStorage cache), `SettingsPanel.tsx:313` (reloads the page) | one hook (T29) |
| DUP-15 | "Click map to select" banner rendered twice at once | 2 | `page.tsx:371-385`, `MapView.tsx:208-214` | keep one (T29) |
| DUP-16 | User doc → `User` mapping | 4 | `useUserStore.ts:186, 222, 266, 345, 378` | `mapUserDoc()` (T11a) |
| DUP-17 | Swipe/distance option lists | 2 | FilterPanel :33, DistanceSelector :17 | removed with dead code (T03) |

---

## 3. Dead code and leftovers (T03 client, T08 functions)

**Files that are never imported:**
- `src/hooks/useQuestProgress.ts` (Valentine quest, 2026-02)
- `src/hooks/useMobile.ts`
- `src/components/Toast.tsx`
- `src/types/index.ts`

**Unreachable UI:** `FilterPanel` and `DistanceSelector` are mounted in `page.tsx`, but nothing ever sets `setFilterPanelOpen(true)` or `setDistanceSelectorOpen(true)`. That also makes these unreachable: `handleDistanceSelect` (`page.tsx:230-256`), `handleClearFilters`, and the `selectedDistance`/`selectedCategory` filter branches, which are always `null`.

**Unused state and exports:**
- `useUiStore.notificationPromptVisible` is written but never read.
- `useToastStore.toasts` and `removeToast` are no-ops.
- `lib/firebase.ts` exports `messaging`, which is unused.
- `usePushNotifications.ts:15` has `globalForegroundUnsubscribe`, which is never read.
- `levelUtils.ts:189` has `CUSTOM_SPOT_ICONS`, and the `customIcon` field is never written.
- `LanguageSelector.tsx:6` imports `translations` without using it.

**Leftovers from removed features:**
- Valentine quest: `functions/src/index.ts:70-79` and `:278-340`, plus the quest translation keys (`translations.ts:180-186`, `:501-507`, `:804-810`).
- Google Maps InfoWindow CSS (`globals.css:192-240`).
- `CHANGELOG.md` still says "Google Maps".
- The second composite index in `firestore.indexes.json` exists only for the dead quest query.

**Stale config:** the `firebase.json` hosting block; `README.md` references `FIREBASE_FUNCTIONS_SETUP.md`, which does not exist.

**Leftover comments:** "PHASE n" comments (`page.tsx:276,387`, FilterPanel), and "swipe intentionally disabled" (`AddSpotModal.tsx:35,157`).

---

## 4. Bugs

| ID | Bug | Where | Fix task |
|---|---|---|---|
| BUG-01 | Spots `onSnapshot` is never unsubscribed: the cleanup uses the `unsubscribeSpots` captured at mount (`null`) | `page.tsx:162` | T21 |
| BUG-02 | `customNameColor`, `customNameFont` and `notificationSettings` are dropped from `User` on every sign-in and reload. `saveUserToken` then re-writes default notification settings and overwrites user choices | `useUserStore.ts:186,222,345`; `usePushNotifications.ts:81` | T11a |
| BUG-03 | The image manager indexes into the *filtered* `imageUrls`, but `setPrimaryImage(index)` stores that index against the unfiltered array, so the wrong primary image can be set. Images that exist only in `spotImages` cannot be managed | `SpotDetailsPanel.tsx:637,644` | T21 |
| BUG-04 | Image limit mismatch: the code enforces 20, the UI text says 15 | `AddSpotModal.tsx:44` vs `:282,:299,:307` | T21 (decision: 20) |
| BUG-05 | `t('confirmDeleteSpot').replace('helyet','képet')` only works in Hungarian | `SpotDetailsPanel.tsx:434` | T22 |
| BUG-06 | Hardcoded Hungarian UI strings bypass i18n | ProfilePanel :380, :423-425, :525-760 (many), SpotDetailsPanel :347, MapThemeSwitcher :15 | T22 |
| BUG-07 | Class names built at runtime (`value.replace('text-','bg-')`, `bgColor.replace('/20','/80')`) are never generated by Tailwind JIT, so those styles are missing | `ProfilePanel.tsx:675,1137` | T22 |
| BUG-08 | `/default-avatar.png` is referenced but missing; the manifest screenshot is missing | ProfilePanel :959, :1003; `public/manifest.json` | T15 |
| BUG-09 | `isFavorite` is copied from props once and never re-synced | `SpotDetailsPanel.tsx:106`, `SpotInfoWindow.tsx:28` | T26 (info window), T28 (details) |
| BUG-10 | Highlight state ignores `expiresAt` in one place but not another | `SpotDetailsPanel.tsx:224` vs `MapView.tsx:249` | T10/T11b |
| BUG-11 | Two separate highlight systems write the same `spot.highlighted` array: the callable, tied to the Valentine bonus, and a client-side write | `SpotDetailsPanel.tsx:332`, `ProfilePanel.tsx:609` → `useUserStore.highlightSpot` | T10/T11b |
| BUG-12 | The edit-success toast always says "name updated" | `SpotDetailsPanel.tsx:418` | T22 |
| BUG-13 | The approve error is logged as "Failed to add category", with no user toast | `ProfilePanel.tsx:111` | T22 |
| BUG-14 | Cloud Functions notify admins by email lookup (N+1); the super admin has no `admins` doc, so they never get pending-spot alerts | `functions/src/index.ts:206-244` | T08 |
| BUG-15 | Notification type mismatch: functions send `spot_favorited`, but the client union expects `new_like` | `functions/src/index.ts:438`, `useNotificationStore.ts:10` | T08 |
| BUG-16 | Timers without cleanup (can set state after unmount) | `page.tsx:112,134`, `LanguageSelector.tsx:17`, `NotificationPrompt.tsx:36` (+ `handleApprove` close timer) | T21 |
| BUG-17 | Effects list the state they set as dependencies, so they re-run after every update | `SpotDetailsPanel.tsx:255,287` | T28 |
| BUG-18 | Viewing a legacy spot triggers a Firestore write (`migrateSpotImages`) | `SpotDetailsPanel.tsx:232` | T11b |
| BUG-19 | `MapView` rebuilds `L.divIcon` and `new Date()` for every marker on every render | `MapView.tsx:248,255` | T21 (memoize) |
| BUG-20 | `ProfilePanel` edits usernames without the length or availability checks | `ProfilePanel.tsx:328` | T11a |
| BUG-21 | FCM link is hardcoded to a non-existent production URL | `functions/src/index.ts:161` | T08 |
| BUG-23 | Tailwind `content` does not scan `src/lib`, so level/name-style classes defined there are never generated | `tailwind.config.ts` | T22 |
| BUG-24 | The loading screen can stay stuck forever: MapView's `MapReadyNotifier` 100 ms timer is cancelled by any re-render inside that window and is never restarted, so `onMapLoad` never fires. Reproduced 100% against the fast emulators. | `MapView.tsx:85-96` | T04 (minimal fix, needed for e2e) |
| BUG-25 | A new review can show twice: `addReview` appends locally after `updateDoc` while the spots listener has already delivered the same review; visible after close/reopen until the next snapshot (found during T11b) | `useSpotStore.ts` `addReview` | T21 |
| BUG-22 | SettingsPanel renders at z-40/50 inside ProfilePanel's z-60 stacking context | `SettingsPanel.tsx` | T25 (z-index scale in `lib/`) |

---

## 5. Code smells (fix while touching the code)
- **Magic numbers:**
  - Swipe thresholds (150 / 100 / 50), image limits (20 / 15 / 6), and the map centre `[47.4979, 19.0402]`.
  - Timeouts (100 / 300 / 500 / 3000 / 10000).
  - An ad-hoc z-index scale (50, 60, 70, 100, 1000, 1500, 2000, 2001, 3500, 4000, 9999).
  - Level thresholds re-typed as `[0,0,3,10,15,20]` (`ProfilePanel.tsx:1160`), although `LEVEL_THRESHOLDS` already exists.
- **`getLevelInfo` recomputed 7 times** in ProfilePanel, 6 of them inside IIFEs in JSX.
- **Business logic inside JSX:** async `onClick` bodies (`ProfilePanel.tsx:602,661,703`), geolocation plus `location.reload()` (`SettingsPanel.tsx:312`).
- **`any` usage:** `searchedUser` (ProfilePanel :29), `messaging: any`, stores' `catch (error: any)`, functions `event: any`.
- **Pointless `try { … } catch (e) { throw e }`** blocks throughout `useUserStore.ts`.
- **`eslint-disable react-hooks/exhaustive-deps`** at `page.tsx:166` and `MapView.tsx:203`.
- **`alert()`** in FeedbackPanel (:80); `URL.createObjectURL` is called on every render and never revoked (:153).
- **`useSpotStore.isLoading`** is shared between `fetchSpots` and `addSpot`.
- **Colour `#0f172a`** is hardcoded in 6 places instead of a Tailwind token.

---

## 6. Refactor principles (the "pillars" every refactor task follows)
1. **Safety net first:** lint, typecheck, unit tests, emulator E2E and CI must exist before behaviour-preserving refactors (T01–T04).
2. **Patch before polish:** upgrade vulnerable dependencies (T05–T07) and fix security (T08–T15) before restructuring, so the refactor happens on the final stack.
3. **Small, reversible steps:** one concern per commit, and `verify` plus `test:e2e` green after every commit.
4. **Characterisation tests:** before replacing duplicated logic, snapshot the old implementations' outputs and prove the new code matches them (T23).
5. **Single source of truth:** constants, categories, levels, translations and types each live in exactly one module.
6. **Separation of concerns:** pure logic in `lib/`, side effects in stores or hooks, rendering in components.
7. **Server authority:** anything that matters for integrity or privacy is enforced by rules or functions.
8. **Backward-compatible data:** legacy documents must keep working; migrations are explicit, dry-run-first scripts that Paul runs.
