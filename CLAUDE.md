# CLAUDE.md — SpotOn

Guide for anyone (human or AI agent) who changes this repository. Read it fully before touching code.
Open work is in `docs/BACKLOG.md`; releases and server operations are in `docs/deploy.md`; user-facing changes go in `CHANGELOG.md`.

---

## 1. What SpotOn is

A mobile-first PWA for discovering and sharing places ("spots") on a map.
Users sign in (Google or email), add spots with photos, review, favourite, and level up.
Admins approve pending spots. UI languages: Hungarian (default), English, German. A Google Play release is planned.

**Production:** https://spoton.isolapaul.hu, a hardened Docker container on Paul's home server, reached through a dashboard-managed Cloudflare Tunnel (`cloudflared` on the external docker network `edge`).
Firebase is the backend. The old Vercel address (`spot-on-rho.vercel.app`) only shows the move notice and later redirects (`docs/deploy.md` §15) until it is deleted.

## 2. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router (`src/app`, `src/proxy.ts`), TypeScript strict |
| UI | React 19, Tailwind CSS 3 (design tokens in `tailwind.config.ts`; materials, pins and view transitions in `src/app/globals.css`), lucide-react |
| Map | Leaflet + react-leaflet 5 (OpenStreetMap / CARTO / Esri tiles) |
| State | Zustand 5 (`src/store/*`, several persisted to localStorage) |
| Backend (BaaS) | Firebase: Auth, Firestore, Storage, Cloud Messaging (web push) |
| Server code | Cloud Functions v2 in `functions/` (region `europe-west3`) |
| Next API routes | `/api/feedback` (nodemailer → SMTP), `/api/firebase-messaging-sw` (generated FCM service worker), `/api/health` (container healthcheck) |

## 3. Repository map

