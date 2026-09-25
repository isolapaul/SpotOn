# CLAUDE.md — SpotOn

Guide for any agent (human or AI) working in this repository. Read this fully before touching code.
The authoritative plan is `docs/ROADMAP.md`; individual work items are `docs/tasks/Txx-*.md`.
Audit findings live in `docs/audit/`.

---

## 1. What SpotOn is

A mobile-first PWA for discovering and sharing places ("spots") on a map.
Users sign in (Google or email), add spots with photos, review, favourite, and level up.
Admins approve pending spots. UI languages: Hungarian (default), English, German.

**Production today:** Vercel (`spot-on-rho.vercel.app`).
**Target:** hardened Docker container on Paul's home server at `https://spoton.isolapaul.hu`,
reached through a dashboard-managed Cloudflare Tunnel (`cloudflared` on the external docker network `edge`).
Firebase stays the backend (decision: *app container only*).

## 2. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router (`src/app`), TypeScript strict |
| UI | React 18, Tailwind CSS 3 (glassmorphism utilities in `src/app/globals.css`), lucide-react |
| Map | Leaflet + react-leaflet 4 (OpenStreetMap / Carto / Esri tiles) |
| State | Zustand 4 (`src/store/*`, several persisted to localStorage) |
| Backend (BaaS) | Firebase: Auth, Firestore, Storage, Cloud Messaging (web push) |
| Server code | Cloud Functions v2 in `functions/` (region `europe-west3`) |
| Next API routes | `/api/feedback` (nodemailer → SMTP), `/api/firebase-messaging-sw` (generated FCM service worker) |

## 3. Repository map

```
src/app/page.tsx                 Orchestrator: loads auth/spots/map, owns panel open/close state
src/app/layout.tsx               Metadata, viewport, <InstallGate/> overlay
src/app/api/feedback/route.ts    Feedback email endpoint (SMTP)
src/app/api/firebase-messaging-sw/route.ts  FCM service worker (generated from NEXT_PUBLIC_* config)
src/components/                  All UI (panels, modals, map). God components: ProfilePanel, SpotDetailsPanel
src/store/useSpotStore.ts        Spots listener + all spot mutations; admin state lives in useUserStore (isAdmin / isSuperAdmin, from admins/{uid})
src/store/useUserStore.ts        Auth flows, user doc, admins, username, profile images, highlights
src/store/use*Store.ts           language (t()), map theme, notifications, toast (forwards to notifications), ui
src/hooks/usePushNotifications.ts FCM permission/token handling
src/lib/firebase.ts              Firebase client init (auth, db, storage, functions)
src/lib/translations.ts          hu/en/de dictionaries (TranslationKey type)
src/lib/levelUtils.ts            Level thresholds 3/10/15/20 spots, perks
src/lib/spotUtils.ts             Category emoji/i18n maps, navigation URLs
functions/src/index.ts           Firestore triggers (notifications) + `highlightSpot` callable
firestore.indexes.json           Composite indexes
firebase.json                    Functions config (+ stale static-hosting block, see audit)
docs/                            Audits, roadmap, task specs, deploy/rollout runbooks
```

### Firestore data model (current)
- `spots/{id}`: name, category, description, location{lat,lng}, createdBy, createdByName, createdByPhoto,
  status ('pending'|'approved'), createdAt, imageUrls[], spotImages[{id,url,addedBy,addedAt,likes,likedBy[]}],
  primaryImageIndex, **reviews[] embedded array**, highlighted[], isHighlighted.
  Legacy spots may have only `imageUrls` (no `spotImages`), a singular legacy `imageUrl` field, and reviews that contain `userEmail`/`userSpotsCount` — **all code must keep reading legacy shapes.**
- `users/{uid}`: profile, savedSpots[], highlightedSpots[], customNameColor/Font, fcmTokens[], language,
  notificationsEnabled, notificationSettings, questProgress/questRewards (legacy Valentine event).
- `admins/{uid}`: email, username, photoURL, addedAt, addedBy.
- `categories/{id}`: name, icon (admin-managed; half-finished feature).
- Storage: `spot-images/…`, `profile-pictures/{uid}/…`, `profile-banners/{uid}/…`.

Planned additions (see tasks T08–T12): `publicProfiles/{uid}`, `usernames/{name}`, `admins/{uid}.role`,
`users/{uid}.spotsCount`, Storage path `spot-images/{uid}/…`.

## 4. Commands

