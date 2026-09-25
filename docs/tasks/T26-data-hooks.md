# T26 — Data hooks (`usePublicProfile`, `useIsAdmin`, `useUserSpots`, `useFavoriteToggle`)

**Phase:** 5 · **Depends on:** T25 (T09, T11a, T11b) · **Risk:** low · **Decisions:** D8
**Audit refs:** DUP-09, DUP-10, DUP-12 (favourite part), DUP-13, BUG-09 (SpotInfoWindow part), ARCH-01

## Goal
Move per-component Firestore reads and admin checks into a few hooks:
- a cached, de-duplicated public-profile reader;
- a single admin-state hook;
- the own-spots listener;
- a favourite toggle that reads from the store.

Remove the `isAdmin` prop drilling. Components stop importing `firebase/*` for these concerns.

## Context
Line numbers are from `eee5668`. T09/T11a/T11b rewrote the data sources, so re-locate by landmark, and read the post-T11a code first.

- **Public profiles after T11a.** Clients read `publicProfiles/{uid}` → `{ username, profilePictureURL, customNameColor, customNameFont, spotsCount }`. Current consumers (before T11a these were `users/{uid}` + count queries), each with its own component state and effect:
  - SpotDetailsPanel creator effect (`// Fetch creator info`, currently at :188-219)
  - SpotDetailsPanel reviewer-meta effect (`// Fetch reviewer display metadata`, :257-287)
  - SpotDetailsPanel uploader-name effect (:227-255; the `uploaderNames` state is **never rendered**)
  - SpotInfoWindow creator effect (:67-102)

  Both creator effects special-case the signed-in user (`spot.createdBy === user?.uid`) by taking `username` and `customNameColor` from the store. Every panel open refetches.
- **Admin state after T11a.** It comes from `admins/{auth.uid}` (and `role: 'super'`). T11a stores this as `useUserStore` state `isAdmin` and `isSuperAdmin`: not persisted, driven by `onSnapshot(admins/{uid})`. T11a deliberately **kept** the `isAdmin` props on MapView, SpotInfoWindow, SpotDetailsPanel and NotificationSettingsModal. This task removes them. Prop drilling today:
  - `page.tsx` `userIsAdmin` (currently at :65) → `<SpotDetailsPanel isAdmin>` (:339) and `<MapView isAdmin>` (:354).
  - `MapView` → `<SpotInfoWindow isAdmin>` (MapView :271).
  - `SettingsPanel` `userIsAdmin` (:37) → `<NotificationSettingsModal isAdmin>` (:353).
  - SpotDetailsPanel uses **both** the prop (`isAdmin &&` status/approve card, :532) and `checkIsAdmin(user?.email)` (`userIsAdmin`, :299 → `canEdit`, delete button :659): DUP-13.
  - ProfilePanel computes `userIsAdmin` and `userIsSuperAdmin` itself (:50-51).
  - `page.tsx` also uses `userIsAdmin` for `visibleSpots`.
- **Own spots.** ProfilePanel `onSnapshot(query(spots, where('createdBy','==',uid)))` while open (currently at :67-83) → `myAllSpots`. It drives the level (D8: pending spots count), the my-spots list and the highlight list. If T11a switched the level source to `publicProfiles.spotsCount`, keep whatever T11a established.
- **Favourites.** `isFavorite` is copied once into `useState` (SpotInfoWindow :28-30, SpotDetailsPanel :106) and flipped locally after `toggleFavorite` (useUserStore `toggleFavorite`, :405-439). BUG-09: it is never re-synced with `user.savedSpots`. SpotDetailsPanel is always mounted, so its copy is taken when `spot` is still `null` and stays `false`. SpotDetailsPanel is migrated in T28; this task migrates SpotInfoWindow.

