# T11a — Client: public profiles, usernames, admin identity, sign-out token

**Phase:** 2 · **Depends on:** T09 (T08 functions, T04 e2e harness) · **Risk:** med-high · **Decisions:** D8
**Audit refs:** SEC-04, SEC-08, SEC-14, SEC-16, SEC-17, BUG-02, BUG-20, DUP-10, DUP-13, DUP-16

## Goal
Make the client stop depending on reading other users' `users` docs, on downloading spots to count them, on client-side admin decisions, and on the build-time super-admin email. That way T12 can lock those paths down:
- other users' info comes from `publicProfiles`;
- usernames go through the `claimUsername` callable;
- admin state comes from the caller's own `admins/{uid}` doc;
- admin management and name style go through callables;
- sign-in paths map the user doc consistently (BUG-02);
- sign-out removes this device's push token (SEC-14).

**The UI and all visible texts stay the same.**

## Context
- Admin checks today use `isAdmin(email)` / `isSuperAdmin(email)` from `src/store/useSpotStore.ts:19-36` (a module cache plus `NEXT_PUBLIC_ADMIN_EMAIL`). The complete call-site list (from grep):
  - `src/app/page.tsx:21,65` → `userIsAdmin`, passed to `SpotDetailsPanel` (`:339`) and `MapView` (`:354`, then to `SpotInfoWindow`).
  - `src/components/ProfilePanel.tsx:6,50,51`, which gates the pending tab `:472`, the admin tab `:494`, the categories listener `:87`, and the content `:866,:920`.
  - `src/components/SettingsPanel.tsx:13,37`, which passes `isAdmin` to `NotificationSettingsModal` (`:353`).
  - `src/components/SpotDetailsPanel.tsx:8,299` (`userIsAdmin` for edit/delete) and `:84` (`ReviewerBadge`: `checkIsAdmin(review.userEmail)`).
  - `src/store/useSpotStore.ts:217` (`addSpot` status).
  - `src/store/useUserStore.ts:15,469,503,516,537`.
  - `initAdminListener` (`useUserStore.ts:442-463`) streams **all** of `admins` to every visitor, and is started unconditionally at `page.tsx:128`.
- **Decision:** remove the email-based functions and every call site listed above. Components read `isAdmin` / `isSuperAdmin` booleans from `useUserStore`. `MapView`, `SpotInfoWindow`, `SpotDetailsPanel` and `NotificationSettingsModal` keep their `isAdmin` props unchanged.
- Other users' data read today:
  - `SpotDetailsPanel.tsx:182-186` (the own spot count via download), `:189-219` (creator doc plus spots download), `:228-255` (uploader names from `users`, stored in `uploaderNames`, which is **never rendered**), and `:258-287` (reviewer doc plus spots download per reviewer).
  - `SpotInfoWindow.tsx:67-102` (creator doc plus spots download).
- User-doc mapping is duplicated and lossy (`useUserStore.ts:186-195, 222-231, 266-275, 345-354, 378-387`). It drops `customNameColor`, `customNameFont` and `notificationSettings` (BUG-02). `usePushNotifications.ts:73-83` then re-writes default `notificationSettings` over the user's choices.
- Sign-out (`useUserStore.ts:284-291`) leaves this device's FCM token in `users/{uid}.fcmTokens` (SEC-14).
- The admin UI flow (`ProfilePanel.tsx:115-160, 920-1031`) is: search by email → preview (username, email, photo) → grant; plus a list of admins with remove buttons. Today the super admin has no `admins` doc, so it is not listed. After bootstrap (T08) it is, so the list must hide `role == 'super'` to look the same.
- Callables available after T08–T09 (region `europe-west3`; client `functions` in `src/lib/firebase.ts`):
  - `lookupUserByEmail({email}) → {uid, email, username, photoURL}` (`not-found` when missing);
  - `addAdmin({email})`, `removeAdmin({uid})`;
  - `claimUsername({username}) → {username}` (`already-exists`, `invalid-argument`, `failed-precondition` when the users doc is missing);
  - `updateNameStyle({color?, font?})`.

  Server error messages equal the client's current English strings: `"User not found"`, `"User is already an admin"`, `"Only Super Admin can add admins"`, `"Only Super Admin can remove admins"`, `"Username is already taken"`.
