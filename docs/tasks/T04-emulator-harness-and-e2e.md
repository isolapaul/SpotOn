# T04 — Emulator harness, seed data, Playwright smoke

**Phase:** 0 · **Depends on:** T01 (T02 for the CI job) · **Risk:** low-med · **Decisions:** —
**Audit refs:** code-review §6 pillars 1 and 4; CLAUDE.md rules 4 and 5 (emulator only, legacy shapes)

## Goal
`npm run test:e2e` does the following against the local Firebase emulators, project `demo-spoton`, never production:
1. starts the emulators;
2. seeds deterministic **legacy-shaped** fixtures;
3. builds and serves the app wired to the emulators;
4. runs a Playwright smoke suite.

Every later behaviour-preserving task uses this as its regression gate. Production bundles must contain no emulator code.

## Context
- `src/lib/firebase.ts` initialises `auth`, `db`, `storage` and `functions` (`europe-west3`) from `NEXT_PUBLIC_FIREBASE_*`. There are no emulator hooks today.
- `firebase.json` has `firestore.indexes`, `functions` and a stale `hosting` block (T12 removes it), and no `emulators` block. **No rules files exist.** The emulators then run:
  - Firestore: "allowing all reads and writes";
  - Storage: "Detected demo project ID … using a default (open) rules configuration".
  - (Both messages were verified with firebase-tools 15.31.0.)
- **`NEXT_PUBLIC_*` inlining pitfall (verified):** if `NEXT_PUBLIC_USE_EMULATORS` is *unset* at build time, Next/Turbopack does **not** inline it. `process.env.NEXT_PUBLIC_USE_EMULATORS === '1'` then stays in the client bundle together with the `127.0.0.1:9099` strings. Fix: `next.config.mjs` `env` always defines it (`'1'` or `'0'`). The comparison is then constant-folded, and the branch is dropped from production chunks. Verified: 0 hits for `127.0.0.1` in `.next/static` without the flag, 1 chunk with it.
- **CSP (verified):** the current CSP blocks the emulators:
  - `connect-src` lacks `http://127.0.0.1:*`;
  - `frame-src` lacks the Auth emulator. Without `frame-src http://127.0.0.1:9099`, the app never gets past auth init.

  Emulator hosts are appended **only** when the flag is `1`. T15 later rewrites the CSP and takes this over.
- **First-run overlays:**
  - `src/components/InstallGate.tsx:65` hides when `localStorage['spoton-install-prompt-dismissed'] === 'true'`.
  - `src/components/LanguageSelector.tsx` hides when the persisted zustand store `localStorage['spoton-language']` holds `{"state":{"language":"en","hasSelectedLanguage":true},"version":0}` (`src/store/useLanguageStore.ts`, `name: 'spoton-language'`).
  - Tests pre-seed both with `page.addInitScript`.