```
src/app/page.tsx                 Orchestrator: wires useUiStore (activePanel, location selection, returnTo/focusRequest navigation), useAppBootstrap, useVisibleSpots and useUserLocation to the panels and the map
src/app/layout.tsx               Metadata, viewport, <InstallGate/> overlay
src/app/privacy, src/app/terms   Legal pages (A1), rendered by components/legal/LegalPage from src/content/legal/*.hu.ts
src/app/account-deletion         Public account deletion page for Google Play (components/legal/AccountDeletionPage)
src/app/.well-known/assetlinks.json  Digital Asset Links for the Android app (runtime ANDROID_CERT_SHA256, lib/assetLinks)
src/app/api/feedback/route.ts    Feedback email endpoint (SMTP)
src/app/api/firebase-messaging-sw/route.ts  FCM service worker (generated from NEXT_PUBLIC_* config)
src/app/api/health/route.ts      Liveness endpoint for the container healthcheck (docker/healthcheck.mjs)
src/proxy.ts                     Per-request nonce CSP for pages (T32); policy built by src/lib/csp.mjs
src/components/                  All UI (panels, modals, map)
src/components/profile/**        Profile panel: header, tabs, admin tools; components/ProfilePanel.tsx re-exports it
src/components/spot-details/**   Spot details: hero, actions, gallery, reviews, edit/admin parts; components/SpotDetailsPanel.tsx re-exports it
src/components/discovery/**      Explore list parts (featured spot, rows)
src/components/map/**            Map chrome: MapControls stack, MapStylePopover, PlaceCard
src/components/legal/**          LegalPage, the sign-in acceptance notice, the one-time TermsPrompt
src/components/ui/               Shared primitives: PanelShell, ModalShell, Button/CloseButton, StarRating, CategoryIcon, LevelBadge, LevelRing, PerkIcon
src/store/useSpotStore.ts        Spot scopes (startSpots / syncSpotScopes / stopSpots) + all spot mutations; admin state lives in useUserStore (isAdmin / isSuperAdmin, from admins/{uid})
src/store/spotListeners.ts       The approved / own / admin spot listeners behind the scopes (T30), merged by lib/mergeSpots
src/store/useUserStore.ts        Auth flows, user doc, terms acceptance, admins, username, profile images, highlights, account deletion
src/store/useUploadStore.ts      Background uploads of new spots, photos and reviews (G4)
src/store/useLocationStore.ts    Location status + sessionStorage cache; the only geolocation caller
src/store/useDiscoveryStore.ts   Explore's sort, filter, batch and scroll, kept while it is closed
src/store/use*Store.ts           language (selected language only), map theme (+ tile configs), notifications, push prompt, toast (forwards to notifications), ui
src/hooks/useAppBootstrap.ts     Loading orchestration: auth + spots listeners, map ready, app-ready delays
src/hooks/useSheetDrag.ts, useCardDrag.ts  Vertical sheet / place-card gestures (thresholds in lib/sheetGesture)
src/hooks/useStandaloneFullHeight.ts  iOS standalone full-height fix (lib/appViewport)
src/hooks/viewTransition.ts      runViewTransition for sheet and photo-morph transitions
src/hooks/useSystemBack.ts       The system back steps back in the app (one same-URL history entry while anything is open)
src/hooks/usePushNotifications.ts FCM permission/token handling
src/hooks/useUserLocation.ts     The user's location (one automatic request + manual request), from useLocationStore
src/hooks/useVisibleSpots.ts     Map spots filtered by role (admins: all, others: approved + own)
src/hooks/useT.ts                useT() translation hook, over src/lib/i18n.ts
src/lib/firebase.ts              Firebase client init (auth, db, storage, functions)
src/lib/translations.ts          hu/en/de dictionaries (TranslationKey type)
src/lib/i18n.ts                  Pure translate()/interpolate()/splitBold()/splitSlots() and the Language type
src/lib/csp.mjs                  CSP builder shared by src/proxy.ts (pages) and next.config.mjs (/api/*)
src/lib/levelUtils.ts, levelTheme.ts  Level thresholds 3/10/15/20 spots, perks, badge colours, level-up rule
src/lib/categories.ts, spotUtils.ts  The nine categories and their label keys; navigation URLs
src/lib/terms.ts                 TERMS_VERSION and the acceptance check (A1)
src/lib/mapTiles.ts              CARTO API key on tile URLs
functions/src/index.ts           Exports only: triggers (functions/src/triggers: notifications, publicProfiles/spotsCount/admin-flag sync)
                                 and callables (functions/src/callables: highlights, spot images/likes, admins, username/name style, account deletion)
firestore.rules, storage.rules   Security rules; tests in tests/rules/ (`npm run test:rules`)
firestore.indexes.json           Composite indexes
firebase.json                    Firestore rules/indexes, Storage rules, Functions config, emulator ports
scripts/                         seed-emulator.ts (e2e fixtures), check-public-env.mjs (build guard), bootstrap-super-admin.ts (recovery only)
scripts/store/                   Store graphics and screenshots (`npm run store:assets`, emulator demo data; docs/play-store.md)
deploy/, Dockerfile, docker/     Server compose file, update script, image and healthcheck
docs/deploy.md, docs/BACKLOG.md  Release and server runbook (Android app: §17); open work
docs/play-store.md               Play listing texts, Data safety and content rating answers
```

### Firestore data model (current)
- `spots/{id}`: name, category, description, location{lat,lng}, createdBy, createdByName, createdByPhoto,
  status ('pending'|'approved'), createdAt, imageUrls[], spotImages[{id,url,addedBy,addedAt,likes,likedBy[]}],
  primaryImageIndex, **reviews[] embedded array**, highlighted[], isHighlighted.
  Legacy spots may have only `imageUrls` (no `spotImages`), a singular legacy `imageUrl` field, and reviews that contain `userEmail`/`userSpotsCount` — **all code must keep reading legacy shapes.**
  Spots of deleted accounts have `createdBy: "deleted-user"` and no createdByName/createdByPhoto.