- `publicProfiles/{uid}` = `{username, profilePictureURL, customNameColor, customNameFont, spotsCount, isAdmin, updatedAt}`, and `usernames/{name}` = `{uid}` (T09).
- **T12 will allow the client to write only these `users/{uid}` keys:** `uid`, `email`, `photoURL`, `profilePictureURL`, `profileBannerURL`, `savedSpots`, `fcmTokens`, `language`, `notificationsEnabled`, `notificationSettings`, `lastTokenUpdate`, `lastLoginAt`, `createdAt`. **`username` is never client-written.** Every write in this task must stay inside that list.

## Files
- Create:
  - `src/lib/mapUserDoc.ts` and `src/lib/mapUserDoc.test.ts`;
  - `src/lib/username.ts` and `src/lib/username.test.ts`;
  - `src/store/publicProfiles.ts`;
  - `e2e/profile-admin.spec.ts` (in T04's e2e directory, following its sign-in helper).
- Modify:
  - `e2e/fixtures.ts`, `scripts/seed-emulator.ts` (the dedicated rename fixture, step 14), `e2e/helpers.ts` (`expectNotification`, step 14);
  - `playwright.config.ts` (delete the `NEXT_PUBLIC_ADMIN_EMAIL: ''` entry from `E2E_ENV`);
  - `src/store/useUserStore.ts`, `src/store/useSpotStore.ts`, `src/hooks/usePushNotifications.ts`;
  - `src/app/page.tsx`;
  - `src/components/ProfilePanel.tsx`, `src/components/SettingsPanel.tsx`, `src/components/SpotDetailsPanel.tsx`, `src/components/SpotInfoWindow.tsx`, `src/components/AddSpotModal.tsx`;
  - `src/lib/firebase.ts` (only if T04 did not already connect the Functions emulator);
  - `CLAUDE.md`:
    - delete the `NEXT_PUBLIC_ADMIN_EMAIL` row from the env table;
    - in the repo map, change the `useSpotStore.ts` note "ALSO exports isAdmin/isSuperAdmin" to say that admin state now lives in `useUserStore` (`isAdmin` / `isSuperAdmin`, from `admins/{uid}`).
- Unchanged, but verify: `src/components/UsernameSetupModal.tsx` (the store API it uses is kept) and `src/components/NotificationSettingsModal.tsx`.

## Steps
1. **`src/lib/username.ts`** (pure):
   - `USERNAME_RE = /^[a-z0-9_]{3,20}$/`;
   - `normalizeUsername(s): string` (trim plus lowercase);
   - `isValidUsername(s)`;
   - `generateUsername(displayName, rand = Math.random)`, moved verbatim from `useUserStore.ts:85-92`.

   Tests: the regex edges, and that the generated names match `USERNAME_RE` for many display names (including `""` and `"Árvíztűrő Tükörfúrógép"`).
2. **`src/lib/mapUserDoc.ts`** (pure). `mapUserDoc(uid, authInfo: {email: string|null; photoURL: string|null}, data: Record<string, unknown>): User` returns:
   - `uid`;
   - `username: data.username || 'user'`;
   - `email: authInfo.email || ''`;
   - `photoURL: authInfo.photoURL || (data.photoURL as string) || ''`;
   - `profilePictureURL: data.profilePictureURL || data.photoURL || authInfo.photoURL || ''`;
   - `profileBannerURL: data.profileBannerURL || ''`;
   - `savedSpots: data.savedSpots || []`;
   - `highlightedSpots: data.highlightedSpots || []`;
   - `customNameColor`, `customNameFont` (a string, or omitted);
   - `notificationSettings`: if `data.notificationSettings` is an object, exactly `{spotApproved, spotReviewed, newPendingSpot}`, each the stored boolean, a missing or non-boolean one defaulting to `true`; any other key is dropped (T12 allows only these three keys). Otherwise omitted;
   - `spotsCount` (a non-negative integer, or omitted).

   Export the `User` type from here, and have `useUserStore` re-export it. Tests: each field present or absent, the legacy docs (photoURL only, no username), and that BUG-02's fields are preserved.
3. **`src/store/publicProfiles.ts`**:
   - `export interface PublicProfile { username: string | null; profilePictureURL: string | null; customNameColor: string | null; customNameFont: string | null; spotsCount?: number; isAdmin?: boolean }`.
   - `fetchPublicProfile(uid): Promise<PublicProfile | null>`, via `getDoc(doc(db, 'publicProfiles', uid))`.
   - `fetchPublicProfiles(uids): Promise<Record<string, PublicProfile | null>>`: dedupe, then `Promise.all`.
   - No cache.
4. **`useUserStore.ts`**:
   - (a) Remove the import from `useSpotStore`. Remove `adminEmails`, `searchUserByEmail` and `initAdminListener`.
   - (b) New state: `isAdmin: boolean`, `isSuperAdmin: boolean` (both `false` initially and not persisted), and `adminUsers: AdminUser[]` (add `role?: string` to `AdminUser`).
   - (c) The admin listeners are module-level `adminDocUnsub` / `adminListUnsub`, started from `onAuthStateChanged` when a user is signed in, and stopped when signed out or in `signOut`:
     - `onSnapshot(doc(db,'admins',uid))` sets `isAdmin = snap.exists()` and `isSuperAdmin = snap.exists() && snap.data().role === 'super'`.
     - While `isAdmin` is true, `onSnapshot(collection(db,'admins'))` sets `adminUsers = docs.map(d => ({id: d.id, ...d.data()})).filter(a => a.role !== 'super')`. Otherwise it unsubscribes and sets `adminUsers = []`.
     - The error callbacks set both flags to false.
   - (d) Every sign-in path builds the store user with `mapUserDoc`: popup, email, redirect and auth-state.
   - (e) New-user guard: a module flag `newUserSetupInProgress` is set to `true` by the popup, redirect and email flows before their first auth call that can create or sign in a user (`signInWithPopup`, `getRedirectResult`, `createUserWithEmailAndPassword`), and cleared in `finally`. `onAuthStateChanged` must not create a doc or claim a username while it is true; it still resolves its first-call promise. New-user doc creation: a helper `createUserDoc(fbUser)` runs `setDoc(ref, {uid, email, photoURL, profilePictureURL, profileBannerURL: '', savedSpots: [], createdAt: serverTimestamp(), lastLoginAt: serverTimestamp()}, {merge: true})`, with **no `username`**. Then `claimGeneratedUsername(displayName)` calls `claimUsername` with `generateUsername(...)`, retrying up to 5 times with a fresh name on `functions/already-exists`. It returns the name, or `null` on failure (logged). Use this in:
     - the Google popup new-user path (then `needsUsername: true`, as today);
     - the Google popup existing-user-without-username path (replaces `updateDoc({username})`; `needsUsername: true`);
     - the redirect new-user path (`needsUsername` not set, as today);
     - the `onAuthStateChanged` missing-doc path (`needsUsername: true`, as today).
   - (f) `signUpWithEmail(email, pw, username)`:
     - set `newUserSetupInProgress = true` (step e) **before** `createUserWithEmailAndPassword`;
     - `createUserDoc`;
     - `claimUsername(normalizeUsername(username))`. On `already-exists` or `invalid-argument`, fall back to `claimGeneratedUsername` and set `needsUsername: true`, so the existing modal lets the user pick (no new UI text);
     - clear the flag in `finally`.
   - (g) `checkUsernameAvailable(name)`: `getDoc(doc(db,'usernames', normalizeUsername(name)))`. It is available if the doc does not exist, or if `data().uid === user.uid`.
   - (h) `updateUsername(name)`:
     - keep the current client validation and its messages;
     - call `claimUsername`; map `functions/already-exists` to `new Error('Username is already taken')`, and `functions/invalid-argument` to the matching current message;
     - on success, set `user.username` and `needsUsername: false`.
     - The separate availability pre-query is removed.
   - (i) `lookupUserByEmail(email)` (replaces `searchUserByEmail`): the callable result, or `null` on `functions/not-found`.
   - `addAdmin(email)` calls the `addAdmin` callable, and `removeAdmin(adminId)` calls `removeAdmin({uid: adminId})`. Keep the early UX guard `if (!get().isSuperAdmin) throw new Error('Only Super Admin can add admins' | '...remove admins')`.
   - (j) `updateCustomNameColor(color)` calls `updateNameStyle({color})`, and `updateCustomNameFont(font)` calls `updateNameStyle({font})`. Then update the local user, as today.
   - (k) Token handling: `rememberFcmToken(token)` keeps the token in a module variable and in `localStorage['spoton-fcm-token']`, with try/catch.
   - `signOut()`, in this order:
     - read the token (memory, then localStorage);
     - if there is a token and a user, run `updateDoc(users/{uid}, {fcmTokens: arrayRemove(token)})` (catch and log);
     - only if there is a remembered token **and** `Notification.permission === 'granted'` **and** `await isSupported()`: `const messaging = getMessaging(app)`, then `await getToken(messaging, {vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/')})` (the FCM service worker is registered with scope `/` by `usePushNotifications`), then `await deleteToken(messaging)` (catch and log). Never prompt for permission here. The `arrayRemove` above stays the primary cleanup;
     - clear the token storage;
     - stop the admin listeners and reset `isAdmin`, `isSuperAdmin` and `adminUsers`;
     - then `firebaseSignOut(auth)` and `set({user: null, loading: false})`.
   - (l) Leave `highlightSpot`, `unhighlightSpot`, `toggleFavorite`, `updateProfilePicture` and `updateProfileBanner` unchanged. T11b handles them.
5. **`useSpotStore.ts`**:
   - Delete `cachedAdminEmails`, `setCachedAdminEmails`, `isSuperAdmin` and `isAdmin`.
   - `addSpot`'s last parameter changes from `userEmail?: string` to `isAdmin: boolean`, with `status: isAdmin ? 'approved' : 'pending'`. Nothing else changes.
6. **`usePushNotifications.ts`, `saveUserToken`**:
   - `getDoc(userRef)` first.
   - Include `notificationSettings: defaultSettings` **only** if the stored doc has no `notificationSettings`. Never overwrite.
   - After a successful write, call `useUserStore.getState().rememberFcmToken(token)`.
   - The other written keys stay the same (`fcmTokens: arrayUnion`, `language`, `notificationsEnabled: true`, `lastTokenUpdate`), except that `language` is written as `language ?? 'hu'` (T12 accepts only `'hu' | 'en' | 'de'`).
7. **`page.tsx`**:
   - `const userIsAdmin = useUserStore((s) => s.isAdmin)`;
   - remove the `isAdmin` import, the `initAdminListener()` call and `unsubscribeAdmins()` from the cleanup.
8. **`ProfilePanel.tsx`**:
   - `userIsAdmin` and `userIsSuperAdmin` come from the store;
   - `handleSearchUser` uses `lookupUserByEmail`;
   - the `searchedUser` state gets the type `{uid; email; username; photoURL} | null`.

   Nothing else changes. The level display keeps using `myAllSpots.length`: it is the live count of the same query the server counts (D8), so it is never staler than `spotsCount`.
9. **`SettingsPanel.tsx`**: `const userIsAdmin = useUserStore((s) => s.isAdmin)`.
10. **`SpotDetailsPanel.tsx`**:
    - Remove the `checkIsAdmin` import and use `userIsAdmin` from the store.
    - Delete the own-count effect (`:181-186`) and the `userSpotsCount` state. The review payload's `userSpotsCount` becomes `user.spotsCount ?? 0` (T11b removes it).
    - Creator effect: `fetchPublicProfile(spot.createdBy)`, then `creatorSpotsCount = p?.spotsCount ?? 0`, `creatorName = p?.username ?? null` and `creatorCustomNameColor = p?.customNameColor ?? undefined`. When `spot.createdBy === user.uid`, keep today's override: name and colour come from the store `user`.
    - Reviewer effect: `fetchPublicProfiles(missingIds)`, then `reviewerMeta[uid] = {username, customNameColor, spotsCount, isAdmin}`.
    - `ReviewerBadge` gets a new prop `isAdmin: boolean` (`meta.isAdmin === true`), which replaces `checkIsAdmin(review.userEmail)`.
    - Delete the `uploaderNames` state and its fetch (never rendered). Keep the `migrateSpotImages` call exactly as it is; T11b removes it.
11. **`SpotInfoWindow.tsx`**: the creator effect uses `fetchPublicProfile`, the same way, including the self override. Remove the imports of `collection`, `query`, `where`, `getDocs` and `db`.
12. **`AddSpotModal.tsx`**: pass `isAdmin` (from `useUserStore`) instead of `user.email` as `addSpot`'s last argument.
13. **`src/lib/firebase.ts`**: if `NEXT_PUBLIC_USE_EMULATORS` does not already call `connectFunctionsEmulator(functions, '127.0.0.1', <T04 port>)`, add it.
14. **e2e (`profile-admin.spec.ts`)**, using the seeded fixtures `E2E.user` (T04), `E2E.admin` (T04, legacy admin without `role`) and `E2E.superAdmin` (T08).
    - **Fixture rule** (T04 convention): no spec may leave a fixture used by another spec mutated. Playwright runs spec files alphabetically with `workers: 1`, so `profile-admin.spec.ts` runs before `smoke.spec.ts`, whose test 4 asserts the heading `e2e_user`. The rename therefore uses a dedicated fixture: add `rename: { uid: 'e2e-rename', email: 'rename@spoton.test', username: 'e2e_rename' }` to `E2E` in `e2e/fixtures.ts`, and seed its Auth user (`E2E.password`) and a `users/e2e-rename` doc shaped like T04's `users` fixtures.
    - **Toasts are not visible:** `useToastStore.showToast` only calls `addNotification` (`src/store/useToastStore.ts:22-33`), and `NotificationCenter` is not rendered while the profile or details panel is open (`page.tsx:271`). Add to `e2e/helpers.ts`:
      ```ts
      /** Toasts are recorded in the persisted notification store, never shown as popups. Polls it for a body. */
      export async function expectNotification(page: Page, body: string) {
        await expect
          .poll(() =>
            page.evaluate((b) => {
              try {
                const raw = window.localStorage.getItem('spoton-notifications');
                const list: Array<{ body?: string }> = raw ? JSON.parse(raw).state?.notifications ?? [] : [];
                return list.some((n) => n.body === b);
              } catch {
                return false;
              }
            }, body),
          )
          .toBe(true);
      }
      ```
    - Tests:
      - (1) `E2E.user`: the profile shows neither the pending tab nor the admin tab;
      - (2) `E2E.admin`: the pending tab is visible and the admin tab is not;
      - (3) `E2E.superAdmin`: the admin tab is visible, and its admin list does not contain the super admin's own entry;
      - (4) `E2E.rename`: the username changes to a fresh valid name, a notification with body `Username saved!` is recorded (`expectNotification`), and the new name persists after a reload;
      - (5) `E2E.rename`: changing to `e2e_admin` (another seeded user's username) records a notification with body `Username is already taken`;
      - (6) `E2E.user`: sign-out succeeds, and a notification with body `Sign out successful` is recorded.

## Must NOT change
- All UI, layout and visible texts (hu/en/de), and the component props of `MapView`, `SpotInfoWindow`, `SpotDetailsPanel` and `NotificationSettingsModal`.
- The level thresholds and D8 semantics.
- Store method names used by components: `updateUsername`, `checkUsernameAvailable`, `addAdmin`, `removeAdmin`, `updateCustomNameColor`, `updateCustomNameFont`, `signOut`, `setNeedsUsername`, `setUser`.
- When the username-setup modal appears (the new-user popup, the no-username flows, and the email-signup fallback, which is the only new trigger).
- Review, spot and image writes (T11b). The review payload keeps its current keys in this task.
- The persisted `spoton-user` localStorage shape (`partialize: user`). The new `User` fields are optional.

## Acceptance
```bash
npm run verify                      # includes new lib unit tests
npm run verify:fn
npm run test:e2e                    # includes e2e/profile-admin.spec.ts
! grep -rnE "NEXT_PUBLIC_ADMIN_EMAIL|setCachedAdminEmails|searchUserByEmail|initAdminListener|isSuperAdmin\(|isAdmin\(" src CLAUDE.md playwright.config.ts
! grep -n "'users'" src/components/SpotDetailsPanel.tsx src/components/SpotInfoWindow.tsx
! grep -rn "where('createdBy'" src/components/SpotDetailsPanel.tsx src/components/SpotInfoWindow.tsx
! grep -rn "where('username'" src
! grep -rn "username" src/store/useUserStore.ts | grep -E "setDoc|updateDoc"   # username never client-written
grep -n "arrayRemove(token" src/store/useUserStore.ts
grep -n "deleteToken" src/store/useUserStore.ts
```
Manual, in the emulator (`npm run dev` with the emulators):
- Enable notifications, change a notification setting, reload, and enable notifications again. The setting is kept (BUG-02).
- Sign out. `users/{uid}.fcmTokens` no longer contains that token.

## Rollback
`git revert`. The client-only change needs no data rollback. The `usernames` entries created meanwhile stay valid. Do not deploy a reverted client after T12 rules are live: the old client reads `users` of others and would break.

## Stop and ask Paul if…
- The admin list should also show the super admin itself. That would be a visible change; the default hides it.
- The admin list's `admin.name` field (rendered at `ProfilePanel.tsx:1004,1013`) should be fixed. Stored docs have `username`, not `name`, so names render empty today. This task does **not** change it.
- T04's e2e harness has no sign-in helper for seeded email users, or cannot run the functions emulator.
- `deleteToken` fails consistently in the emulator or browser tests in a way that blocks sign-out.
