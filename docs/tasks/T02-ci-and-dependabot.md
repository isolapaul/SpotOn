# T02 — CI workflow and Dependabot

**Phase:** 0 · **Depends on:** T01 · **Risk:** low · **Decisions:** D3, D14
**Audit refs:** SEC-07, SEC-21 (supply chain: SHA-pinned actions, least-privilege `permissions`, Dependabot)

## Goal
Every push and PR runs the T01 gates in GitHub Actions. An audit job reports vulnerable production dependencies: non-blocking now, blocking once T05–T07 land. Dependabot proposes weekly grouped updates for both npm projects and for the actions themselves. Later tasks add jobs to this same workflow: `e2e` (T04), `rules` (T12). T18 adds a separate release workflow.

## Context
- No `.github/` directory exists yet.
- T01 provides `npm run verify` (typecheck, lint, unit tests, `next build`) and `npm run verify:fn` (`npm --prefix functions run build && npm --prefix functions run lint`). It also provides `.nvmrc` = `22`.
- `next build` needs non-empty `NEXT_PUBLIC_FIREBASE_*` values (T01 Context). CI uses the **non-secret** demo values below, never real config.
- `verify:fn` **fails at the lint step until T07** (17 pre-existing errors under the legacy functions ESLint 8 config). The build step passes.
- `npm audit` on the current lockfiles:
  - root: CRITICAL (`next` 16.1.6, `protobufjs`, `websocket-driver`) and HIGH;
  - `functions/`: 3 CRITICAL and 9 HIGH.

  Verified end state:
  - after T05, root still has CRITICAL/HIGH items, all transitive under `firebase@10`;
  - after T06, root has only 1 moderate (`baseline-browser-mapping`);
  - after T07, `functions/` has only 2 moderate (`uuid` via `gaxios`).
- Action SHAs, resolved with `git ls-remote` on 2026-09-25. All are lightweight tags, so the tag SHA is the commit SHA:

  | Action | Tag | SHA |
  |---|---|---|
  | actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
  | actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
  | actions/setup-java (T04/T12) | v6.0.1 | `de7274f081f381c8f8158605e0321c36c376e2e6` |
  | actions/cache (T04) | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
  | actions/upload-artifact (T04) | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

  Re-resolve a SHA (or check a newer tag) with:
  ```bash
  git ls-remote --tags --refs https://github.com/actions/checkout | awk -F/ '{print $3}' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1
  git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1' 'refs/tags/v7.0.1^{}'
  ```
  If a `^{}` (peeled) line is printed, use **its** SHA (annotated tag). Otherwise use the tag's SHA.
- **ESLint 10 breaks `eslint-plugin-react`**, which `eslint-config-next` bundles (verified). `@types/node` must track the Node 22 runtime (D14). `react`/`react-dom` 19, `react-leaflet` 5 and `zustand` 5 belong to T31.