```bash
npm ci                      # install (root)
npm run dev                 # dev server :3000
npm run build && npm start  # production build / serve
npx tsc --noEmit            # typecheck
npm --prefix functions ci && npm --prefix functions run build   # Cloud Functions build
```
After T01/T04 land, also (these are the gates every task must pass):
```bash
npm run verify              # typecheck + lint + unit tests + next build
npm run verify:fn           # functions build + lint (+ unit tests)
npm run test:rules          # Firestore/Storage rules tests on the emulator (Java 21 required)
npm run test:e2e            # Playwright smoke vs emulator-seeded build (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
```
`next build` needs Firebase config. Without a `.env.local`, export the non-secret demo values first (T01 defines the exact list), e.g.
`export NEXT_PUBLIC_FIREBASE_API_KEY=demo-key NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton …`.
A single e2e spec runs via `npx firebase emulators:exec --only auth,firestore,storage[,functions] --project demo-spoton "npx tsx scripts/seed-emulator.ts && npx playwright test e2e/<file>"` — from T08 on, include `functions` and run `npm --prefix functions run build` first (`npm run test:e2e -- <file>` does not work).
E2E specs must never leave a fixture that another spec uses in a mutated state.
In the Claude Code sandbox, the functions emulator cannot register Firestore triggers (the CLI sends localhost calls through the proxy despite `NO_PROXY`; the proxy must not be unset). Trigger-dependent tests are verified in CI instead.

### Environment variables
| Var | When | Where used |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, VAPID_KEY) | **build time** (inlined in bundle) | `lib/firebase.ts`, SW route, push hook |
| `NEXT_PUBLIC_USE_EMULATORS` | build time, tests only (T04) | `lib/firebase.ts` |
| `NEXT_PUBLIC_MOVED_TO` | build time, Vercel only (T19) | domain-move banner |
| `SMTP_HOST/PORT/USER/PASS`, `FEEDBACK_RECIPIENT` | runtime (container `.env`) | `/api/feedback` |

Never commit `.env*` files — sole exception: `functions/.env.demo-spoton` (emulator-only, non-secret params such as `APP_URL`, whitelisted in `.gitignore`). Never hardcode personal emails, keys or tokens.

## 5. Hard rules for agents

1. **If you are not 100% sure, STOP and ask.** Do not invent new features, collections, APIs, or UX that the task spec does not describe. Report the ambiguity to the orchestrator/Paul instead.
2. **One task = one spec = one (or a few small) commit(s).** Stay inside the task's file list; if you must touch another file, justify it in the commit message.
3. **"Must NOT change" lists in task specs are binding.** Behaviour-preserving tasks must produce identical UI/data behaviour.
4. **Never touch production Firebase** (no `firebase deploy`, no scripts against real projects, no real credentials). Use the emulator (`demo-spoton` project id). Deploys are Paul's manual steps, documented in `docs/security-rollout.md` / `docs/deploy.md`.
5. **Backward compatibility with existing data is mandatory.** Legacy spot shapes (only `imageUrls`, reviews with `userEmail`, missing optional fields) must keep rendering.
6. **Never rename or drop an exported Cloud Function** unless the task says so — a rename deletes the deployed function.
7. **Gates before every commit:** the acceptance commands of the task, plus `npm run verify` (and `verify:fn` if `functions/` changed — `verify:fn` is expected red from T01 until T07 fixes the pre-existing functions lint errors). Do not commit red.
8. **No secrets in git, images, logs, or client bundles.** Only `NEXT_PUBLIC_*` values may reach the browser, and those must be non-secret.
9. **Security posture:** authorization must be enforced server-side (Firestore/Storage rules or Cloud Functions), never only in UI. UI checks are UX, not security.
10. **Dependencies:** pin exact versions for `next` and security-relevant packages; justify every new dependency in the commit message; prefer none.
11. Commit messages: imperative subject `Txx: <summary>`, body explains *why* and lists any intentional behaviour change.

## 6. Code conventions (target state — apply to code you touch)

- **Layers:** `components/` render only → `hooks/` compose data + UI state → `store/` app state + Firebase side effects → `lib/` pure functions (unit-tested, no React, no Firebase).
- Components do **not** import `firebase/*` directly; go through a store action or a hook.
- No new file over ~300 lines; extract sub-components/hooks instead.
- One way to translate: `useT()` (after T24; until then `useLanguageStore().t`). No hardcoded user-visible strings — add keys to all three languages in `lib/translations.ts`.
- Shared primitives (after T25): `PanelShell`, `ModalShell`, `useSwipeToClose`, `StarRating`. Don't hand-roll new overlays.
- Constants (limits, thresholds, categories, z-index) live in `lib/` — no magic numbers in JSX.
- Tailwind classes must be static strings (JIT cannot see `replace()`-built class names).
- Types: shared domain types live next to their store (`Spot`, `Review`, `SpotImage` in `useSpotStore.ts`) until a `src/domain/` module is introduced; no `any` in new code.
- No `innerHTML`/`dangerouslySetInnerHTML`.

## 7. Deployment target (summary — full runbook: `docs/deploy.md`)

- Image: `ghcr.io/isolapaul/spoton` (private), built by `.github/workflows/release.yml` on `v*` tags; Trivy-gated, SBOM, cosign-signed.
- Runtime: distroless Node 22 nonroot, `output: 'standalone'`, read-only rootfs, `cap_drop: ALL`, no published ports, only on network `edge`.
- Server dir: `/srv/docker/spoton/` (`docker-compose.yml`, `.env` chmod 600). Pinned by digest; **not** Watchtower-managed.
- Cloudflare Tunnel public hostname `spoton.isolapaul.hu` → `http://spoton:3000`.
