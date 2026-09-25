# T06 — Firebase JS SDK 12

**Phase:** 1 · **Depends on:** T05 (and T04 for E2E) · **Risk:** med · **Decisions:** D14
**Audit refs:** SEC-07 (`firebase` moderate; transitive `protobufjs`/`websocket-driver` CRITICAL, `@grpc/grpc-js`/`undici` HIGH)

## Goal
Upgrade `firebase` from 10.14.1 to **12.19.0** (exact pin). The FCM service worker then loads the matching compat SDK version instead of the hardcoded `10.7.1`. The auth flow, persistence, query shapes and UI stay identical. After this task, `npm audit --omit=dev --audit-level=high` passes for the root project.

## Context
- `package.json`: `"firebase": "^10.12.0"` (locked 10.14.1). Latest 12.x on 2026-09-25: **12.19.0** (`SDK_VERSION` = `"12.19.0"`, verified).
- Firebase imports used in `src/`:
  - `firebase/app`: `initializeApp`, `getApps`;
  - `firebase/auth`: `getAuth`, `GoogleAuthProvider`, `browserLocalPersistence`, `setPersistence`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, and `connectAuthEmulator` (T04);
  - `firebase/firestore`: `getFirestore`, `collection`, `query`, `where`, `orderBy`, `onSnapshot`, `getDoc(s)`, `doc`, `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `arrayUnion`, `arrayRemove`, `serverTimestamp`, `Timestamp`, and `connectFirestoreEmulator`;
  - `firebase/storage`: `getStorage`, `ref`, `uploadBytes`, `getDownloadURL`, and `connectStorageEmulator`;
  - `firebase/functions`: `getFunctions`, `httpsCallable`, and `connectFunctionsEmulator`;
  - `firebase/messaging`: `getMessaging`, `getToken`, `onMessage`, `isSupported`.
- Breaking and relevant changes 10.14 → 12.19, from the `firebase-js-sdk` package changelogs:

  | Version | Change | Impact here |
  |---|---|---|
  | 11.0.0 | ES5 bundles removed (ES2017 minimum); undici/node-fetch replaced by native `fetch` in the Node bundles | None. Next transpiles for browsers; Node 22 has `fetch`; this also removes the vulnerable `undici` |
  | 11.x/12.x | VertexAI GA, then the `vertexai` import path removed (12.0) | Not used |
  | 12.0.0 | Node ≥ 20 engines; build target ES2020 | None (Node 22; Next's browserslist targets support ES2020) |
  | auth 1.10–1.13 | `browserCookiePersistence` added (opt-in); IndexedDB persistence robustness fixes (fall back to memory if init fails; pagehide/reload fixes); `signInWithPopup` background-tab fix | No API change. `setPersistence(auth, browserLocalPersistence)`, `getRedirectResult` (still `null` without a pending redirect), `onAuthStateChanged` are unchanged |
  | firestore 4.9–4.17 | pipelines (beta), Temporal support, gRPC window tuning | No API change for `Timestamp`, `arrayUnion`, `arrayRemove`, `serverTimestamp`, query builders |
  | messaging 0.13.0 (firebase 12.x) | `getToken`/`deleteToken` **deprecated** in favour of `register`/`onRegistered`/`onUnregistered` (FID-based) | JSDoc deprecation only. `getToken` and `isSupported` still work. **Do not migrate** (it would change the stored token model that `functions/` relies on; T08/T11a own FCM). No lint rule flags it (the config is not type-aware) |
  | functions 12.18.0 | `FunctionsError.message` now ends with the HTTP status, e.g. `"… [403]"` | **One visible text change.** `SpotDetailsPanel.tsx:336` toasts `error?.details?.message \|\| error?.message` when the `highlightSpot` callable fails, so a message without `details` gains a ` [status]` suffix in the NotificationCenter. Accepted as an SDK change; do not strip it (T10/T11b rewrite this flow). List it in the commit body |
- **Service worker** (`src/app/api/firebase-messaging-sw/route.ts:14-15`) hardcodes `https://www.gstatic.com/firebasejs/10.7.1/firebase-{app,messaging}-compat.js`. `SDK_VERSION` from `firebase/app` equals the installed `firebase` version. The npm package ships the same compat artifacts (`node_modules/firebase/firebase-app-compat.js` and `firebase-messaging-compat.js` exist in 12.19.0), and gstatic publishes every release under `/firebasejs/<version>/`. **gstatic is blocked by the sandbox proxy (HTTP 403 at CONNECT)**, so the `curl -I` check below must run where gstatic is reachable. The route change was verified: `next build` succeeds, and the served SW starts with `importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')`.
- Verified in a scratch copy: `tsc` is clean with no source changes; `next build` passes; T04's E2E passes 4/4 on 12.19.0 (with T03–T05 applied); `npm audit --omit=dev` leaves exactly **1 moderate** (`baseline-browser-mapping`, via `next`/`browserslist`), and nothing high or critical.

