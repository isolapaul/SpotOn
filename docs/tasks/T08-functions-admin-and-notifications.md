# T08 — Functions: admin identity and notifications backbone

**Phase:** 2 · **Depends on:** T07 (and T01, T04 harness) · **Risk:** med · **Decisions:** D9, D14
**Audit refs:** SEC-01, SEC-04, SEC-08, SEC-14, SEC-17, SEC-18, SEC-19, BUG-14, BUG-15, BUG-21

## Goal
Split `functions/src/index.ts` into small modules. Admin identity moves to the server: a user is an admin when `admins/{uid}` exists, and the super admin is the one whose doc has `role == 'super'`. Admin management runs through super-admin-only callables. Notifications reach admins by uid. FCM tokens are pruned only when FCM says they are dead. The notification link comes from a parameter, and the functions stop logging tokens and payloads. Every exported function name stays the same.

## Context
- **Sandbox note (from T07 review):** in this sandbox the Firebase CLI sends even `127.0.0.1` emulator-to-emulator calls through the HTTPS proxy, so Firestore trigger registration fails with 403 "no rule allows host 127.0.0.1" when the functions emulator runs with the Firestore emulator. Run local emulator commands with `NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost` prefixed (this only bypasses the proxy for localhost). Do not bake this into scripts or CI; GitHub runners have no proxy.
- **Orchestrator note (from T07):** `firebase-admin` 14 removed the namespaced `admin.firestore()` / `admin.messaging()` / `admin.firestore.FieldValue` style. T07 already converted `functions/src/index.ts` to the modular imports (`firebase-admin/app`, `firebase-admin/firestore`, `firebase-admin/messaging`). T08 adds `getAuth` from `firebase-admin/auth`. All new code in this task and in T09–T10 must use those modular imports (`getFirestore()`, `FieldValue` from `firebase-admin/firestore`, `getMessaging()`, `getAuth()`).
- `functions/src/index.ts` is 606 lines: translations (`:23-80`, where `:70-79` are Valentine), `sendNotificationToUser` (`:85-201`), `sendNotificationToAdmins` (`:206-244`), and the triggers `onSpotApproved` (`:249-343`, with Valentine tracking at `:278-340`), `onReviewAdded` (`:348-390`), `onSpotFavorited` (`:395-447`) and `onNewPendingSpot` (`:452-481`), plus the callable `highlightSpot` (`:486-606`).
- `:161` hardcodes the link `https://spoton-app.web.app` (BUG-21, SEC-18).
- `:178-196` prunes **every** failed token and `:182` logs the full token (SEC-14, SEC-19). `:487` logs `request.data`, and `:521` logs `questRewards` (SEC-19).
- `:215-236` looks up each admin's user by `email` (N+1). The super admin has no `admins` doc today, so they never get alerts (BUG-14).
- `:438` sends `data.type: "spot_favorited"`. The client union at `src/store/useNotificationStore.ts:10` and the icon switch at `src/components/NotificationCenter.tsx:40` only know `'new_like'`. `usePushNotifications.ts:157` copies `payload.data.type` into the in-app notification. The service worker (`src/app/api/firebase-messaging-sw/route.ts:28-29`) uses only `data.tag` and passes `data` through. **Minimal consistent fix:** the function sends `'new_like'`. No client change.
- Client admin management today: `useUserStore.ts:467-546` (a full `users` scan, then a client-side `setDoc`/`deleteDoc` on `admins`). The UI flow in `ProfilePanel.tsx:115-160, 920-1031` is: enter email → "search" shows a preview (username, email, photo) → "grant". T11a keeps that UI, so T08 must provide a server-side lookup (SEC-04 says admin lookup by email moves into a callable).
- Existing `admins/{uid}` docs have `{email, username, photoURL, addedAt, addedBy}` and no `role`. They stay valid (role missing = admin).
- After T07: Node 22, `firebase-functions` 7, `firebase-admin` 14, TS 5, ESLint 9, v2 APIs, `setGlobalOptions({region: "europe-west3"})`.
- After T04: emulator project `demo-spoton`, `scripts/seed-emulator.ts`, `npm run test:e2e`. After T01: `npm run verify:fn`.
- Firebase CLI parameter resolution (verified in `firebase-tools` 15.31 `lib/functions/env.js` and `lib/deploy/functions/params.js`):
  - Values are read from `functions/.env`, `functions/.env.<projectId>`, and (in the emulator) `functions/.env.local`.
  - An interactive deploy prompts for missing values and writes `functions/.env.<projectId>`.
  - A non-interactive run with a missing value is an error.

