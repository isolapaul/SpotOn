# T07 — Functions toolchain (Node 22, admin 14, functions 7, TS 5, ESLint 9)

**Phase:** 1 · **Depends on:** T02 (and T01 for `verify:fn`) · **Risk:** med · **Decisions:** D14
**Audit refs:** SEC-07 (functions: 3 CRITICAL / 9 HIGH transitive; `engines.node: "20"` EOL)

## Goal
Move `functions/` to supported and patched tooling:
- Node 22 runtime;
- `firebase-admin` 14.5.0, `firebase-functions` 7.4.0, TypeScript 5.9.3;
- ESLint 9 flat config that lints with 0 errors.

There are **no logic changes and no export renames**: the deployed functions keep their names, triggers, region and behaviour. The only source edit is the mechanical switch to the modular Admin SDK imports that admin 14 requires.

## Context
- `functions/package.json` today:
  - `engines.node "20"`;
  - dependencies `firebase-admin ^12.0.0`, `firebase-functions ^5.0.0`;
  - devDependencies `typescript ^4.9.0`, `eslint ^8.9.0`, `eslint-config-google`, `eslint-plugin-import`, `@typescript-eslint/*` v5;
  - `lint` = `ESLINT_USE_FLAT_CONFIG=false eslint --ext .js,.ts .` (set by T01 so ESLint 8 ignores the root flat config).
- `functions/.eslintrc.js` extends `google` + `@typescript-eslint/recommended`, with overrides for `quotes` (double), `indent` (2), `max-len` (100), and so on. It references a non-existent `tsconfig.dev.json`. `eslint-config-google` is unmaintained and has no flat config, so it is replaced by `@eslint/js` + `typescript-eslint` recommended + a few `@stylistic` rules (Google-like).
- `functions/tsconfig.json`: `module commonjs`, `target es2017`, `strict`, `noUnusedLocals`, `outDir lib`. It stays unchanged: TS 5.9 compiles it cleanly.
- `functions/src/index.ts` exports exactly `onSpotApproved` (:249), `onReviewAdded` (:348), `onSpotFavorited` (:395), `onNewPendingSpot` (:452) and `highlightSpot` (:486). Imports:
  - `import * as functions from "firebase-functions/v2"`;
  - `{setGlobalOptions} from "firebase-functions/v2"`;
  - `{onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https"`;
  - `import * as admin from "firebase-admin"`;
  - `import * as logger from "firebase-functions/logger"`.

  The triggers use `functions.firestore.onDocumentUpdated/onDocumentCreated`.
- **firebase-admin 14 removed the legacy namespaced API** (commit "Remove Deprecated Legacy Namespace Support"; also "Drop support for Node.js 18 and 20", engines `>=22`). Verified: `tsc` fails on `admin.firestore()`, `admin.messaging()`, `admin.firestore.FieldValue` and `admin.messaging.MulticastMessage`. Replace them with the modular entry points, which admin 12 already supported with identical semantics: the same default app, `FieldValue` class and `MulticastMessage` type. `messaging.sendEachForMulticast` (:171) still exists; admin 13 removed only the legacy `sendToDevice`/`sendAll`/`sendMulticast`, which are not used.
- **firebase-functions breaking changes:**
  - 6.0.0: the root `firebase-functions` entry point switched from v1 to v2; `functions.config()` was deprecated.
  - 7.0.0: Node 16 dropped (Node ≥ 18); `functions.config()` **removed**; TS v5 / ES2022 typings; ESM builds added; the emulator returns 500 immediately for unhandled async `onRequest` errors; v1 `Event` renamed to `LegacyEvent`.

  None of these affect this code: it imports explicit `firebase-functions/v2`, `firebase-functions/v2/https` and `firebase-functions/logger` subpaths, which exist in 7.4.0's `exports` (verified), and it uses neither `functions.config()` nor v1 nor `onRequest`.
- Verified in a scratch copy, with the steps below:
  - `npm run build` is clean;
  - `npm run lint`: 0 errors, 37 warnings (`no-explicit-any` 11, `comma-dangle` 21, `no-trailing-spaces` 5);
  - `npm audit --omit=dev`: only 2 moderate (`uuid` via `gaxios`);
  - loading `lib/index.js` lists exactly the 5 exports.
- ESLint 10 exists, but ESLint 9 matches the root (T01). Dependabot (T02) ignores ESLint majors.

## Files
- Create: `functions/eslint.config.mjs`
- Modify:
  - `functions/package.json`;
  - `functions/package-lock.json`;
  - `functions/src/index.ts` (import and namespace lines only);
  - `.github/workflows/ci.yml` (remove the TEMPORARY `continue-on-error` from job `functions`; the audit flip in step 8).
- Delete: `functions/.eslintrc.js`

## Steps
1. In `functions/`:
   ```bash
   cd functions
   npm uninstall @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-google eslint-plugin-import
   npm i --save-exact firebase-admin@14.5.0 firebase-functions@7.4.0
   npm i -D --save-exact typescript@5.9.3 eslint@9.39.5 @eslint/js@9.39.5 typescript-eslint@8.70.1 @stylistic/eslint-plugin@5.10.0 globals@16.4.0
   ```
2. `functions/package.json`:
   - `"engines": { "node": "22" }`;
   - `"lint": "eslint ."`, replacing T01's `ESLINT_USE_FLAT_CONFIG=false eslint --ext .js,.ts .`.

   Keep `main`, `build`, `serve`, `shell`, `start`, `deploy` and `logs` unchanged.