**Decision: `getDoc` + module cache, not `onSnapshot`.**
- It matches today's one-shot semantics.
- A spot with N reviewers would otherwise hold N live listeners, and listeners on other users' documents cost reads on every change they make.
- Profiles change rarely, and the only one a user expects to see update instantly is their own, which is overlaid from the store (as the current special case does).

Cache design:
- Module-level `Map<uid, { value: PublicProfile | null; fetchedAt: number }>` plus an in-flight `Map<uid, Promise<PublicProfile | null>>`, so concurrent callers share one request.
- Entries expire after `PUBLIC_PROFILE_TTL_MS = 5 * 60_000` (in `src/lib/constants.ts`).
- A missing document caches `null` (the caller falls back as today).
- Errors are **not** cached (log, return `undefined`, retry next time).

## Files
- Create:
  - `src/hooks/usePublicProfile.ts` (`usePublicProfile(uid?)` and `usePublicProfiles(uids: string[])`)
  - `src/hooks/useIsAdmin.ts` (`useIsAdmin(): boolean`, `useIsSuperAdmin(): boolean`)
  - `src/hooks/useUserSpots.ts` (`useUserSpots(uid?, enabled = true): Spot[]`)
  - `src/hooks/useFavoriteToggle.ts`
  - tests `src/store/publicProfiles.test.ts` (mock `firebase/firestore`), `src/hooks/useFavoriteToggle.test.ts` (if RTL is available; else test the selector logic).
- Modify: `src/store/publicProfiles.ts` (created by T11a with `fetchPublicProfile` and `fetchPublicProfiles`; add the cache and in-flight maps **inside** these functions, keep their signatures, and add `peekPublicProfile`, `invalidatePublicProfile` and `__resetPublicProfileCacheForTests`), `src/lib/constants.ts`, `src/app/page.tsx`, `src/components/MapView.tsx`, `src/components/SpotInfoWindow.tsx`, `src/components/SpotDetailsPanel.tsx` (profiles and admin only; **not** favourites), `src/components/ProfilePanel.tsx`, `src/components/SettingsPanel.tsx`, `src/components/NotificationSettingsModal.tsx`.