## Files
- Create:
  - `functions/src/lib/app.ts`: Admin SDK init and `setGlobalOptions`; exports `db`, `messaging`, `auth`.
  - `functions/src/lib/admin.ts`: `getAdminRole(uid)`, `assertSuperAdmin(request)`.
  - `functions/src/lib/i18n.ts`: translations and `translate()`.
  - `functions/src/lib/tokens.ts`: a pure FCM error classifier.
  - `functions/src/lib/notify.ts`: `sendNotificationToUser`, `sendNotificationToAdmins`.
  - `functions/src/triggers/spots.ts`: `onSpotApproved`, `onReviewAdded`, `onNewPendingSpot`.
  - `functions/src/triggers/users.ts`: `onSpotFavorited`.
  - `functions/src/callables/admins.ts`: `addAdmin`, `removeAdmin`, `lookupUserByEmail`.
  - `functions/src/callables/highlightSpot.ts`: the existing callable, moved.
  - `functions/test/tokens.test.ts`, `functions/test/i18n.test.ts`, `functions/test/admin.test.ts`.
  - `functions/vitest.config.ts`.
  - `functions/.env.demo-spoton`: exactly one line, `APP_URL=http://localhost:3000` (emulator only, not a secret; see Stop-and-ask).
  - `scripts/lib/cli.ts`: shared argument parsing and safety guard for the admin scripts (reused by T09 and T13).
  - `scripts/bootstrap-super-admin.ts`.
- Modify:
  - `functions/src/index.ts`: becomes re-exports only.
  - `functions/package.json`: vitest devDependency and a `test` script.
  - Root `package.json`: `verify:fn` also runs `npm --prefix functions test`; `test:e2e` adds the functions emulator (step 15).
  - `scripts/seed-emulator.ts` and `e2e/fixtures.ts`: fixture roles, see step 9.
  - `.gitignore`: see step 8.
  - `.github/workflows/ci.yml`: job `e2e` installs the functions dependencies (step 15).
- Delete: none.

## Steps
1. **`lib/app.ts`.**
   - Call `setGlobalOptions({region: "europe-west3"})` and `initializeApp()` once.
   - Export `db = getFirestore()`, `messaging = getMessaging()` and `auth = getAuth()`, using the modular `firebase-admin/*` entry points.
   - Every other module imports from here, so init runs before any function is defined.
2. **`lib/i18n.ts`.**
   - Move the translation table **without** `valentineQuestCompleted` and `valentineQuestCompletedBody`. All hu/en/de strings stay byte-identical.
   - Export `type TKey` and `translate(key, lang, params): string`. `lang` falls back to `en`, exactly as `:128-149` does today.
   - Nothing that `highlightSpot` uses lives in the translations, so no Valentine key is kept.
3. **`lib/tokens.ts`** (pure, with no firebase imports):
   ```ts
   export const PRUNABLE_TOKEN_ERROR_CODES: ReadonlySet<string> = new Set([
     "messaging/registration-token-not-registered",
     "messaging/invalid-registration-token",
   ]);
   export function isPrunableTokenError(code: string | undefined): boolean;
   export function selectTokensToPrune(tokens: string[],
     responses: ReadonlyArray<{success: boolean; error?: {code?: string}}>): string[];
   ```
   `selectTokensToPrune` returns `tokens[i]` only where `responses[i].success === false` and the code is prunable.