## Files
- Modify: `package.json`, `package-lock.json`, `src/app/api/firebase-messaging-sw/route.ts`
- Modify, conditionally: `.github/workflows/ci.yml` (the audit flip, step 5)

## Steps
1. `npm i --save-exact firebase@12.19.0`. If a newer 12.x exists, use it, and state it in the commit.
2. In `src/app/api/firebase-messaging-sw/route.ts`:
   - add `import { SDK_VERSION } from 'firebase/app';` below the `next/server` import;
   - in the template string, replace both `10.7.1` occurrences with `${SDK_VERSION}`. The result is `importScripts('https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js');` and the same for `firebase-messaging-compat.js`.

   Change nothing else in the file: config object, handlers, headers, and whitespace.
3. Make no other source changes. `src/lib/firebase.ts`, the stores and the hooks stay byte-identical.
4. Run the Acceptance.
5. **CI audit flip.** Check `docs/ROADMAP.md` §7 Progress. If T07 is already done, then in `.github/workflows/ci.yml` job `audit`:
   - delete the `continue-on-error: true` line and its TEMPORARY comment;
   - change both `--audit-level=critical` to `--audit-level=high`.

   If T07 is not done, leave `ci.yml` untouched; T07 does the flip.

## Must NOT change
- The auth flow: popup, then redirect fallback, then `getRedirectResult` in `initAuth`; `setPersistence(auth, browserLocalPersistence)`; the Google provider `prompt: 'select_account'`; the functions region `europe-west3`; the emulator block from T04.
- Firestore query shapes, document shapes and write patterns (including `Timestamp.now()` and `arrayUnion` usage).
- The FCM token flow (`getToken` with VAPID key and SW registration at `/api/firebase-messaging-sw`, scope `/`), the SW script content apart from the version, and the SW response headers.
- UI and text, apart from the SDK-generated `FunctionsError` suffix noted in Context.

## Acceptance
```bash
# (export T01's demo NEXT_PUBLIC_FIREBASE_* values if no .env.local)
npm ci
node -p "require('./package.json').dependencies.firebase"              # 12.19.0
node --input-type=module -e "import('firebase/app').then(m=>console.log(m.SDK_VERSION))"   # 12.19.0
ls node_modules/firebase/firebase-app-compat.js node_modules/firebase/firebase-messaging-compat.js
grep -c "10\.7\.1" src/app/api/firebase-messaging-sw/route.ts             # 0
git diff --stat -- src | tail -1                                        # 1 file changed (route.ts only)
npm run verify                                                          # green
npm run test:e2e                                                        # green
npx next start -p 3300 & sleep 5
curl -s localhost:3300/api/firebase-messaging-sw | head -3              # importScripts(... /firebasejs/12.19.0/firebase-app-compat.js ...)
curl -sI localhost:3300/api/firebase-messaging-sw | grep -iE '^(content-type|service-worker-allowed|cache-control):'
#   -> application/javascript / / / public, max-age=0, must-revalidate  (unchanged)
kill %1
npm audit --omit=dev --audit-level=high; echo "exit $?"                 # exit 0 (only moderate baseline-browser-mapping remains)
# Where gstatic is reachable (not the sandbox): both must be HTTP 200
curl -sSI https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js | head -1
curl -sSI https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js | head -1
```
Manual check (`npm run dev` against the emulators, or a preview deployment):
- Google popup sign-in and email sign-in both work, and a reload keeps the session.
- Spots load; adding a review works.
- Enabling notifications registers the SW without console errors. In DevTools → Application → Service Workers, the script URL is `/api/firebase-messaging-sw`, and its `importScripts` use version 12.19.0.

## Rollback
`git revert` the commit, then `npm ci`. There is no data migration. Clients that installed the new SW get the old one back on their next SW update check (`Cache-Control: max-age=0`).

## Stop and ask Paul if…
- `tsc` or the build reports an API removal in any import listed in Context.
- Auth persistence or redirect behaviour differs in the manual check (e.g. a reload signs the user out).
- The gstatic URLs for the chosen version do not return 200 where reachable. Do not self-host the compat scripts without a decision.
- `npm audit --omit=dev --audit-level=high` still fails. List the packages.