- **LoadingScreen** (`src/components/LoadingScreen.tsx`, `div.fixed.inset-0.bg-slate-900`) unmounts when `page.tsx` has `auth`, `spots` and `map` loaded.
- **Pre-existing bug that blocks E2E (verified; call it BUG-24):** `MapReadyNotifier` in `src/components/MapView.tsx:84-96` sets `notified.current = true` *before* its 100 ms timer. `page.tsx` passes a new `onMapLoad` function on every render. Any re-render within 100 ms therefore runs the cleanup, which clears the timer, and the effect never re-arms. `map` never becomes true, and the LoadingScreen stays forever. Local emulators answer fast enough to trigger this on every run (0/4 tests passed before the fix, 4/4 after). In production it is a timing-dependent "stuck on loading screen" bug. The minimal fix is in Step 6.
- **Markers:** Leaflet `divIcon`s (`.leaflet-marker-icon`) whose SVG contains the category emoji. Approved spots have `circle[fill="#10b981"]`; pending spots have `#eab308`, and non-admins never see them (`page.tsx` `visibleSpots`). There are no per-spot ids in the DOM, so fixtures use distinct categories: legacy = `viewpoint` 🏔️, modern = `park` 🌳, pending = `hiking` 🥾.
- **Spot details:** click a marker to open `SpotInfoWindow`, then the button "View Details" opens `SpotDetailsPanel`. The hero is a `next/image` with `alt={spot.name}`, `src = imageUrls[primaryImageIndex||0] || imageUrls[0] || spotImages[0].url` (`SpotDetailsPanel.tsx:306`). Reviews render `review.comment`. Opening a legacy spot calls `migrateSpotImages`, a write (BUG-18, fixed in T11b). This is expected under open emulator rules. Do not assert that the document is unchanged.
- **Email sign-in (English UI):** open `AuthModal` with the "Profile" nav button (`aria-label` from `t('profile')`), click "With Email", fill `input[type=email]` and `input[type=password]`, then click `form button[type=submit]`. After success, the "Profile" button opens `ProfilePanel` with `<h2>{user.username}</h2>`.
- **Browsers:** the sandbox exports `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and ships only `chromium-1194`, which is Playwright **1.56.1** (1.57 needs 1200; 1.63 needs 1243). So pin `@playwright/test@1.56.1`. CI installs the same revision with `npx playwright install --with-deps chromium`. If a version mismatch ever happens locally, set `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium` (the config supports it).
- **Server mode: `next build && next start` is chosen over `next dev`.** Reasons:
  - It is the production code path: `images.unoptimized` is true only when `NODE_ENV=production`, and `next dev` would route `/icon-*.png` through the optimizer with different behaviour.
  - No on-demand compilation, so there are no first-hit timeouts.
  - No StrictMode double effects.
  - It is deterministic in CI.

  The cost is about 30 s of build per run. The build goes to a separate `distDir` (`.next-e2e`), so it never overwrites a real `.next`. **Next rewrites `tsconfig.json` to include `.next-e2e/types/**/*.ts`**; commit those two entries up front so runs leave the tree clean.
- Verified end to end in the sandbox, on Node 22 and Java 21: `npm run test:e2e` gives 4 passed in about 2.5 minutes, of which about 30 s is tests. Harmless noise: `JAVA_TOOL_OPTIONS`, IPv6 `EAFNOSUPPORT` port warnings, `MetadataLookupWarning` from firebase-admin.
- Later specs rely on this layout:
  - fixture emails `user@spoton.test` and `admin@spoton.test` (T08 adds `super@spoton.test`);
  - `e2e/helpers.ts` (`skipFirstRunOverlays`, `openApp`, `signInWithEmail`, …);
  - `e2e/fixtures.ts`;
  - `scripts/seed-emulator.ts` run with `tsx`;
  - root `firebase-admin` and `tsx`;
  - pinned `firebase-tools`;
  - `connectFunctionsEmulator` already wired.
- **Fixture convention (binding for every later spec):** no spec may leave a fixture used by another spec mutated. All spec files share one seeded emulator per run, and Playwright runs them alphabetically with `workers: 1`. A spec that writes (renames a user, adds a review or photo, highlights, approves) uses a dedicated fixture that it adds to `e2e/fixtures.ts` and the seed.

## Files
- Create: `scripts/seed-emulator.ts`, `e2e/fixtures.ts`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify:
  - `firebase.json` (add `emulators` only);
  - `src/lib/firebase.ts` (emulator hooks);
  - `next.config.mjs` (`distDir`, `env`, emulator-only CSP hosts);
  - `src/components/MapView.tsx` (`MapReadyNotifier` fix only; justify as BUG-24 in the commit message);
  - `package.json` and `package-lock.json`;
  - `tsconfig.json` (`include` entries);
  - `eslint.config.mjs` (ignore);
  - `.gitignore`;
  - `.github/workflows/ci.yml` (add the `e2e` job, if T02 has landed).
- Delete: —

## Steps
1. **Dev dependencies** (exact pins):
   ```bash
   npm i -D --save-exact firebase-tools@15.31.0 @playwright/test@1.56.1 tsx@4.23.15 firebase-admin@14.5.0
   ```
2. **`package.json` script:**
   ```json
   "test:e2e": "firebase emulators:exec --only auth,firestore,storage --project demo-spoton \"tsx scripts/seed-emulator.ts && playwright test\""
   ```
   `emulators:exec` exports `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` and `GCLOUD_PROJECT` to the child command. **`npm run test:e2e -- <file>` does not work**: npm appends the argument to `emulators:exec`, not to `playwright test`. To run one spec, use:
   ```bash
   npx firebase emulators:exec --only auth,firestore,storage --project demo-spoton \
     "npx tsx scripts/seed-emulator.ts && npx playwright test e2e/smoke.spec.ts"
   ```
3. **`firebase.json`:** add this top-level key, and leave `firestore`, `functions` and `hosting` byte-identical:
   ```json
   "emulators": {
     "singleProjectMode": true,
     "auth": { "host": "127.0.0.1", "port": 9099 },
     "firestore": { "host": "127.0.0.1", "port": 8080 },
     "storage": { "host": "127.0.0.1", "port": 9199 },
     "functions": { "host": "127.0.0.1", "port": 5001 },
     "ui": { "enabled": false }
   }
   ```
4. **`src/lib/firebase.ts`:** add `connectAuthEmulator` to the `firebase/auth` import, `connectFirestoreEmulator` to `firebase/firestore`, `connectStorageEmulator` to `firebase/storage`, and `connectFunctionsEmulator` to `firebase/functions`. Directly after `const functions = getFunctions(app, 'europe-west3');` insert:
   ```ts
   // Emulators (tests only). next.config.mjs always inlines '1' or '0', so production
   // bundles constant-fold this branch away (see T04).
   if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
     connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
     connectFirestoreEmulator(db, '127.0.0.1', 8080);
     connectStorageEmulator(storage, '127.0.0.1', 9199);
     connectFunctionsEmulator(functions, '127.0.0.1', 5001);
   }
   ```
   It must run before any auth or Firestore request. The earlier `setPersistence` call makes no request, so this placement is fine (verified).
5. **`next.config.mjs`:**
   - Before `const nextConfig`, add:
     ```js
     const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
     // Test-only: local emulator endpoints, added to the CSP only in emulator builds.
     const emulatorConnectSrc = useEmulators
       ? ' http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199 http://127.0.0.1:5001'
       : '';
     const emulatorFrameSrc = useEmulators ? ' http://127.0.0.1:9099' : '';
     ```
   - Inside `nextConfig`, after `reactStrictMode: true,`:
     ```js
       // Separate output dir for emulator/E2E builds so they never overwrite a real .next build.
       distDir: process.env.NEXT_DIST_DIR || '.next',
       // Always inline a definite value so production bundles constant-fold the emulator branch away.
       env: {
         NEXT_PUBLIC_USE_EMULATORS: useEmulators ? '1' : '0',
       },
     ```
   - Append the emulator hosts to the two CSP entries by string concatenation, and leave every other character unchanged:
     - the `connect-src …` string ends `… https://server.arcgisonline.com" + emulatorConnectSrc,`;
     - the `frame-src …` string ends `… https://accounts.google.com" + emulatorFrameSrc,`.
