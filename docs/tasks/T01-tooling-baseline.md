# T01 — Tooling baseline (ESLint 9, Vitest, verify scripts)

**Phase:** 0 · **Depends on:** — · **Risk:** low · **Decisions:** D14
**Audit refs:** code-review §6 pillar 1 ("Safety net first"); code-review header ("no tests, no lint config, no CI")

## Goal
Give every later task the same local gates: `npm run typecheck`, `npm run lint`, `npm run test`, and the combined `npm run verify` / `npm run verify:fn`. After this task, lint runs on ESLint 9 flat config with **0 errors**, Vitest runs one smoke test, and the Node version is pinned to 22. No application code changes.

## Context
- `package.json` scripts today: `dev`, `build` (`next build`), `start`, `lint` (`next lint`), `functions:build`, `functions:deploy`, `functions:logs`. **`next lint` was removed in Next 16**, so `npm run lint` is broken. There is no ESLint config, no test runner, and no `engines` field. `package.json` has `"type": "module"`.
- Installed: `next` 16.1.6 (range `^16.1.6`), `@types/node` `^20.12.7`, `typescript` `^5.4.5`.
- `eslint-config-next@16.3.6` exports flat configs: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` (arrays). Peer: `eslint >=9`. It bundles `eslint-plugin-react-hooks@7`, whose recommended set includes React-Compiler rules.
- **Verified baseline** (flat config below, before downgrades): 62 errors, 12 warnings: `@typescript-eslint/no-explicit-any` 51 E, `react-hooks/set-state-in-effect` 10 E, `react-hooks/purity` 1 E (`NotificationCenter.tsx:21`), `@typescript-eslint/no-unused-vars` 10 W, `@next/next/no-img-element` 2 W. **`react-hooks/rules-of-hooks`: 0 violations.** With the three downgrades below: 0 errors, 74 warnings.
- **ESLint 10 is not usable:** `eslint-plugin-react` (bundled by `eslint-config-next@16.3.6`) crashes under ESLint 10 (`getReactVersionFromContext`). Use `eslint@9.39.5`; npm prints a "no longer supported" deprecation notice for it. That notice is expected.
- `vitest@5.0.2` needs Node `^22.12` and has an optional peer `@types/node ^22 || >=24`. npm rejects the install while `@types/node` is 20, so `@types/node` must move to 22 in this same install.
- **`next build` needs Firebase public config.** Without `NEXT_PUBLIC_FIREBASE_API_KEY`, prerendering `/` fails with `auth/invalid-api-key` (`src/lib/firebase.ts` calls `getAuth` at module load). Non-secret demo values work (verified).
- `functions/` has its own ESLint 8.57 (`functions/.eslintrc.js`). **ESLint 8.57 walks up and finds the new root `eslint.config.mjs`, then fails with `Invalid option '--ext'`**. So `functions/package.json` `lint` must force legacy mode until T07 replaces it. Even then, functions lint has **17 pre-existing errors** (formatting and style: `object-curly-spacing`, `no-trailing-spaces`, etc.). `verify:fn` is therefore expected to fail at the lint step until T07. The build step passes.

## Files
- Create: `eslint.config.mjs`, `vitest.config.ts`, `tests/unit/smoke.test.ts`, `.nvmrc`
- Modify: `package.json`, `package-lock.json`, `functions/package.json` (the `lint` script only. Justification: the root flat config breaks ESLint 8 in `functions/`.)
- Delete: —

## Steps
1. Install dev tooling in **one** command, so the peer dependencies resolve together. Separate commands fail with ERESOLVE, because Vitest rejects `@types/node` 20:
   ```bash
   npm i -D --save-exact eslint@9.39.5 eslint-config-next@16.3.6 vitest@5.0.2 @types/node@22.20.4
   npm pkg set 'devDependencies.@types/node=^22.20.4' && npm i
   ```
   End state in `devDependencies`: `"eslint": "9.39.5"`, `"eslint-config-next": "16.3.6"`, `"vitest": "5.0.2"`, `"@types/node": "^22.20.4"`. Do not touch `next`: T05 pins it.
2. Create `eslint.config.mjs` with exactly this content:
   ```js
   import { defineConfig, globalIgnores } from 'eslint/config';
   import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
   import nextTypescript from 'eslint-config-next/typescript';

   export default defineConfig([
     ...nextCoreWebVitals,
     ...nextTypescript,
     globalIgnores([
       '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'functions/**',
       'coverage/**', 'playwright-report/**', 'test-results/**',
        'postcss.config.cjs', // CommonJS config; not covered by the Next/react-hooks plugin globs
     ]),
     {
       files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
       rules: {
         'react-hooks/rules-of-hooks': 'error',
         // Pre-existing violations at T01 (baseline 51 / 10 / 1). Warn only; fix while touching code.
         '@typescript-eslint/no-explicit-any': 'warn',
         'react-hooks/set-state-in-effect': 'warn',
         'react-hooks/purity': 'warn',
       },
     },
   ]);
   ```
   The `files` key is required. Without it ESLint throws "could not find plugin react-hooks". `functions/**` is ignored because it has its own config.
3. Create `vitest.config.ts`:
   ```ts
   import { fileURLToPath } from 'node:url';
   import { configDefaults, defineConfig } from 'vitest/config';

   export default defineConfig({
     resolve: {
       alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
     },
     test: {
       environment: 'node',
       include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
       exclude: [...configDefaults.exclude, 'e2e/**', 'functions/**', 'tests/rules/**', '.next/**', '.next-e2e/**'],
     },
   });
   ```
   Later tasks put unit tests next to the code (`src/lib/*.test.ts`) or in `scripts/*.test.ts`. `e2e/` is Playwright (T04). `tests/rules/` is the emulator rules suite (T12).
4. Create `tests/unit/smoke.test.ts`. It proves that Vitest and the `@/` alias work:
   ```ts
   import { describe, expect, it } from 'vitest';
   import { LEVEL_THRESHOLDS } from '@/lib/levelUtils';

   describe('tooling smoke', () => {
     it('runs vitest and resolves the @/ alias', () => {
       expect(Array.isArray(LEVEL_THRESHOLDS)).toBe(true);
     });
   });
   ```
5. Create `.nvmrc` containing the single line `22`.
6. Edit `package.json`:
   - Add `"engines": { "node": ">=22" }`.
   - Scripts. Replace `lint` and add the new ones. Keep `dev`, `build` (`next build`, **not** composite), `start` and the three `functions:*` scripts unchanged:
     ```json
     "typecheck": "tsc --noEmit",
     "lint": "eslint .",
     "test": "vitest run",
     "verify": "npm run typecheck && npm run lint && npm run test && npm run build",
     "verify:fn": "npm --prefix functions run build && npm --prefix functions run lint"
     ```
7. Edit `functions/package.json`, the `lint` script only: `"lint": "ESLINT_USE_FLAT_CONFIG=false eslint --ext .js,.ts ."`. T07 replaces it.
8. Run the acceptance commands. **Do not fix any lint warning**, and do not touch `src/`.

## Must NOT change
- Anything under `src/`, `public/`, `functions/src/`, `next.config.mjs`, `firebase.json`, and `tsconfig.json`.
- The `build`, `dev` and `start` scripts, and the `next`, `react` and `firebase` versions.
- App behaviour. No runtime dependency changes (only devDependencies).

## Acceptance
Without a local `.env.local` that has real config, export the non-secret demo values first. `next build` needs a non-empty API key:
```bash
export NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-spoton.firebaseapp.com \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-spoton.appspot.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000 NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
npm ci
npm run typecheck                       # exit 0
npm run lint                            # exit 0; "0 errors" (about 74 warnings is expected)
npx eslint . --rule '{"react-hooks/rules-of-hooks":"error"}' --quiet   # exit 0
npm run test                            # 1 file, 1 test passed
npm run verify                          # exit 0
npm --prefix functions ci && npm --prefix functions run build          # exit 0
npm --prefix functions run lint         # runs with the legacy config (no "Invalid option '--ext'"); reports the 17 pre-existing errors (expected until T07)
cat .nvmrc                              # 22
node -p "require('./package.json').engines.node"   # >=22
git diff --stat -- src/ | wc -l         # 0
```

## Rollback
`git revert` the commit. Nothing touches data or deploys.

## Stop and ask Paul if…
- `npm run lint` shows errors from a rule other than the three downgraded ones. Do not add more downgrades without asking.
- `npm run verify` fails for a reason other than a missing `NEXT_PUBLIC_FIREBASE_*` env.
- Installing requires `--force` or `--legacy-peer-deps`.