## Files
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`
- Modify: —
- Delete: —

## Steps
1. Create `.github/workflows/ci.yml` with exactly these jobs. Keep the comments; later tasks rely on them.
   ```yaml
   name: CI

   on:
     pull_request:
     push:
       branches: [main, 'claude/**']

   permissions:
     contents: read

   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: true

   env:
     # Non-secret demo values: `next build` prerenders `/` and Firebase Auth rejects an empty apiKey.
     NEXT_PUBLIC_FIREBASE_API_KEY: demo-api-key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: demo-spoton.firebaseapp.com
     NEXT_PUBLIC_FIREBASE_PROJECT_ID: demo-spoton
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: demo-spoton.appspot.com
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000'
     NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000'

   jobs:
     app:
       name: App verify (typecheck, lint, unit, build)
       runs-on: ubuntu-24.04
       timeout-minutes: 20
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             persist-credentials: false
         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with:
             node-version-file: .nvmrc
             cache: npm
         - run: npm ci
         - run: npm run verify

     functions:
       name: Functions build + lint
       runs-on: ubuntu-24.04
       timeout-minutes: 15
       # TEMPORARY: functions lint has pre-existing errors until T07 (ESLint 9 migration). T07 deletes this line.
       continue-on-error: true
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             persist-credentials: false
         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with:
             node-version-file: .nvmrc
             cache: npm
             cache-dependency-path: functions/package-lock.json
         - run: npm --prefix functions ci
         - run: npm run verify:fn

     audit:
       name: npm audit (production deps)
       runs-on: ubuntu-24.04
       timeout-minutes: 10
       # TEMPORARY: known CRITICAL advisories (SEC-07) until T05–T07 land.
       # Whichever of T06/T07 lands LAST deletes this line and raises both levels to `high`.
       continue-on-error: true
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             persist-credentials: false
         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with:
             node-version-file: .nvmrc
         - name: Root
           run: npm audit --omit=dev --audit-level=critical
         - name: Functions
           if: success() || failure()
           run: npm --prefix functions audit --omit=dev --audit-level=critical

     # T04 adds job `e2e` here. T12 adds job `rules` here.
   ```
   Notes:
   - `npm audit` reads the lockfile, so the audit job needs no `npm ci`.
   - Do not add `secrets`, `id-token` or write permissions. None are needed.
2. Create `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: npm
       directory: "/"
       schedule:
         interval: weekly
         day: monday
       open-pull-requests-limit: 10
       groups:
         root-minor-patch:
           update-types: [minor, patch]
       ignore:
         # Node 22 runtime (D14): types must stay on 22.x.
         - dependency-name: "@types/node"
           update-types: ["version-update:semver-major"]
         # ESLint 10 breaks eslint-plugin-react (bundled by eslint-config-next 16.3.x).
         - dependency-name: "eslint"
           update-types: ["version-update:semver-major"]
         # React 19 / react-leaflet 5 / zustand 5 are T31.
         - dependency-name: "react"
           update-types: ["version-update:semver-major"]
         - dependency-name: "react-dom"
           update-types: ["version-update:semver-major"]
         - dependency-name: "@types/react"
           update-types: ["version-update:semver-major"]
         - dependency-name: "@types/react-dom"
           update-types: ["version-update:semver-major"]
         - dependency-name: "react-leaflet"
           update-types: ["version-update:semver-major"]
         - dependency-name: "zustand"
           update-types: ["version-update:semver-major"]
     - package-ecosystem: npm
       directory: "/functions"
       schedule:
         interval: weekly
         day: monday
       open-pull-requests-limit: 10
       groups:
         functions-minor-patch:
           update-types: [minor, patch]
       ignore:
         - dependency-name: "eslint"
           update-types: ["version-update:semver-major"]
         - dependency-name: "@eslint/js"
           update-types: ["version-update:semver-major"]
     - package-ecosystem: github-actions
       directory: "/"
       schedule:
         interval: weekly
         day: monday
       groups:
         actions-minor-patch:
           update-types: [minor, patch]
   ```
   Later tasks keep these entries and add to them: T16 adds `docker`, T17 adds `docker-compose` (Q4). Dependabot updates both the SHA and the `# vX.Y.Z` comment of pinned actions.
3. Validate the YAML locally (step in Acceptance). Push the branch, and confirm in the Actions tab that:
   - `app` is green;
   - `functions` is red at the lint step but marked "continue-on-error";
   - `audit` is red but non-blocking;
   - the workflow run overall is green.

## Must NOT change
- Any source, config or package file. This task adds only the two files under `.github/`.
- No secrets or tokens in the workflow. `permissions` stays `contents: read`.

## Acceptance
```bash
python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ('.github/workflows/ci.yml','.github/dependabot.yml')]; print('yaml ok')"
# Every `uses:` is pinned by a 40-hex SHA with a version comment:
grep -nE 'uses: ' .github/workflows/ci.yml | grep -vE 'uses: [a-z0-9-]+/[a-z0-9-]+@[0-9a-f]{40} # v[0-9]+\.[0-9]+\.[0-9]+$' && echo "UNPINNED ACTION" || echo "all pinned"
grep -n 'permissions:' -A1 .github/workflows/ci.yml   # contents: read
# The SHAs still match their tags:
for p in checkout@v7.0.1 setup-node@v7.0.0; do git ls-remote https://github.com/actions/${p%@*} "refs/tags/${p#*@}"; done
# Same commands CI runs:
npm ci && npm run verify
npm --prefix functions ci && npm run verify:fn || echo "expected: functions lint fails until T07"
npm audit --omit=dev --audit-level=critical || echo "expected: non-zero until T05/T06"
```
Manual check (after push): the run on `claude/**` shows jobs `app`, `functions` and `audit`, and the run is green overall.

## Rollback
`git revert` the commit. Delete Dependabot PRs if any are open. No data or deploy impact.

## Stop and ask Paul if…
- Paul wants `functions` or `audit` to be required status checks now. They are intentionally non-blocking until T07/T06.
- A needed action has no semver tag, or the tag resolves to a different SHA than the table above. Re-resolve it, and ask if the release history looks suspicious.
- The repository's Actions settings forbid unpinned or third-party actions differently from this setup.