4. **`lib/notify.ts`.**
   - `sendNotificationToUser(uid, titleKey, bodyKey, bodyParams, data, settingsKey?)` keeps today's behaviour for: the user-missing, `notificationsEnabled === false`, per-setting `false`, no-tokens and language-fallback checks.
   - The `settingsKey` type becomes `"spotApproved" | "spotReviewed" | "newPendingSpot"`.
   - The link comes from `const APP_URL = defineString("APP_URL", {description: "Public base URL of the web app (notification click link)"})`, imported from `firebase-functions/params`. Read `APP_URL.value()` **inside** the function, not at module top level. Set `webpush.fcmOptions.link` only when the value starts with `https://` (FCM requires HTTPS; the emulator value is `http://localhost:3000`). Otherwise omit `fcmOptions`.
   - Keep `notification.requireInteraction/icon/badge` as they are.
   - Pruning: call `selectTokensToPrune`, then `arrayRemove` those tokens. Log only counts (`sent`, `failed`, `pruned`) and the distinct error codes. **Never log tokens.**
   - `sendNotificationToAdmins(...)`:
     - `db.collection("admins").get()`.
     - For each doc, call `sendNotificationToUser(doc.id, ...)`. No email lookup.
     - `Promise.allSettled`. Log the admin count only.
5. **`lib/admin.ts`.**
   - `getAdminRole(uid): Promise<"super" | "admin" | null>`, read from `admins/{uid}`: `role === "super"` means super; the doc existing means admin; otherwise null.
   - `assertSuperAdmin(request)` throws `HttpsError("unauthenticated")` when there is no auth, and `HttpsError("permission-denied", <message>)` when the role is not `"super"`.
   - Also export a pure `normalizeEmail(input: unknown): string | null`: trim, lowercase, length 3–254, must contain exactly one `@`, and a non-string gives `null`.
6. **`callables/admins.ts`.** Use `onCall` v2. Messages are the **exact English strings** the client already shows via `error.message`.
   - `lookupUserByEmail({email})`:
     - Super only, with the message `"Only Super Admin can search users"`.
     - Call `normalizeEmail`, which gives `invalid-argument` `"Invalid email"`.
     - Call `auth.getUserByEmail`. `auth/user-not-found` becomes `HttpsError("not-found", "User not found")`.
     - Read `users/{uid}`. Return `{uid, email, username: users.username || userRecord.displayName || "user", photoURL: users.profilePictureURL || users.photoURL || userRecord.photoURL || ""}`.
   - `addAdmin({email})`:
     - Super only, `"Only Super Admin can add admins"`.
     - Normalise the email; resolve the uid as above (`not-found`, `"User not found"`).
     - If `admins/{uid}` exists, throw `already-exists` `"User is already an admin"`.
     - Write `admins/{uid}` = `{email: userRecord.email, username, photoURL, addedAt: FieldValue.serverTimestamp(), addedBy: callerUid, role: "admin"}` with `create()`, so a race gives `already-exists`.
     - Return `{uid, username}`.
   - `removeAdmin({uid})`:
     - Super only, `"Only Super Admin can remove admins"`.
     - `uid` must be a non-empty string of at most 128 characters, else `invalid-argument`.
     - If the doc is missing, throw `not-found` `"Admin not found"`.
     - If `role === "super"`, throw `failed-precondition` `"Cannot remove a super admin"`.
     - Delete the doc and return `{success: true}`.
   - Log `{callerUid, targetUid, outcome}` only, never emails or payloads.
7. **Triggers.** Move them unchanged except for these three differences:
   - (a) `onSpotApproved` loses the whole Valentine block (`:278-340`).
   - (b) `onSpotFavorited` sends `type: "new_like"` instead of `"spot_favorited"`.
   - (c) Replace `event: any` with the typed v2 events.
   - Keep the same document paths, event types (`onDocumentUpdated` / `onDocumentCreated`), data keys (`type`, `spotId`, `spotName`, `rating`, `reviewerName`, `creatorName`) and settings keys.
8. **Parameter files.**
   - Create `functions/.env.demo-spoton` with `APP_URL=http://localhost:3000`.
   - Append to `.gitignore`:
     ```
     functions/.env.*
     !functions/.env.demo-spoton
     ```
     This way the production file `functions/.env.<prodProjectId>`, which `firebase deploy` writes, is never committed.
