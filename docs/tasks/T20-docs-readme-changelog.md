# T20 — README, CHANGELOG, env matrix

**Phase:** 3 · **Depends on:** T17, T18 (and every task already merged, because the changelog lists them) · **Risk:** low · **Decisions:** D1, D3, D5, D16
**Audit refs:** code-review §3 (stale docs: `FIREBASE_FUNCTIONS_SETUP.md`, CHANGELOG), SEC-18

## Goal
The docs describe the system as it is now:
- the new address;
- a container on Paul's server behind Cloudflare, with Firebase as the backend;
- local development against emulators;
- which variables are build-time and which are runtime;
- where to find the deploy runbook, security docs and agent rules.

Users get a short patch note about the new address.

## Context
- `README.md` (222 lines):
  - :3 and :222 link `https://spot-on-rho.vercel.app/`.
  - :73 says "Deployment: Vercel".
  - :81 has a placeholder clone URL (`yourusername`).
  - :90-110 has an env block that still contains `NEXT_PUBLIC_ADMIN_EMAIL` (removed by T11a) and no `FEEDBACK_RECIPIENT`.
  - :202-208 "Security Considerations" says admin rights are email-based and "HTTPS enforced … via Vercel".
  - The feature, design-system and PWA sections are still accurate and may be kept, shortened.
- `CHANGELOG.md` has only `v1.0.0`. It mentions Google Maps, which was historically correct at v1.0.0; leave it. `package.json` `version` is `1.1.0`. The last feature commit is `7c5c1ab` "Version 2.0 - Switch Google Maps to OpenStreetMap/Leaflet, remove Valentine quest, refactor core stores and components". `dbed341` is "Version 1.1.0 - Add satellite view…".
- `functions/README.md` is in Hungarian, lists 4 triggers from before T08, and :60 points to the missing `FIREBASE_FUNCTIONS_SETUP.md`.
- `public/patch-notes.md` is shown verbatim (`whitespace-pre-wrap`, not rendered as Markdown) in FeedbackPanel's "Patch Notes" box (`FeedbackPanel.tsx:169-176`). Its style is English, one line per version:
  ```
  ## Patch Notes

  - v1.0.0 — Initial public release.
  - v1.1.0 — Added satellite view and small UI improvements.
  ```
- `CLAUDE.md:15` still says "Production today: Vercel".
- Sources of truth to copy from, never re-invent:
  - `CLAUDE.md` §2–4 and §7;
  - `docs/deploy.md` (T17, T19);
  - `docs/security-rollout.md` (T13);
  - `package.json` scripts (T01, T04);
  - `functions/src/index.ts` exports (T08–T10);
  - `.github/workflows/*` (T02, T18).

## Files
- Modify:
  - `README.md` (rewrite)
  - `CHANGELOG.md` (prepend entries)
  - `functions/README.md` (rewrite in English)
  - `public/patch-notes.md` (one line)
  - `package.json` (`version` → `2.1.0` only)
  - `CLAUDE.md` (the §1 "Production today" line only)