6. **`src/components/MapView.tsx`, `MapReadyNotifier` only:** replace the effect with:
   ```tsx
     useEffect(() => {
       if (notified.current || !onMapLoad) return;
       const timer = setTimeout(() => {
         notified.current = true;
         onMapLoad();
       }, 100);
       return () => clearTimeout(timer);
     }, [onMapLoad]);
   ```
   The semantics are unchanged: `onMapLoad` is called once, about 100 ms after mount. Now it is called even if the parent re-renders during those 100 ms.
7. **`e2e/fixtures.ts`:**
   ```ts
   // Shared E2E fixture data: written by scripts/seed-emulator.ts, asserted by e2e/*.spec.ts.
   export const E2E = {
     password: 'e2e-password-123',
     user: { uid: 'e2e-user', email: 'user@spoton.test', username: 'e2e_user' },
     admin: { uid: 'e2e-admin', email: 'admin@spoton.test', username: 'e2e_admin' },
     legacySpot: {
       id: 'e2e-legacy-spot', name: 'E2E Legacy Spot', emoji: '🏔️',
       reviewComment: 'E2E legacy review comment',
     },
     modernSpot: { id: 'e2e-modern-spot', name: 'E2E Modern Spot', emoji: '🌳' },
     pendingSpot: { id: 'e2e-pending-spot', name: 'E2E Pending Spot', emoji: '🥾' },
   } as const;
   ```