## Steps
1. **`src/store/publicProfiles.ts` (extend T11a's module):**
   - `fetchPublicProfile(uid)`: fresh cache hit → return it; in-flight → return the same promise; otherwise `getDoc(doc(db,'publicProfiles',uid))`, store `{value, fetchedAt: Date.now()}`, then clear the in-flight entry in a `finally`.
   - `fetchPublicProfiles(uids)` reuses `fetchPublicProfile` per uid, so cache and dedupe apply to it too.
   - `PublicProfile` stays T11a's interface: `{ username, profilePictureURL, customNameColor, customNameFont, spotsCount?, isAdmin? }`.
2. **`usePublicProfile(uid)`** returns `PublicProfile | null | undefined` (`undefined` = loading or unknown).
   - Initial state comes from `peekPublicProfile(uid)`.
   - The effect fetches, ignores stale results when `uid` changes (the same `isMounted` pattern as today), and does nothing for a falsy uid.
   - **Own-user overlay:** if `uid === store user.uid`, return `{ ...fetched, username: user.username, customNameColor: user.customNameColor, customNameFont: user.customNameFont, profilePictureURL: user.profilePictureURL ?? fetched?.profilePictureURL }`. `spotsCount` comes from the profile.
   - `usePublicProfiles(uids)` takes a sorted, de-duplicated key; it fetches missing ones in parallel and returns a `Record<uid, PublicProfile | null | undefined>`.
3. **`useIsAdmin` / `useIsSuperAdmin`:** `useUserStore((s) => s.isAdmin)` and `useUserStore((s) => s.isSuperAdmin)`. Return primitives only, because zustand 5 (T31) needs stable selector results.
4. **Remove prop drilling:**
   - Delete the `isAdmin` prop from `SpotDetailsPanelProps`, `MapViewProps`, `SpotInfoWindowProps` and `NotificationSettingsModalProps`. Each uses `useIsAdmin()` internally.
   - `page.tsx` keeps its own `useIsAdmin()` for `visibleSpots`.
   - In SpotDetailsPanel, both the old prop use and the `checkIsAdmin` use read the one hook value.
5. **Replace the fetch effects:**
   - SpotDetailsPanel creator: `usePublicProfile(spot?.createdBy)`. `creatorName = profile?.username || spot.createdByName || t('anonymous')`, and `creatorSpotsCount = profile?.spotsCount ?? 0`.
   - SpotDetailsPanel reviewers: `usePublicProfiles(spot?.reviews?.map(r => r.userId) ?? [])`. The priority of badge inputs must equal the post-T11b code.
   - SpotInfoWindow creator: `usePublicProfile(spot.createdBy)`.
   - Delete the uploader-names effect and state (never rendered). **Intended:** fewer reads, no UI change.
6. **`useUserSpots(uid, enabled)`:** moves ProfilePanel's own-spots `onSnapshot` into the hook, with the same query (no `orderBy`), the same `enabled` gating (`isOpen`), and unsubscribe on change or unmount. ProfilePanel calls it once and passes the list down.
7. **`useFavoriteToggle(spotId)`** returns `{ isFavorite, toggle, canToggle }`:
   - `isFavorite = useUserStore((s) => !!s.user?.savedSpots?.includes(spotId))`
   - `toggle` calls `toggleFavorite(spotId)` and logs errors exactly as the handlers do today (`'Failed to toggle favorite:'`)
   - `canToggle = !!user`

   Migrate **SpotInfoWindow** to it: delete its `isFavorite` `useState` and `handleFavoriteToggle` local flip.
8. **Firebase imports:** after this task, `grep -rn "from 'firebase/" src/components` must list **only** what T27/T28 will remove (ProfilePanel's category CRUD, if T11a left it). Note the remaining ones in the commit body.

**Intended behaviour changes:**
- SpotInfoWindow's heart now reflects `savedSpots` from the store (BUG-09 for the info window).
- Profile documents are fetched at most once per 5 minutes per uid across panels, instead of on every open.
- The unused uploader-name reads are gone.
- Admin UI flags come from one source, which fixes the case where the `isAdmin` prop was stale because page's `useMemo` depended only on `user?.email`.

## Must NOT change
- Displayed creator name, colour and level, reviewer badges, and fallbacks (`createdByName`, `review.userName`, `t('anonymous')`).
- Own-user values appear immediately after they change in the store (username, colour, font).
- Admin- and super-admin-only UI visibility: pending tab, admin tab, approve, delete, edit (`canEdit`), status badge, and the `newPendingSpot` toggle.
- ProfilePanel own-spots data: same query, same listen-while-open lifetime, same level source.
- SpotDetailsPanel favourite behaviour (changed in T28, not here).

## Acceptance
```bash
npm run verify
npx vitest run src/store/publicProfiles.test.ts
npm run test:e2e
grep -rn "isAdmin=" src                                              # → none
grep -rn "isAdmin?: boolean\|isAdmin: boolean" src/components        # → none
grep -rn "fetchPublicProfile" src/components                        # → none (only via hooks)
grep -rn "getDoc\|getDocs\|onSnapshot" src/components                # → only sites listed in the commit body for T27/T28
```
The cache test must cover:
- Two concurrent `fetchPublicProfile('a')` calls → one `getDoc`.
- A hit within the TTL → no call; after the TTL (fake timers) → a new call.
- A missing document → `null` is cached.
- A rejected `getDoc` → not cached, and the next call retries.

## Rollback
`git revert`. No data implications.

## Stop and ask Paul if…
- `publicProfiles` is not readable by signed-out visitors under the T12 rules. Today signed-out users see creator names in SpotInfoWindow.
- 5 minutes of staleness for *other* users' profiles is unacceptable.