3. Delete `functions/.eslintrc.js`. Create `functions/eslint.config.mjs`:
   ```js
   // ESLint 9 flat config for Cloud Functions (replaces .eslintrc.js / eslint-config-google).
   import { defineConfig, globalIgnores } from 'eslint/config';
   import js from '@eslint/js';
   import tseslint from 'typescript-eslint';
   import stylistic from '@stylistic/eslint-plugin';
   import globals from 'globals';

   export default defineConfig([
     globalIgnores(['lib/**', 'generated/**']),
     js.configs.recommended,
     ...tseslint.configs.recommended,
     {
       files: ['**/*.ts', '**/*.js'],
       languageOptions: {
         ecmaVersion: 2022,
         sourceType: 'module',
         globals: { ...globals.node },
       },
       plugins: { '@stylistic': stylistic },
       rules: {
         // Google-like style kept from the old config.
         '@stylistic/quotes': ['error', 'double', { avoidEscape: true }],
         '@stylistic/indent': ['error', 2],
         '@stylistic/max-len': ['error', { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
         '@stylistic/object-curly-spacing': ['error', 'never'],
         '@stylistic/semi': ['error', 'always'],
         '@stylistic/eol-last': ['error', 'always'],
         // Pre-existing violations at T07 (11 / 21 / 5). Warn only; fix when touching the code (T08+).
         '@typescript-eslint/no-explicit-any': 'warn',
         '@stylistic/comma-dangle': ['warn', 'always-multiline'],
         '@stylistic/no-trailing-spaces': 'warn',
       },
     },
   ]);
   ```
4. `functions/src/index.ts`. Make exactly these edits and nothing else. `git diff` must show only these lines:
   - line 9: `import * as admin from "firebase-admin";` becomes the three lines
     ```ts
     import {initializeApp} from "firebase-admin/app";
     import {getFirestore, FieldValue} from "firebase-admin/firestore";
     import {getMessaging, MulticastMessage} from "firebase-admin/messaging";
     ```
   - line 15: `admin.initializeApp();` → `initializeApp();`
   - line 17: `admin.firestore()` → `getFirestore()`; line 18: `admin.messaging()` → `getMessaging()`
   - line 152: `admin.messaging.MulticastMessage` → `MulticastMessage`
   - lines 193, 581, 590: `admin.firestore.FieldValue.` → `FieldValue.`
5. Leave `functions/tsconfig.json` unchanged. Do not run `eslint --fix` (it would reformat code: out of scope).
6. `.github/workflows/ci.yml`, job `functions`: delete the `continue-on-error: true` line and its TEMPORARY comment.
7. Run the Acceptance.
8. **CI audit flip.** If T06 is already done (`docs/ROADMAP.md` §7), then in job `audit`:
   - delete `continue-on-error: true` and its TEMPORARY comment;
   - change both `--audit-level=critical` to `--audit-level=high`.

   Otherwise leave the job as is; T06 does the flip.

## Must NOT change
- Exported function names and count: `onSpotApproved`, `onReviewAdded`, `onSpotFavorited`, `onNewPendingSpot`, `highlightSpot`. A rename or drop deletes the deployed function.
- Trigger types and paths, `setGlobalOptions({region: "europe-west3"})`, callable behaviour and errors, notification texts, FCM payloads, token cleanup logic, Firestore reads and writes, and log lines. (Logic changes are T08–T10.)
- `functions/tsconfig.json`, `firebase.json` and the root `package.json`.

## Acceptance
```bash
npm --prefix functions ci
npm --prefix functions run build            # exit 0
npm --prefix functions run lint             # exit 0, "0 errors" (about 37 warnings)
npm run verify:fn                           # exit 0
node -p "const p=require('./functions/package.json');[p.engines.node,p.dependencies['firebase-admin'],p.dependencies['firebase-functions'],p.devDependencies.typescript,p.devDependencies.eslint].join(' ')"
#   -> 22 14.5.0 7.4.0 5.9.3 9.39.5
test ! -e functions/.eslintrc.js && echo "legacy config removed"
grep -cE "\badmin\." functions/src/index.ts  # 0
git diff --stat -- functions/src             # 1 file changed, 10 insertions(+), 8 deletions(-)
# Load check: the compiled module exposes exactly the 5 functions (GCLOUD_PROJECT keeps initializeApp deterministic)
GCLOUD_PROJECT=demo-spoton node -e "const m=require('./functions/lib/index.js');const got=Object.keys(m).sort().join(',');const want='highlightSpot,onNewPendingSpot,onReviewAdded,onSpotApproved,onSpotFavorited';if(got!==want){console.error('GOT',got);process.exit(1)}console.log('exports OK',got)"
npm --prefix functions audit --omit=dev --audit-level=high; echo "exit $?"   # exit 0 (only moderate uuid/gaxios)
npm run test:e2e                            # still green (client untouched)
```

## Rollback
`git revert` the commit, then `npm --prefix functions ci`. Nothing is deployed by this task. If Paul already deployed the Node 22 functions, redeploy the previous git tag (ROADMAP §4 rollback).

## Stop and ask Paul if…
- `tsc` reports errors beyond the admin-namespace lines listed in step 4. Do not change logic to satisfy types.
- The load check lists different exports.
- `npm run lint` has errors under this config that are not covered by the three downgraded rules. Do not add more downgrades or run `--fix` without approval.
- A newer `firebase-functions` 7.x or `firebase-admin` 14.x has a changelog entry marked breaking.
