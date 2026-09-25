# T30 — Hide pending spots (split queries, then rules)

**Phase:** 6 · **Depends on:** T12, T29 (T11a admin state, T26 hooks) · **Risk:** med-high · **Decisions:** D7, D8
**Audit refs:** SEC-13

## Goal
Stop sending unapproved spots to everyone:
- the client subscribes to **approved** spots, plus the signed-in user's **own** spots, plus **all** spots for admins;
- then the Firestore rules deny reading other users' pending spots.

The client change ships and deploys **first**, because rules do not filter queries (ROADMAP trap 1).

## Context
- **Current listener:** `useSpotStore.ts` `fetchSpots` (currently at :153-186, or the T21/T29 version).
  - One `onSnapshot(query(collection(db,'spots'), orderBy('createdAt','desc')))`, which streams every spot to every visitor, signed in or not.
  - It resolves its promise on the first snapshot; the page's loading screen waits for it (`useAppBootstrap`, T29).
  - `orderBy('createdAt')` **excludes** documents that lack `createdAt`.
- **Client-side hiding today:**
  - `useVisibleSpots` (T29; formerly `page.tsx` :82-84): admins see everything, other users see `status === 'approved'` only.
  - DiscoveryPanel filters approved (:73).
  - ProfilePanel's pending tab and count (`spots.filter(status==='pending')`) are admin-only.
  - Favourites (`spots.filter(savedSpots.includes)`) could include a pending spot the user saved.
- **Other spot reads that must keep working under the new rules:**
  - `useUserSpots(uid)` (T26): `where('createdBy','==',uid)`, own uid only → allowed.
  - `useUserStore.unhighlightSpot` `getDoc(spots/{id})` (or its T11b callable replacement), own approved spot → allowed.
  - Cloud Functions use the Admin SDK and are unaffected.
  - **Any query on another user's spots** (the old spot-count queries, DUP-10) must already be gone (T09/T11a/T26). Verify with the grep in Acceptance.
- **Indexes** (`firestore.indexes.json`):
  - `status ASC, createdAt DESC, __name__ DESC` already exists and serves the approved query.
  - The own query `where('createdBy','==',uid).orderBy('createdAt','desc')` needs **`createdBy ASC, createdAt DESC`**. It does **not** exist. The only createdBy index is `createdBy ASC, status ASC, createdAt ASC` (a quest leftover, which may have been removed by an earlier task), and it does not serve this query.
  - **The Firestore emulator does not enforce composite indexes**, so the tests cannot catch a missing index.
- **Admin state:** `useUserStore` `isAdmin` (T11a), exposed via `useIsAdmin` (T26). It resolves asynchronously after auth.
- **Rules:** `firestore.rules` from T12. The landmark is `match /spots/{spotId} { allow read: if true;  // pending hiding = T30`. The helper is `isAdmin()` (`signedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid))`). The tests are in `tests/rules/firestore.spots.test.ts`, using `tests/rules/helpers.ts` and `vitest.rules.config.ts`.