8. **`scripts/seed-emulator.ts`** (ESM, run by `tsx`). Requirements:
   - refuse to run unless `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set;
   - refuse if `GCLOUD_PROJECT` is set to anything other than `demo-spoton`;
   - `initializeApp({ projectId: 'demo-spoton' })` from `firebase-admin/app`, with `getAuth` and `getFirestore`/`Timestamp` from the modular `firebase-admin/*` entry points;
   - one fixed timestamp `Timestamp.fromDate(new Date('2025-06-01T12:00:00Z'))`, called `t` below;
   - exit code 1 on error.

   Seed exactly:
   - Auth users `E2E.user` and `E2E.admin`, each with its `uid`, `email` and `E2E.password`.
   - `users/{uid}` for both: `{ uid, username, email, photoURL: '', profilePictureURL: '', profileBannerURL: '', savedSpots: [], createdAt: t, lastLoginAt: t }`. `username` must be set, or `UsernameSetupModal` opens.
   - `admins/e2e-admin`: `{ email: 'admin@spoton.test', username: 'e2e_admin', photoURL: '', addedAt: t, addedBy: 'seed' }`. This is the legacy shape, with **no** `role`.
   - `spots/e2e-legacy-spot` (LEGACY):
     - `{ name, category: 'viewpoint', description: 'Legacy-shaped fixture', location: { lat: 47.5009, lng: 19.0452 }, createdBy: 'e2e-user', createdByName: 'e2e_user', status: 'approved', createdAt: t, imageUrls: ['/icon-512x512.png'], reviews: [ … ] }`;
     - **no** `spotImages` and **no** `primaryImageIndex`;
     - `reviews` holds one entry: `{ id: 'e2e-legacy-review', userId: 'e2e-admin', userName: 'Legacy Reviewer', userEmail: 'admin@spoton.test', userPhoto: '', rating: 4, comment: E2E.legacySpot.reviewComment, createdAt: t, userSpotsCount: 3 }`.
   - `spots/e2e-modern-spot`:
     - `{ name, category: 'park', description: 'Current-shape fixture', location: { lat: 47.4949, lng: 19.0342 }, createdBy: 'e2e-user', createdByName: 'e2e_user', status: 'approved', createdAt: t, imageUrls: ['/icon-192x192.png'], primaryImageIndex: 0, spotImages: [ … ], reviews: [] }`;
     - `spotImages` holds one entry: `{ id: 'e2e-img-1', url: '/icon-192x192.png', addedBy: 'e2e-user', addedAt: t, likes: 0, likedBy: [] }`.
   - `spots/e2e-pending-spot`: `{ name, category: 'hiking', description: 'Pending fixture', location: { lat: 47.4990, lng: 19.0300 }, createdBy: 'e2e-user', createdByName: 'e2e_user', status: 'pending', createdAt: t, imageUrls: ['/placeholder-spot.jpg'], reviews: [] }`.

   Every spot needs `createdAt`, because the client query is `orderBy('createdAt','desc')`. Images are same-origin files from `public/`, so there is no network dependency. The coordinates are within about 1 km of the default map centre `[47.4979, 19.0402]`, and so are visible at zoom 13. Print `Seeded emulator project demo-spoton` at the end.
9. **`e2e/helpers.ts`:**
   ```ts
   import { expect, type Page } from '@playwright/test';

   /** Pre-seeds localStorage so InstallGate and LanguageSelector never render. Call before page.goto. */
   export async function skipFirstRunOverlays(page: Page, language: 'en' | 'hu' | 'de' = 'en') {
     await page.addInitScript((lang) => {
       window.localStorage.setItem('spoton-install-prompt-dismissed', 'true');
       window.localStorage.setItem(
         'spoton-language',
         JSON.stringify({ state: { language: lang, hasSelectedLanguage: true }, version: 0 }),
       );
     }, language);
   }

   /** Aborts map tile requests so tests never depend on third-party tile servers. */
   export async function blockMapTiles(page: Page) {
     await page.route(/(openstreetmap|cartocdn|arcgisonline)\./, (route) => route.abort());
   }

   /** Opens the app and waits until LoadingScreen has unmounted. */
   export async function openApp(page: Page) {
     await page.goto('/');
     await expect(page.locator('div.fixed.inset-0.bg-slate-900')).toHaveCount(0, { timeout: 30_000 });
   }

   /** Leaflet marker whose SVG shows the given category emoji. */
   export function spotMarker(page: Page, emoji: string) {
     return page.locator('.leaflet-marker-icon').filter({ hasText: emoji });
   }

   /** Signs in through the AuthModal email form (English UI). App must be open and signed out. */
   export async function signInWithEmail(page: Page, email: string, password: string) {
     await page.getByRole('button', { name: 'Profile' }).click();
     await page.getByRole('button', { name: 'With Email' }).click();
     await page.locator('input[type="email"]').fill(email);
     await page.locator('input[type="password"]').fill(password);
     await page.locator('form button[type="submit"]').click();
     await expect(page.locator('input[type="password"]')).toHaveCount(0);
   }
   ```
10. **`e2e/smoke.spec.ts`:** 4 tests. Every test starts with `skipFirstRunOverlays(page)` and `blockMapTiles(page)` in `beforeEach`.
    1. *app loads past overlays*: `openApp`. Then `getByText('Continue on web')` has count 0, `getByText('Select Language')` has count 0, and the `Profile` button is visible.
    2. *approved markers only*: `.leaflet-marker-icon circle[fill="#10b981"]` has count 2. The `spotMarker` counts are 1 for 🏔️, 1 for 🌳, and 0 for 🥾.
    3. *legacy spot details*:
       - click `spotMarker(🏔️)`, then the `View Details` button;
       - `getByRole('img', { name: 'E2E Legacy Spot' }).first()` is visible, and `expect.poll(img.complete && img.naturalWidth > 0)` is true;
       - `getByText('E2E legacy review comment')` is visible.
    4. *email sign-in*:
       - `openApp`, then `signInWithEmail(page, E2E.user.email, E2E.password)`;
       - click `Profile`;
       - `getByRole('heading', { name: 'e2e_user' })` is visible.
11. **`playwright.config.ts`:**
    ```ts
    import { defineConfig, devices } from '@playwright/test';

    const PORT = 3100;
    const BASE_URL = `http://127.0.0.1:${PORT}`;

    // Non-secret demo config; the emulators accept any API key for a demo-* project.
    // Playwright merges this over process.env, so extra vars (e.g. NEXT_PUBLIC_MOVED_TO for T19) pass through.
    const E2E_ENV = {
      NEXT_PUBLIC_USE_EMULATORS: '1',
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-spoton.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-spoton',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-spoton.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
      NEXT_PUBLIC_FIREBASE_VAPID_KEY: '',
      NEXT_PUBLIC_ADMIN_EMAIL: '',
    };

    export default defineConfig({
      testDir: './e2e',
      fullyParallel: false,
      workers: 1,
      retries: process.env.CI ? 1 : 0,
      forbidOnly: !!process.env.CI,
      timeout: 60_000,
      expect: { timeout: 15_000 },
      reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
      use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        locale: 'en-US',
        geolocation: { latitude: 47.4979, longitude: 19.0402 },
        permissions: ['geolocation'],
      },
      projects: [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
            // Fallback if the installed browser build does not match this Playwright version.
            launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
              ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
              : {},
          },
        },
      ],
      webServer: {
        command: `npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
        url: BASE_URL,
        env: E2E_ENV,
        timeout: 300_000,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    });
    ```
    `workers: 1` is required: all tests share one seeded emulator, and test 3 writes (see Context).
12. **Housekeeping:**
    - `.gitignore`: add `.next-e2e/`, `test-results/` and `playwright-report/` (`*.log` already covers the emulator logs).
    - `eslint.config.mjs`: add `'.next-e2e/**'` to `globalIgnores`.
    - `tsconfig.json`: append `".next-e2e/types/**/*.ts"` and `".next-e2e/dev/types/**/*.ts"` to `include`. Next adds exactly these on the first E2E build.
13. **CI** (if `.github/workflows/ci.yml` exists): replace the placeholder comment's T04 part with this job, and keep the T12 note:
    ```yaml
      e2e:
        name: E2E (Playwright vs emulators)
        runs-on: ubuntu-24.04
        timeout-minutes: 30
        steps:
          - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
            with:
              persist-credentials: false
          - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
            with:
              node-version-file: .nvmrc
              cache: npm
          - uses: actions/setup-java@de7274f081f381c8f8158605e0321c36c376e2e6 # v6.0.1
            with:
              distribution: temurin
              java-version: '21'
          - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
            with:
              path: ~/.cache/firebase/emulators
              key: firebase-emulators-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          - run: npm ci
          - run: npx playwright install --with-deps chromium
          - run: npm run test:e2e
          - if: failure()
            uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
            with:
              name: playwright-report
              path: |
                playwright-report/
                test-results/
              retention-days: 7
    ```
    If T02 has not landed yet, leave this block in the commit message for T02 to add.

## Must NOT change
- Production behaviour and bundles:
  - with `NEXT_PUBLIC_USE_EMULATORS` unset, `.next/static` contains no `127.0.0.1`;
  - the served CSP string is byte-identical to today's.
- `firebase.json` `firestore`, `functions` and `hosting` blocks. No rules files are added (T12 owns rules).
- `src/lib/firebase.ts` init order, persistence, region and exports, apart from the emulator block.
- `MapView.tsx` except the `MapReadyNotifier` effect.
- Real Firebase projects: never run the seed or tests without the emulator env. The seed script enforces this.

## Acceptance
```bash
node -v && java -version 2>&1 | head -1          # Node 22.x, Java 21
npm ci
npm run test:e2e                                  # 4 passed; exit 0
# Production build has no emulator code or CSP entries (export T01's demo NEXT_PUBLIC_FIREBASE_* first):
rm -rf .next && npx next build
grep -rl '127\.0\.0\.1' .next/static | wc -l      # 0
grep -c '127\.0\.0\.1' .next/routes-manifest.json # 0
grep -rl '127\.0\.0\.1:9099' .next-e2e/static | wc -l   # >= 1 (emulator build does contain it)
npm run verify                                    # still green (typecheck includes e2e/, scripts/, playwright.config.ts)
# Seed refuses to run without emulators:
env -u FIRESTORE_EMULATOR_HOST -u FIREBASE_AUTH_EMULATOR_HOST npx tsx scripts/seed-emulator.ts; echo "exit $?"   # non-zero, "refusing to seed"
```
Run `npm run test:e2e` twice in a row. Both runs must pass (every run starts with empty emulators), and after the second run, `git status --porcelain` must show no files beyond this task's own changes. In particular, `tsconfig.json` is not rewritten again.

## Rollback
`git revert` the commit. There is no production impact: emulator code is compiled out, and the CSP is unchanged when the flag is unset. Reverting also removes the BUG-24 fix. Note that in the rollback PR.

## Stop and ask Paul if…
- Any production-build grep above finds `127.0.0.1`.
- A test needs a different selector because the UI text or aria-labels differ from the Context. Do not change UI strings for tests.
- The Storage emulator refuses to start without a rules file (a firebase-tools change). Do not invent `storage.rules`: T12 owns rules (D2).
- The E2E suite still hangs on the LoadingScreen after the `MapReadyNotifier` fix.
- The fixture emails or roles conflict with T08's seed expectations (`super@spoton.test` is added by T08).