## Steps
1. **`README.md` rewrite.** Sections, in order:
   1. **Title and one-paragraph overview**, with `**Live:** https://spoton.isolapaul.hu`. No Vercel link.
   2. **Features**: condense the current list to about 12 bullets and keep them accurate. Admins are role-based (`admins/{uid}`, super admin via `role: 'super'`), not email-based.
   3. **Architecture**: a Mermaid diagram plus 4–6 lines of text:
      ```mermaid
      flowchart LR
        U[Browser / PWA] -->|HTTPS| CF[Cloudflare edge]
        CF -->|Tunnel| CD[cloudflared<br/>docker network: edge]
        CD -->|HTTP :3000| APP[spoton container<br/>Next.js standalone, distroless]
        APP -->|/__/auth proxy| FA[&lt;project&gt;.firebaseapp.com]
        APP -->|SMTP, /api/feedback| MAIL[SMTP provider]
        U -->|Firebase JS SDK| FB[(Auth · Firestore · Storage · FCM)]
        U -->|callables| FN[Cloud Functions v2<br/>europe-west3]
        FB -->|triggers| FN
        FN -->|push| U
        U -->|map tiles| T[OSM · CARTO · Esri]
      ```
      Say explicitly: authorization is enforced by Firestore/Storage rules and Cloud Functions, never by the UI.
   4. **Local development:**
      - prerequisites: Node 22, Java 21 for the emulators;
      - `npm ci`;
      - `.env.local` from the matrix below;
      - `npm run dev`;
      - emulator workflow: copy the **exact** commands and scripts T04 added (the emulator start command and seed script names). Include `NEXT_PUBLIC_USE_EMULATORS=true` and the `demo-spoton` project id. Link `CLAUDE.md` §4.
   5. **Scripts**: a table of every `package.json` script with a one-line purpose, generated from the actual file (`npm run` output). Also `npm --prefix functions run …`.
   6. **Environment variables**: a matrix with exactly these columns and rows:

      | Variable | Phase | Secret? | Set where (dev / container / Vercel) | Used by |
      |---|---|---|---|---|
      | `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID`, `…_VAPID_KEY` | build | no (public config) | `.env.local` / GitHub repo **variables** → Docker build args / Vercel env | `lib/firebase.ts`, SW route, push hook, `next.config.mjs` |
      | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (note) | build | no | container: `spoton.isolapaul.hu` (D6); Vercel: `<project>.firebaseapp.com`; dev: `localhost` or firebaseapp | Auth |
      | `NEXT_PUBLIC_USE_EMULATORS` | build | no | tests/dev only; rejected by the container build | `lib/firebase.ts`, CSP |
      | `NEXT_PUBLIC_MOVED_TO` | build | no | Vercel only (T19); rejected by the container build | `MovedBanner` |
      | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | runtime | `SMTP_PASS` yes | `.env.local` / `/srv/docker/spoton/.env` (chmod 600) / Vercel env | `/api/feedback` |
      | `FEEDBACK_RECIPIENT` | runtime | no (personal) | same as SMTP; required, else 503 | `/api/feedback` |
      | `APP_URL` (functions param) | functions deploy | no | Firebase functions params | notification links |

      Add a note: changing any build-phase variable needs a new image or tag (ROADMAP trap 5). Only list variables that exist in the code at the time: `grep -rhoE "process\.env\.[A-Z_]+" src functions/src next.config.mjs | sort -u` must equal the rows (plus `NODE_ENV`).
   7. **Deployment**: 5 lines. Tag `vX.Y.Z` → `release.yml` (Trivy, SBOM, cosign) → private GHCR → `docs/deploy.md` (verify, pull, up). Link Vercel "Leaving Vercel" in `docs/deploy.md`.
   8. **Security**: link `docs/audit/security-review.md` and `docs/security-rollout.md`, plus one paragraph on the posture: rules and functions are the boundary; CSP; the hardened container; signed images. Report vulnerabilities privately to Paul via GitHub (no personal email in the README).
   9. **Contributing / agents**: "Read `CLAUDE.md` first"; `docs/ROADMAP.md`; `docs/tasks/`; the gates `npm run verify`, `verify:fn`, `test:rules`, `test:e2e`.
   10. **PWA installation** (keep the current text) and **License** (MIT). Keep "Created by Isola Paul Luka" without a live link to Vercel.
2. **`CHANGELOG.md`.** Prepend the entries below, keeping the style of the existing v1.0.0 entry (`### Features` / `### Security` …):
   - `## v2.1.0 — <release date>`. Build it from the merged task commits (`git log --oneline eee5668..HEAD | grep -E '^[0-9a-f]+ T[0-9]+'`), grouped under **Security**, **Infrastructure**, **Fixes** and **Changed**. One line per task, in user and maintainer terms. Must-have lines, if their task is merged:
     - the new address and the Vercel retirement (T19);
     - the container, signed images and CSP (T15–T18);
     - rules in the repo (T12);
     - review emails no longer public (T11b/T13);
     - the feedback API limits (T14).
     - Omit tasks that are not merged, and do not invent changes.
   - `## v2.0.0` (one short block from commit `7c5c1ab`): switched Google Maps to OpenStreetMap/Leaflet, removed the Valentine quest, refactored the core stores and components.
   - `## v1.1.0` (one line from `dbed341`): satellite view and small UI improvements.
