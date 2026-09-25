# T09 — Functions: public profiles, spotsCount, usernames, name style

**Phase:** 2 · **Depends on:** T08 · **Risk:** med · **Decisions:** D8
**Audit refs:** SEC-04, SEC-05, SEC-09, SEC-16, DUP-10

## Goal
Other users will no longer be able to read `users/{uid}` once T12 lands. This task provides a safe public view instead: a server-maintained `publicProfiles/{uid}` mirror, and a server-computed `spotsCount` (all statuses, D8). It adds a uniqueness-enforcing `usernames/{name}` registry with a transactional `claimUsername` callable, and a level-checked, allowlisted `updateNameStyle` callable. A dry-run-first backfill script fills in the existing data.

## Context
- The client reads other users' full docs, and counts spots by downloading them:
  - `SpotDetailsPanel.tsx:184, :202-205, :246, :271-274`
  - `SpotInfoWindow.tsx:73-83`
  - `ProfilePanel.tsx:71`

  (SEC-04, DUP-10.)
- Levels are in `src/lib/levelUtils.ts`:
  - `calculateLevel` (`:39-45`): 20 or more → 5, 15 or more → 4, 10 or more → 3, 3 or more → 2, else 1.
  - `maxHighlights` (`:82-86`): level 4 or more → 2, level 3 → 1, else 0.
  - `canCustomizeName` is level 5 or more (`:101`).
  - The count includes pending spots (D8).
- The name-style options are shown in `ProfilePanel.tsx:656-733`, which renders `CUSTOM_NAME_COLORS` / `CUSTOM_NAME_FONTS` imported from `levelUtils.ts:163-184`. The exact `value`s are the allowlists:
  - colors: `text-cyan-300`, `text-purple-400`, `text-emerald-400`, `text-rose-400`, `text-yellow-300`, `text-slate-300`, `text-orange-400`
  - fonts: `font-sans`, `font-bold`, `font-serif`, `font-mono`, `font-serif italic`, `font-extrabold`, `font-light italic`
- The font is interpolated into `className` (`SpotDetailsPanel.tsx:76`, `ProfilePanel.tsx:753`), so non-allowlisted values are an injection vector (SEC-05).
- Username rules today:
  - `useUserStore.updateUsername` (`:574-599`): trim, lowercase, length 3–20, `^[a-z0-9_]+$`. The combined form is `^[a-z0-9_]{3,20}$`.
  - Uniqueness is only a non-transactional query (`:549-571`).
  - Sign-up writes the username unchecked (`:253-263`), and generated names are `base(≤12 chars)+random(0..999999)` (`:85-92`).
- Duplicate usernames may already exist (ROADMAP trap 10). The backfill must report them and never overwrite.
- ROADMAP trap 7: `spotsCount` must include pending spots.
- `publicProfiles` also carries `isAdmin` (boolean). The review Admin badge (`SpotDetailsPanel.tsx:84`) must stop keying on `review.userEmail`, and T12 makes `admins` unreadable for non-admins. So the public flag is the only safe source. It is derived from `admins/{uid}` existence.
- The Admin SDK `Transaction.get()` accepts an `AggregateQuery` (verified in `@google-cloud/firestore` 9.x typings used by `firebase-admin` 14).

## Files
- Create:
  - `functions/src/lib/levels.ts`: a copy of the level table, `maxHighlightsForCount`, and the name-style allowlists. Its header comment says: "KEEP IN SYNC with src/lib/levelUtils.ts (parity test: functions/test/levels.parity.test.ts)". No imports.
  - `functions/src/lib/profiles.ts`: pure, with no imports. Holds `USERNAME_RE`, `normalizeUsername`, `validateNameStylePatch`, `buildPublicProfile`, `profileFieldsEqual`.
  - `functions/src/triggers/profiles.ts`: `syncPublicProfile`, `syncSpotsCount`, `syncAdminFlag`.
  - `functions/src/callables/profile.ts`: `claimUsername`, `updateNameStyle`.
  - `functions/test/profiles.test.ts`, `functions/test/levels.parity.test.ts`.
  - `scripts/backfill-profiles.ts`.
- Modify: `functions/src/index.ts` (add re-exports), `scripts/seed-emulator.ts` (see step 8).
- Delete: none.

## Steps
1. **`lib/levels.ts`:**
   - `calculateLevel(count)` and `maxHighlightsForCount(count)`, identical to `levelUtils.ts`;
   - `NAME_STYLE_MIN_LEVEL = 5`;
   - `NAME_COLORS` / `NAME_FONTS` as `readonly string[]` holding the exact values listed in Context.