- `users/{uid}`: profile, savedSpots[], highlightedSpots[], customNameColor/Font, fcmTokens[], language,
  notificationsEnabled, notificationSettings, spotsCount (server-maintained, all statuses),
  termsVersion + termsAcceptedAt (accepted Terms/Privacy version, A1; lib/terms),
  questProgress/questRewards (legacy Valentine event; unused).
- `publicProfiles/{uid}`: server-maintained public mirror of a user (username, profilePictureURL,
  customNameColor/Font, isAdmin, spotsCount); public `get`, no client writes.
- `usernames/{name}`: `{uid}` registry, written only by the `claimUsername` callable.
- `admins/{uid}`: email, username, photoURL, addedAt, addedBy, role ('super' | 'admin').
- `categories/{id}`: name, icon (admin-managed; half-finished feature, see docs/BACKLOG.md).
- Storage: `spot-images/{uid}/…` (new uploads; legacy flat `spot-images/…` stays readable),
  `spot-images/deleted-user/…` (kept photos of deleted accounts), `profile-pictures/{uid}/…`, `profile-banners/{uid}/…`.

## 4. Commands

```bash
npm ci && npm --prefix functions ci   # install
npm run dev                 # dev server :3000
npm run verify              # typecheck + lint + unit tests + next build (gate for every change)
npm run verify:fn           # functions build + lint + unit tests (gate when functions/ changed)
npm run test:rules          # Firestore/Storage rules tests on the emulator (Java 21 required)
npm run test:e2e            # Playwright vs the emulator-seeded build (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
```
`next build` needs Firebase config. Without a `.env.local`, export non-secret demo values first:
`export NEXT_PUBLIC_FIREBASE_API_KEY=demo-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-spoton.firebaseapp.com NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-spoton.appspot.com NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0 NEXT_PUBLIC_FIREBASE_APP_ID=demo-app NEXT_PUBLIC_FIREBASE_VAPID_KEY=demo`.
A single e2e spec runs via `npm --prefix functions run build && npx firebase emulators:exec --only auth,firestore,storage,functions --project demo-spoton "npx tsx scripts/seed-emulator.ts && npx playwright test e2e/<file>"` (`npm run test:e2e -- <file>` does not work).
E2E specs must never leave a fixture that another spec uses in a mutated state.
In the Claude Code sandbox, the functions emulator cannot register Firestore triggers (the CLI sends localhost calls through the proxy despite `NO_PROXY`; the proxy must not be unset). There, run e2e with `--only auth,firestore,storage` and `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; the callable- and trigger-dependent tests then fail and are verified in CI instead.

### Environment variables
| Var | When | Where used |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, VAPID_KEY) | **build time** (inlined in bundle) | `lib/firebase.ts`, SW route, push hook |
| `NEXT_PUBLIC_USE_EMULATORS` | build time, tests only | `lib/firebase.ts` |
| `NEXT_PUBLIC_MOVED_TO` | build time, Vercel only (T19) | domain-move banner |
| `NEXT_PUBLIC_CONTROLLER_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` | build time (required by the container build) | legal pages `/privacy`, `/terms` (A1) |
| `NEXT_PUBLIC_CARTO_API_KEY` | build time, optional (CARTO watermarks keyless tiles) | `store/useMapThemeStore.ts` via `lib/mapTiles` |
| `SMTP_HOST/PORT/USER/PASS`, `FEEDBACK_RECIPIENT` | runtime (container `.env`) | `/api/feedback` |
| `ANDROID_CERT_SHA256` | runtime (container `.env`), optional | `/.well-known/assetlinks.json` (docs/deploy.md §17.3) |

Build-time values live as GitHub repository variables (release builds) and in Vercel's settings; changing one needs a new release.
Never commit `.env*` files — sole exception: `functions/.env.demo-spoton` (emulator-only, non-secret params such as `APP_URL`, whitelisted in `.gitignore`). Never hardcode personal emails, keys or tokens.

## 5. Hard rules for agents

1. **If you are not 100% sure, STOP and ask.** Do not invent new features, collections, APIs, or UX that were not agreed. Report the ambiguity to Paul instead.
2. **One change per branch and PR.** Keep commits small and focused; if you must touch an unrelated file, justify it in the commit message.
3. **Refactors preserve behaviour.** A change described as a refactor or cleanup must produce identical UI and data behaviour.
4. **Never touch production Firebase** (no `firebase deploy`, no scripts against real projects, no real credentials). Use the emulator (`demo-spoton` project id). Deploys are Paul's manual steps (`docs/deploy.md` §7 and §16); say explicitly when a change needs one.
5. **Backward compatibility with existing data is mandatory.** Legacy spot shapes (only `imageUrls`, reviews with `userEmail`, missing optional fields) must keep rendering.
6. **Never rename or drop an exported Cloud Function** unless explicitly agreed — a rename deletes the deployed function.
7. **Gates before every commit:** `npm run verify`, plus `npm run verify:fn` if `functions/` changed, `npm run test:rules` if the rules changed, and the e2e specs the change touches. Do not commit red.
8. **No secrets in git, images, logs, or client bundles.** Only `NEXT_PUBLIC_*` values may reach the browser, and those must be non-secret.
9. **Security posture:** authorization must be enforced server-side (Firestore/Storage rules or Cloud Functions), never only in UI. UI checks are UX, not security.
10. **Dependencies:** pin exact versions for `next` and security-relevant packages; justify every new dependency in the commit message; prefer none.
11. **Commit messages:** imperative subject, optionally prefixed with the area (`Map: …`, `A1: …`); the body explains *why* and lists any intentional behaviour change. User-facing changes also get a `CHANGELOG.md` entry.
12. **The repository is public.** No session links, model names or secrets in commits, PRs, comments or docs.

## 6. Code conventions (target state — apply to code you touch)

- **Layers:** `components/` render only → `hooks/` compose data + UI state → `store/` app state + Firebase side effects → `lib/` pure functions (unit-tested, no React, no Firebase).
- Components do **not** import `firebase/*` directly; go through a store action or a hook.
- No new file over ~300 lines; extract sub-components/hooks instead.
- One way to translate: `useT()` (React) or `translate()` from `lib/i18n` (non-React code). No hardcoded user-visible strings — add keys to all three languages in `lib/translations.ts`. No emoji in interface text.
- Shared primitives (`components/ui/`): `PanelShell`, `ModalShell`, `Button`/`CloseButton`, `StarRating`, `CategoryIcon`, `LevelBadge`; sheet gestures via `useSheetDrag` / `useCardDrag`. Don't hand-roll new overlays.
- Constants (limits, thresholds, categories, z-index) live in `lib/` — no magic numbers in JSX.
- Tailwind classes must be static strings (JIT cannot see `replace()`-built class names). Buttons with custom layouts need `no-min-size` (the global button rule centres content and sets a minimum size).
- Types: shared domain types live next to their store (`Spot`, `Review`, `SpotImage` in `useSpotStore.ts`) until a `src/domain/` module is introduced; no `any` in new code.
- No `innerHTML`/`dangerouslySetInnerHTML`.

## 7. Deployment target (summary — full runbook: `docs/deploy.md`)

- Image: `ghcr.io/isolapaul/spoton` (private), built by `.github/workflows/release.yml` on `vX.Y.Z` tags; Trivy-gated, SBOM, cosign-signed.
- Runtime: distroless Node 22 nonroot, `output: 'standalone'`, read-only rootfs, `cap_drop: ALL`, no published ports, only on network `edge`.
- Server dir: `/srv/docker/spoton/` (`docker-compose.yml`, `.env` chmod 600). Pinned by digest; **not** Watchtower-managed; updated with `./update.sh vX.Y.Z`.
- Cloudflare Tunnel public hostname `spoton.isolapaul.hu` → `http://spoton:3000`.