9. **Seed fixtures** (`e2e/fixtures.ts` and `scripts/seed-emulator.ts`):
   - Add to `E2E` in `e2e/fixtures.ts`: `superAdmin: { uid: 'e2e-super', email: 'super@spoton.test', username: 'e2e_super' }`.
   - In the seed, add for it:
     - an Auth user with its `uid`, `email` and `E2E.password`;
     - `users/e2e-super`, shaped exactly like T04's `users` fixtures (`{ uid, username, email, photoURL: '', profilePictureURL: '', profileBannerURL: '', savedSpots: [], createdAt: t, lastLoginAt: t }`);
     - `admins/e2e-super`: `{ email: 'super@spoton.test', username: 'e2e_super', photoURL: '', addedAt: t, addedBy: 'seed', role: 'super' }`.
   - Keep T04's legacy admin `admin@spoton.test` (`admins/e2e-admin` with **no** `role` field, the legacy shape) and the regular user `user@spoton.test` (no `admins` doc) unchanged.

   Keep all of T04's legacy spot and review fixtures.
10. **`callables/highlightSpot.ts`.**
    - Move `highlightSpot` verbatim: same export name, same checks, same writes, same return value, same error codes and messages.
    - The only change is logging: replace `:487` and `:521` with `logger.info("highlightSpot", {uid, spotId})`, and remove all other data dumps. T10 replaces the logic.
11. **`index.ts`** contains only:
    ```ts
    export {onSpotApproved, onReviewAdded, onNewPendingSpot} from "./triggers/spots";
    export {onSpotFavorited} from "./triggers/users";
    export {highlightSpot} from "./callables/highlightSpot";
    export {addAdmin, removeAdmin, lookupUserByEmail} from "./callables/admins";
    ```
12. **Tests.**
    - Add `vitest` as an exact-pinned devDependency of `functions/`, the same version as the root one from T01.
    - Add `"test": "vitest run"` and `functions/vitest.config.ts` with `test.include = ["test/**/*.test.ts"]` and `environment: "node"`.
    - Tests live in `functions/test/`, outside `src/`, so `tsc` does not compile them into `lib/` or deploy them.
    - `tokens.test.ts` covers:
      - both prunable codes → pruned;
      - `messaging/internal-error`, `messaging/server-unavailable`, `messaging/quota-exceeded`, `messaging/invalid-argument`, `undefined` → not pruned;
      - mixed success/failure arrays;
      - index alignment.
    - `i18n.test.ts` covers:
      - every key exists in hu/en/de;
      - parametrised bodies render;
      - unknown language → en;
      - no key contains `valentine`.
    - `admin.test.ts` covers the `normalizeEmail` cases.
    - Root `verify:fn` becomes `<existing T01 command> && npm --prefix functions test`.
13. **`scripts/lib/cli.ts`** exports `parseArgs(argv, spec)` and `guardTarget({project, apply})`:
    - `--project` is required, else exit 2.
    - If `project` starts with `demo-` and `FIRESTORE_EMULATOR_HOST` is unset, refuse (exit 2).
    - If `project` does **not** start with `demo-` but `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST` is set, refuse (exit 2). A real project id must never be mixed with emulator env.
    - Print one banner line: `TARGET=<project> MODE=<dry-run|APPLY> EMULATOR=<yes|no>`.
    - Dry-run is the default. Writes happen only with `--apply`.
    - Credentials: the Admin SDK's Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`). Never read key paths from argv.
14. **`scripts/bootstrap-super-admin.ts`** takes `--email <e> --project <id> [--apply]`:
    - `initializeApp({projectId})`.
    - `getAuth().getUserByEmail(email)`; if not found, exit 1 with `"User not found"`.
    - Read `users/{uid}`.
    - If `admins/{uid}.role === "super"` already, print `"already super"` and exit 0 (idempotent).
    - Otherwise plan `set(admins/{uid}, {email, username, photoURL, addedBy: uid, role: "super", addedAt: serverTimestamp()}, {merge: true})`. When the doc already exists, merge keeps its original `addedAt`: only write `addedAt` if the doc is missing.
    - Print the plan with the uid, and apply it only with `--apply`.
    - Run it the same way T04 runs `seed-emulator.ts` (the commands below assume `npx tsx`).