2. **`lib/profiles.ts`** (pure):
   - `USERNAME_RE = /^[a-z0-9_]{3,20}$/`.
   - `normalizeUsername(x: unknown): string | null`: for a string, trim and lowercase it, then return it if it matches `USERNAME_RE`, else `null`.
   - `validateNameStylePatch(data: unknown)` returns `{color?: string | null; font?: string | null}` or throws a validation error:
     - `data` is an object whose keys are a non-empty subset of `color` and `font`;
     - each value is `null` or a member of the matching allowlist.
   - `buildPublicProfile(user, {isAdmin})` returns `{username, profilePictureURL, customNameColor, customNameFont, isAdmin, spotsCount?}`, where:
     - `username`: a string, else `null`;
     - `profilePictureURL`: `user.profilePictureURL || user.photoURL || null`;
     - `customNameColor` / `customNameFont`: the value if it is in its allowlist, else `null` (legacy junk is dropped);
     - `spotsCount`: included **only** if `user.spotsCount` is a non-negative integer.
   - `profileFieldsEqual(a, b)` compares all keys except `updatedAt`.
3. **`syncPublicProfile`** = `onDocumentWritten("users/{uid}")`:
   - If the user doc was deleted, delete `publicProfiles/{uid}` and return.
   - Otherwise, **re-read** `users/{uid}` fresh (not the event snapshot, so out-of-order events converge), read `admins/{uid}`, then build the projection.
   - Read `publicProfiles/{uid}`. If `profileFieldsEqual(existing ⊇ projection)` holds, **skip the write** (idempotent, no loops).
   - Otherwise `set(projection + {updatedAt: serverTimestamp()}, {merge: true})`.
   - This function writes only `publicProfiles`. No trigger listens there, so there is no loop.
4. **`syncSpotsCount`** = `onDocumentWritten("spots/{spotId}")`:
   - Let `before = event.data.before.data()` and `after = event.data.after.data()`.
   - Act **only** if the spot was created or deleted, or `before.createdBy !== after.createdBy`. Reviews, likes, status, highlight and edit updates must not recount.
   - For each distinct non-empty string uid in `{before?.createdBy, after?.createdBy}`, run one `db.runTransaction`:
     - `n = (await tx.get(db.collection("spots").where("createdBy","==",uid).count())).data().count`, which counts **all statuses** (D8);
     - `tx.get(users/{uid})`; if it does not exist, stop (never create a users doc);
     - if `users.spotsCount !== n`, `tx.update(users/{uid}, {spotsCount: n})`;
     - `tx.set(publicProfiles/{uid}, {spotsCount: n, updatedAt: serverTimestamp()}, {merge: true})`, only if the existing value differs.
5. **`syncAdminFlag`** = `onDocumentWritten("admins/{uid}")`: if `users/{uid}` exists, `set(publicProfiles/{uid}, {isAdmin: after exists, updatedAt}, {merge: true})`, skipping the write when unchanged.
6. **`claimUsername({username})`**, `onCall`:
   - Require auth (`unauthenticated`).
   - `normalizeUsername`; null gives `invalid-argument` `"Username must be 3-20 characters of a-z, 0-9 or _"`.
   - Run a transaction, doing all reads first:
     - `reg = tx.get(usernames/{name})`;
     - `user = tx.get(users/{uid})` (missing gives `failed-precondition` `"User profile missing"`);
     - if `!reg.exists`, `legacy = tx.get(users.where("username","==",name).limit(2))`. This transitional guard also covers users not yet registered by the backfill.
   - Then decide and write:
     - If `reg.exists && reg.uid !== uid`, or `legacy` contains a doc other than `uid`, throw `already-exists` `"Username is already taken"`. This is the same text the client shows today.
     - If `user.username === name` and `reg.exists && reg.uid === uid`, return `{username: name}` (no-op).
     - Otherwise, let `old = user.username`. If `old && old !== name`, `tx.get(usernames/{old})` must happen in the reads phase (read it up-front whenever `old` is set). If it exists with `uid === caller`, `tx.delete` it.
     - `tx.set(usernames/{name}, {uid})` and `tx.update(users/{uid}, {username: name})`.
   - Return `{username: name}`.
   - Log `{uid, outcome}` only.
7. **`updateNameStyle({color?, font?})`**, `onCall`:
   - Require auth.
   - `validateNameStylePatch`; an error gives `invalid-argument`.
   - `n = count()` of `spots where createdBy == uid` (live, all statuses). If `calculateLevel(n) < 5`, throw `permission-denied` `"Level 5 required"`.
   - `update(users/{uid}, …)`, where a string sets the field and `null` becomes `FieldValue.delete()`. The mirror trigger propagates the change.
   - Return `{success: true}`.
8. **Seed** (`scripts/seed-emulator.ts`): add fixtures for the backfill test:
   - two users sharing one username (a duplicate);
   - one user with an invalid legacy username (for example `Béla` or `ab`);
   - one user with 20 or more spots (mixed pending/approved), for level 5.

   Keep all existing fixtures.