## Files
- **Commit A (client + index):**
  - `src/store/useSpotStore.ts`, `src/hooks/useAppBootstrap.ts` (T29), and the listener lifecycle wiring (where auth/admin changes are observed);
  - `firestore.indexes.json`;
  - new `src/lib/mergeSpots.ts` and `src/lib/mergeSpots.test.ts`;
  - e2e `e2e/pending-visibility.spec.ts`;
  - T04 seed (add a second user's pending spot, if missing).
- **Commit B (rules):** `firestore.rules`, `tests/rules/firestore.spots.test.ts`, `docs/security-rollout.md` (T30 section).

## Steps
### Commit A: client
1. **`src/lib/mergeSpots.ts`** (pure): `mergeSpotSources({ admin, own, approved }): Spot[]`.
   - Union by `id`, with precedence admin > own > approved when the same id appears twice (the same document, possibly at different snapshot times).
   - Sort to reproduce Firestore's `orderBy('createdAt','desc')`: by `createdAt` descending (compare `seconds`, then `nanoseconds`), ties broken by document id **descending** (the implicit `__name__` direction).
   - A `null` `createdAt` (a pending server timestamp on a local write) sorts **first**.
   - Unit-test: duplicates, ties, a null timestamp, empty sources, and admin-only input equal to the admin list unchanged.
2. **Store:** replace the single listener with up to three, each kept in its own slot, and recompute `spots = mergeSpotSources(...)` on each snapshot:
   - `approved`: `query(spots, where('status','==','approved'), orderBy('createdAt','desc'))`. **Always** active, signed-in or not.
   - `own`: `query(spots, where('createdBy','==',uid), orderBy('createdAt','desc'))`. Active while signed in and not an admin.
   - `admin`: today's unfiltered query. Active while admin. While it is active, `approved` and `own` may be stopped, since admin covers them.

   API:
   - `startSpots()` starts `approved` and resolves on its first snapshot. This preserves the loading gate, and anonymous visitors do not wait for auth.
   - `syncSpotScopes({ uid, isAdmin })` starts or stops `own`/`admin` idempotently.
   - `stopSpots()` stops everything (unmount, T21).
   - Call `syncSpotScopes` from the bootstrap whenever `user?.uid` or `isAdmin` changes. On sign-out, drop the `own`/`admin` data immediately, so a pending spot never lingers for the next user.
   - Errors on `own`/`admin` are logged and set `error`, but must not clear the `approved` data.
3. **`firestore.indexes.json`:** add `{ collectionGroup: 'spots', queryScope: 'COLLECTION', fields: [{createdBy ASC}, {createdAt DESC}] }`. Do not remove any existing index in this task.
4. **UI checks:** `useVisibleSpots`, the Discovery filter and the pending tab stay as they are. They still work, because the data is now a subset. The own pending spots of a non-admin are in `spots`, but `useVisibleSpots` still hides them on the map (as today). The profile's my-spots list uses `useUserSpots` (unchanged).
5. **E2E `pending-visibility.spec.ts`.** Seed: user A's pending spot P, user B's approved spot Q.
   - Signed out: the map shows Q's marker, and the store never contains P. Assert via Discovery count or `window.__spotStore` if T04 exposes one; otherwise check network or UI.
   - Signed in as A: the profile's my-spots list shows P as pending, and the map does not show P (unchanged rule).
   - Signed in as the admin: P is visible (yellow marker, pending tab count ≥ 1).
   - A adds a new spot: it appears in A's profile immediately (latency compensation).
6. `npm run verify` and `npm run test:e2e` must pass with **the old rules still in place**.

### Commit B: rules (a separate commit, deployed later)
7. In `firestore.rules`, the `spots/{spotId}` read rule becomes:
   ```
   allow read: if resource.data.status == 'approved'
               || (request.auth != null && resource.data.createdBy == request.auth.uid)
               || isAdmin();
   ```
   Keep T12's `isAdmin()` helper. Leave the create, update and delete rules untouched. Also update T12's existing "spots are publicly readable, including pending" test to the new expectation.
8. **Rules tests** (`tests/rules/firestore.spots.test.ts`), each asserting `assertSucceeds` or `assertFails`:
   - an anonymous approved-only query succeeds;
   - an anonymous unfiltered query fails;
   - user A's `where(createdBy==A)` query succeeds;
   - user A's `where(createdBy==B)` query fails;
   - user A's `get` of B's pending spot fails, and of B's approved spot succeeds;
   - the admin's unfiltered query succeeds;
   - the admin's `get` of a pending spot succeeds.
9. `docs/security-rollout.md`, T30 section:
   1. Deploy client commit A (container) and `firebase deploy --only firestore:indexes`. **Wait until the new index is built** (Firebase console shows "Enabled").
   2. Wait ≥ 24 h, so open tabs of the old client reload. Old clients use the unfiltered query and would see **no spots at all** once the rules land.
   3. Save the current rules, then `firebase deploy --only firestore:rules`.
   4. Watch the Firestore "denied" metrics.
   5. Rollback: redeploy the saved rules.

## Must NOT change
- What each role sees on the map, in Discovery, in the profile tabs and in the pending tab (D8: levels still count pending spots, server-side `spotsCount`).
- Spot ordering (`createdAt` desc) and the loading-screen gating.
- Favourites of approved spots.
- Existing indexes.
- No production deploy by the agent (CLAUDE rule 4).

## Acceptance
```bash
npm run verify
npx vitest run src/lib/mergeSpots.test.ts
npm run test:e2e                     # after commit A, with pre-T30 rules
npm run test:rules                   # after commit B
grep -rn "where('createdBy'" src | grep -v "src/store/useSpotStore.ts\|src/hooks/useUserSpots.ts"   # → none
grep -rn "collection(db, 'spots')" src                                                             # → only useSpotStore (and useUserSpots)
```
Manually confirm that `firestore.indexes.json` contains `createdBy ASC, createdAt DESC`, because the emulator will not tell you.

## Rollback
- **Rules:** redeploy the saved rules file (`docs/security-rollout.md`).
- **Client:** `git revert` commit A and redeploy the container. The old client works under the old rules, but **not** under the new ones. Revert the rules first if both are live.
- A new index is harmless to leave in place.

## Stop and ask Paul if…
- A pending spot that the user has favourited must stay visible in Favourites for users who are not its owner. Under the new rules they lose it; today they see it.
- Any other feature (deep link, share URL, notification click) opens a spot by id for a user who is not its owner while it is pending.
- The approved-query index is reported missing in production, or the deploy tries to delete indexes.