15. **Emulator coverage.** T04's `test:e2e` runs only `auth,firestore,storage`. Replace the root `package.json` script with exactly:
    ```json
    "test:e2e": "npm --prefix functions run build && firebase emulators:exec --only auth,firestore,storage,functions --project demo-spoton \"tsx scripts/seed-emulator.ts && playwright test\""
    ```
    T04 already configured the functions emulator port (5001) in `firebase.json` and wired `connectFunctionsEmulator`. In `.github/workflows/ci.yml`, job `e2e`, add the step `- run: npm --prefix functions ci` directly before `- run: npm run test:e2e` (the job otherwise only runs the root `npm ci`). The CLAUDE.md single-spec command is updated by the orchestrator. If this can't be done cleanly, stop and ask.

## Must NOT change
- Exported names `onSpotApproved`, `onReviewAdded`, `onSpotFavorited`, `onNewPendingSpot` and `highlightSpot`. Their trigger paths and event types. Region `europe-west3`.
- All non-Valentine notification texts (hu/en/de). Notification `data` keys and values, **except** `type: "spot_favorited"` → `"new_like"`.
- The settings semantics: `notificationsEnabled === false` and `notificationSettings[key] === false` suppress sending.
- `highlightSpot` behaviour, inputs, outputs and error messages, which T10 changes.
- Existing `admins/{uid}` docs without `role` keep meaning "admin".
- No client (`src/`) changes in this task.

## Acceptance
```bash
npm --prefix functions ci
npm run verify:fn                       # build + lint + unit tests
npm --prefix functions test             # tokens / i18n / admin tests green
npm run verify
# no tokens, payloads, emails or Valentine quest code left in functions
# (`valentine2026` in callables/highlightSpot.ts is the D9 bonus and stays):
! grep -rnE "valentineQuest|Valentine|spot_favorited|spoton-app\.web\.app|request\.data\}|tokens\[idx\]" functions/src
! grep -rn "where(\"email\"" functions/src
grep -n "new_like" functions/src/triggers/users.ts
# export surface (built output):
GCLOUD_PROJECT=demo-spoton node -e "const m=require('./functions/lib/index.js');for(const k of ['onSpotApproved','onReviewAdded','onSpotFavorited','onNewPendingSpot','highlightSpot','addAdmin','removeAdmin','lookupUserByEmail']) if(!m[k]) {console.error('missing',k);process.exit(1)}"
# bootstrap script against the emulator only (dry-run, then apply, then idempotent re-run):
npm --prefix functions run build
npx firebase emulators:exec --project demo-spoton --only auth,firestore \
  "npx tsx scripts/seed-emulator.ts && \
   npx tsx scripts/bootstrap-super-admin.ts --project demo-spoton --email user@spoton.test && \
   npx tsx scripts/bootstrap-super-admin.ts --project demo-spoton --email user@spoton.test --apply && \
   npx tsx scripts/bootstrap-super-admin.ts --project demo-spoton --email user@spoton.test"
# guard: refuses without --project, and refuses demo-* without emulator:
! npx tsx scripts/bootstrap-super-admin.ts --email x@y.z
! env -u FIRESTORE_EMULATOR_HOST npx tsx scripts/bootstrap-super-admin.ts --project demo-spoton --email x@y.z
# guard: refuses a non-demo project while emulator env is set:
! FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/bootstrap-super-admin.ts --project some-real-project --email x@y.z
npm run test:e2e                        # still green, with the functions emulator running
```
Manual check: the last bootstrap run prints `already super`, and the dry-run printed a plan without writing anything.

## Rollback
`git revert` the commit. Nothing is deployed by this task. If it has already been deployed: redeploy the previous tag's functions. `addAdmin`, `removeAdmin` and `lookupUserByEmail` would then be deleted, which is safe only while no client that uses them (T11a) is live.

## Stop and ask Paul if…
- The repo rule "never commit `.env*` files" is to be enforced strictly for `functions/.env.demo-spoton`. The alternative is to have the emulator harness write that file at runtime.
- T04's harness cannot run the functions emulator inside `test:e2e`.
- T04 did not add `firebase-admin` or a TS script runner (`tsx`) at the root, since the scripts need both.
- Any existing `admins` doc already has a `role` field with an unexpected value.