9. **`scripts/backfill-profiles.ts --project <id> [--apply]`** uses T08's `scripts/lib/cli.ts` guard and imports the pure helpers from `functions/src/lib/profiles.ts` and `levels.ts` (both stay import-free):
   - One pass over `spots` with `select("createdBy")` builds `countByUid` (all statuses).
   - Read all `admins` ids.
   - Page through `users` ordered by document ID, 300 at a time. For each user, plan:
     - (a) `users.spotsCount = countByUid[uid] ?? 0`, if it differs;
     - (b) `publicProfiles/{uid}` = `buildPublicProfile({...user, spotsCount}, {isAdmin})`, if it differs.
   - Usernames: group `normalizeUsername(user.username)` → uids.
     - Exactly one uid, and the registry is missing: plan `usernames/{name} = {uid}`.
     - The registry exists with a different uid: **report a conflict** and don't write.
     - More than one uid: **report a duplicate** (name plus uids) and write nothing for that name.
     - Invalid or missing: **report** the uid.
     - Never modify `users.username`.
   - Execute in batches of at most 400 writes, only with `--apply`.
   - Output one `key: value` line per count, with exactly these keys: `users`, `profiles to write`, `counts to fix`, `usernames to register`, `planned writes`, `duplicates`, `conflicts`, `invalid`. Then print the duplicate/conflict/invalid lists with uids. **No emails.**
   - Idempotent: a second `--apply` plans 0 writes.
10. **Tests** (`functions/test`):
    - `profiles.test.ts`:
      - username valid/invalid (`ab`, 21 chars, `A_b` normalises to `a_b`, `béla`, `a b`, non-string);
      - name-style patch (each allowlisted value, `null`, unknown value, unknown key, empty object, non-object);
      - `buildPublicProfile`: an injected font `fixed inset-0` becomes `null`; the photo fallback; `spotsCount` omitted when absent;
      - `profileFieldsEqual`.
    - `levels.parity.test.ts`:
      - imports `../../src/lib/levelUtils` (pure);
      - for n in 0..30, asserts `calculateLevel` and `getLevelInfo(n).maxHighlights` match;
      - asserts `NAME_COLORS` / `NAME_FONTS` deep-equal `CUSTOM_NAME_COLORS.map(v=>v.value)` / `CUSTOM_NAME_FONTS.map(v=>v.value)`.
11. **`index.ts`**: add `export {syncPublicProfile, syncSpotsCount, syncAdminFlag} from "./triggers/profiles"` and `export {claimUsername, updateNameStyle} from "./callables/profile"`. These are additions only.

## Must NOT change
- Every T08 export, including the five legacy function names.
- `users.username` values: the backfill never rewrites them, and duplicates stay as they are.
- The level thresholds and D8 semantics (pending spots count).
- No client (`src/`) changes. The client does not use these functions until T11a.
- Stored shapes: `publicProfiles/{uid}` = `{username, profilePictureURL, customNameColor, customNameFont, spotsCount, isAdmin, updatedAt}`, and `usernames/{name}` = `{uid}`.

## Acceptance
```bash
npm run verify:fn
npm --prefix functions test            # profiles + parity tests green
npm run verify
npm --prefix functions run build
# backfill: dry-run shows planned writes + duplicate report, apply, then re-run plans 0 writes
npx firebase emulators:exec --project demo-spoton --only auth,firestore \
  "npx tsx scripts/seed-emulator.ts && \
   npx tsx scripts/backfill-profiles.ts --project demo-spoton && \
   npx tsx scripts/backfill-profiles.ts --project demo-spoton --apply && \
   npx tsx scripts/backfill-profiles.ts --project demo-spoton | tee /tmp/bf2.txt"
grep -E "planned writes: 0" /tmp/bf2.txt
grep -E "duplicates: [1-9]" /tmp/bf2.txt
npm run test:e2e                       # functions emulator loads the new triggers; UI unchanged
```
Manual (emulator UI, with `firebase emulators:start --project demo-spoton` and the seed):
- Adding a spot as `user@spoton.test` updates `users/{uid}.spotsCount` and `publicProfiles/{uid}.spotsCount` within seconds.
- Adding a review does **not** trigger a recount (check the function logs).

## Rollback
`git revert`. If deployed: redeploy the previous tag; the new functions get deleted. The `publicProfiles` and `usernames` data can stay (it is unused by old clients). The `users.spotsCount` field is harmless.

## Stop and ask Paul if…
- The backfill reports duplicate or conflicting usernames. Paul decides who keeps the name before T11a ships.
- Adding `isAdmin` to `publicProfiles` (needed for the review Admin badge) is not acceptable.
- Any legacy user has a hex, rgb or hsl `customNameColor` (which `getCustomNameColorValue` accepts). The allowlist mirror drops it to `null`, so confirm that's acceptable.