3. **`functions/README.md`.** Rewrite it in English:
   - purpose;
   - runtime (Node 22, region `europe-west3`, Firebase Functions v2);
   - a table of **every exported function**, taken from `functions/src/index.ts` exports at the time: name | trigger type (Firestore trigger / callable) | what it does | who can call it;
   - params (`APP_URL`);
   - commands: `npm ci`, `npm run build`, `npm run lint`, tests, emulator;
   - deploy (`firebase deploy --only functions`, Paul only; see `docs/security-rollout.md`);
   - the warning "never rename or drop an exported function; renaming deletes it on deploy".
   - Remove the `FIREBASE_FUNCTIONS_SETUP.md` reference, and do not create that file.
4. **`public/patch-notes.md`.** Append exactly one line, keeping the header and the existing lines:
   ```
   - v2.1.0 — SpotOn has moved to spoton.isolapaul.hu. Sign in once more there, and re-add it to your home screen if you had installed it.
   ```
5. **`package.json`.** Set `"version": "2.1.0"`, with no other change. `package-lock.json` gets the same version field via `npm install --package-lock-only`.
6. **`CLAUDE.md:15`.** Replace it with `**Production:** https://spoton.isolapaul.hu (container, see docs/deploy.md). Vercel (`spot-on-rho.vercel.app`) only shows the move notice / redirects (T19) until it is deleted.`

## Must NOT change
- Any code, config or workflow. This is docs only, plus the `version` field.
- The historical CHANGELOG `v1.0.0` entry.
- The existing patch-notes lines and their `—` separator style.
- No personal email address, token or real Firebase config value in any doc.

## Acceptance
```bash
npm run verify
grep -rn "vercel.app" README.md functions/README.md && exit 1 || true
grep -rn "FIREBASE_FUNCTIONS_SETUP" README.md functions/README.md && exit 1 || true
grep -rn "NEXT_PUBLIC_ADMIN_EMAIL\|yourusername\|@gmail.com" README.md functions/README.md && exit 1 || true
grep -q "https://spoton.isolapaul.hu" README.md
grep -q '```mermaid' README.md
grep -q "docs/deploy.md" README.md && grep -q "CLAUDE.md" README.md && grep -q "security-review.md" README.md
grep -qE "^## v2\.1\.0" CHANGELOG.md && grep -q "v1.0.0" CHANGELOG.md
tail -n1 public/patch-notes.md | grep -q "^- v2.1.0 — SpotOn has moved to spoton.isolapaul.hu"
node -e "if(require('./package.json').version!=='2.1.0')process.exit(1)"
# every process.env var used in code appears in the README matrix
for v in $(grep -rhoE "process\.env\.[A-Z_]+" src next.config.mjs | sed 's/process.env.//' | sort -u | grep -v '^NODE_ENV$'); do
  grep -q "$v\|${v#NEXT_PUBLIC_FIREBASE_}" README.md || { echo "missing in README: $v"; exit 1; }; done
# functions table lists every export
for f in $(grep -oE "^export const [A-Za-z0-9_]+" functions/src/*.ts | awk '{print $3}'); do grep -q "\`$f\`" functions/README.md || { echo "missing: $f"; exit 1; }; done
```
Manual:
- Check that the Mermaid block renders in the GitHub preview.
- Check that the patch note displays correctly in the FeedbackPanel (plain text).

## Rollback
`git revert`. Docs only.

## Stop and ask Paul if…
- A task listed in the must-have changelog lines is not merged, but the release is being cut anyway. Ask whether to ship v2.1.0 without it or to wait.
- He wants the patch notes in Hungarian or trilingual. Today's file is English only, and the panel shows one file for all languages.
- He wants a public security contact (e.g. `SECURITY.md`). This spec deliberately adds no email address.
