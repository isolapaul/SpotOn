# Security Review — SpotOn

**Date:** 2026-09-25
**Scope:** whole repository at commit `eee5668` (Next.js app, API routes, Zustand stores, Cloud Functions, config, dependencies), plus the planned container deployment.
**Method:** manual code review of every source file, `npm audit --package-lock-only` on both lockfiles, and a baseline build (`tsc` clean, `next build` OK).
**Limitation:** the deployed Firestore and Storage rules are **not in the repo**. Findings marked *(rules-dependent)* are exploitable unless the live rules happen to block them. Paul supplies the live rules for T12.

Severity scale: **Critical**: remote, unauthenticated or any signed-in user, integrity or privacy impact on all users. **High**: significant impact, needs a precondition. **Medium**: limited impact or defence-in-depth. **Low**: hygiene.

---

## Summary

| ID | Severity | Title | Fixed by |
|---|---|---|---|
| SEC-01 | Critical *(rules-dependent)* | All authorization is client-side; no rules are version-controlled | T08–T12 |
| SEC-02 | Critical *(rules-dependent)* | Any signed-in user can approve, edit or delete any spot, or self-approve their own | T11b, T12 |
| SEC-03 | High | Reviewer email addresses are published to every visitor | T11b, T13 |
| SEC-04 | High *(rules-dependent)* | Full `users` collection readable (emails, FCM tokens); admin search downloads it | T09, T11a, T12 |
| SEC-05 | High | Spoofable review metadata: fake "Admin" badge, fake level, className injection | T09, T11b, T12 |
| SEC-06 | High | `/api/feedback` is an unauthenticated, unlimited mail relay | T14 |
| SEC-07 | High | Vulnerable dependencies (Next.js CRITICAL, nodemailer HIGH, transitive CRITICAL) | T05–T07 |
| SEC-08 | Medium *(rules-dependent)* | Admin management and categories gated only in UI | T08, T11a, T12 |
| SEC-09 | Medium | Level perks (highlights, name style) enforced only in UI | T09, T10 |
| SEC-10 | Medium | Lost-update and overwrite via whole-array rewrites (likes, images) | T10, T11b |
| SEC-11 | Medium | Storage upload paths not scoped by user; no size or type limits server-side | T11b, T12 |
| SEC-12 | Medium | Weak CSP (`unsafe-eval`, `unsafe-inline`, `img-src http:`) | T15, T32 |
| SEC-13 | Medium | Pending (unapproved) spots are downloaded by every visitor | T30 |
| SEC-14 | Medium | FCM tokens leak across accounts on shared devices; valid tokens pruned on transient errors | T08, T11a |
| SEC-15 | Low | `innerHTML` in avatar error handler | T15 |
| SEC-16 | Low | Username uniqueness race | T09, T11a |
| SEC-17 | Low | Super-admin email baked into the client bundle | T11a |
| SEC-18 | Low | Hardcoded personal email / production URL in source | T08, T14 |
| SEC-19 | Low | Cloud Functions log request payloads and user data | T08 |
| SEC-20 | Low | Stale `firebase.json` hosting block and deprecated headers | T12, T15 |
| SEC-21 | Info | Container and supply-chain requirements for the new deployment | T16–T18 |

---

## Findings

### SEC-01 — All authorization is client-side; no rules in the repo *(Critical, rules-dependent)*
**Where:** `firebase.json` has no `firestore.rules` or `storage.rules` entry, and neither file exists. Every permission check lives in React or Zustand code:
- `src/store/useSpotStore.ts:25-36`: `isSuperAdmin` / `isAdmin`
- `src/store/useUserStore.ts:469,503,537`
- `src/components/ProfilePanel.tsx:472,494,866,920`
- `src/components/SpotDetailsPanel.tsx:301,659`

**Why it matters:** the Firebase web config is public by design. Anyone can call the Firestore REST API or the SDK directly with their own ID token, bypassing the UI. The rules are the only real security boundary, and nobody can review, test or version them today.

**Fix:** move authority to the server. Admins are identified by `admins/{uid}`. Privileged actions become callables (T08–T10). Strict, tested `firestore.rules` and `storage.rules` live in the repo (T12). Deploy order is in `docs/security-rollout.md` (T13).

### SEC-02 — Any signed-in user can approve, edit, delete or self-approve spots *(Critical, rules-dependent)*
**Where:**
- `src/store/useSpotStore.ts:217` decides `status: isAdmin(userEmail) ? 'approved' : 'pending'` on the **client**, using an email the caller passes in (`AddSpotModal.tsx:125`).
- `approveSpot` (`:329`), `deleteSpot` (`:339`), `updateSpotName` / `updateSpotDescription` (`:349,359`) and `setPrimaryImage` (`:401`) are plain `updateDoc` / `deleteDoc` calls.

**Exploit (if the rules only require auth):** `addDoc(collection(db,'spots'), {..., status:'approved'})` publishes an unmoderated spot. `updateDoc(doc(db,'spots',X), {status:'approved'})` approves anything. `deleteDoc` wipes any spot.

**Fix:** rules allow create only with `status=='pending'` (admins may use `'approved'`) and `createdBy==auth.uid`, with a key allowlist. Status, delete and edit rights follow `canEdit`: an admin, or the owner of an approved spot, limited to name, description and primary image (T12). The client stops sending status decisions based on email (T11b).

### SEC-03 — Reviewer email addresses are public *(High)*
**Where:** `SpotDetailsPanel.tsx:356` writes `userEmail: user.email` into `spots/{id}.reviews[]` (`useSpotStore.ts:240`). `fetchSpots` streams **all** spot documents to every visitor, signed in or not (`useSpotStore.ts:163`).

**Impact:** anyone with the site open can harvest every reviewer's email address. This is a GDPR-relevant personal data leak.

**Fix:** stop writing `userEmail` (T11b). Rules reject new reviews containing it (T12). The one-off script `scripts/strip-review-pii.ts` removes it from existing documents (T13).

### SEC-04 — User documents readable by others; admin search downloads all users *(High, rules-dependent)*
**Where:**
- `useUserStore.ts:474-492` (`searchUserByEmail`) runs `getDocs(collection(db,'users'))` and filters on the client.
- `SpotDetailsPanel.tsx:203,246,272` and `SpotInfoWindow.tsx:73` read other users' full `users/{uid}` documents, which contain `email`, `fcmTokens[]`, `savedSpots`, notification settings and quest data.

**Impact:** for the app to work, the live rules must allow reading other users' documents. Any signed-in user can then dump all emails and push tokens.

**Fix:** add `publicProfiles/{uid}`, a server-maintained mirror holding only username, avatar, name style and spotsCount (T09). The client reads only that (T11a). Admin lookup by email moves into a callable using the Admin SDK (T08). Rules make `users/{uid}` owner-only (T12).

### SEC-05 — Spoofable review metadata; className injection *(High)*
**Where:**
- `SpotDetailsPanel.tsx:353-363`: the client supplies `userSpotsCount`, `customNameColor`, `customNameFont` and `userEmail` in each review.
- `SpotDetailsPanel.tsx:84` shows an **"Admin" badge when `review.userEmail` matches an admin email**. `SpotDetailsPanel.tsx:76` puts `review.customNameFont` **directly into `className`**.

**Exploit:**
- Write a review with `userEmail: '<admin email>'`, and it displays with an Admin badge (impersonation).
- Set `userSpotsCount: 999` to fake a level-5 badge.
- Set `customNameFont: 'fixed inset-0 z-[9999] bg-black text-6xl'`, and every visitor who opens the spot gets a full-screen overlay, which enables UI redressing or phishing text. This is not script execution, but it is arbitrary layout control over other users' screens.

**Fix:** reviews store only `{id, userId, userName (fallback), userPhoto (fallback), rating, comment, createdAt}`. Badges, colours and fonts are rendered from `publicProfiles/{userId}`, where the server validates name style against an allowlist (T09, T11b). Name style is only ever rendered through a static allowlist map, never interpolated (T22). Rules restrict review keys (T12).

### SEC-06 — `/api/feedback` is an open, unlimited mail relay *(High)*
**Where:** `src/app/api/feedback/route.ts`. There is no authentication, no rate limit, no body-size cap, no limit on the number, size or type of attachments, and `mime` is taken from attacker-controlled data URLs. `senderName` and `senderEmail` are trusted and used as `replyTo`. There is a hardcoded fallback recipient (line 3).

**Impact:** anyone can flood Paul's inbox with arbitrarily large attachments through Paul's SMTP account, damaging its sending reputation (spam or blacklisting). Large JSON bodies can also exhaust memory in a single container.

**Fix (T14):**
- Hard body cap and `content-length` check. At most 3 attachments of at most 1.5 MB each, JPEG/PNG/WebP only, verified by magic bytes. Message 1–5000 characters.
- Per-IP token bucket keyed on `cf-connecting-ip`.
- Optionally verify a Firebase ID token with `jose` and take the sender identity from the token, never from the body.
- `FEEDBACK_RECIPIENT` is required (503 otherwise). Generic errors; plain-text email only.

### SEC-07 — Vulnerable dependencies *(High)*
`npm audit` (lockfiles as of `eee5668`):

| Package | Locked | Severity | Fixed in |
|---|---|---|---|
| `next` | 16.1.6 | **Critical** (RCE in image optimizer with AVIF, request smuggling, SSRF, cache poisoning, middleware bypasses, DoS) | 16.3.x (latest 16.3.6) |
| `nodemailer` | 8.0.1 | High (SMTP command and CRLF injection, file read via `raw`) | 10.x |
| `firebase` | 10.14.1 | Moderate (transitive `undici`) | 12.x |
| `protobufjs`, `websocket-driver` (transitive) | — | **Critical** | via Firebase and Next upgrades |
| `@grpc/grpc-js`, `sharp`, `postcss`, `picomatch`, `browserslist`, `nanoid` | — | High | via upgrades |
| **functions/**: `firebase-admin` 12.7, `firebase-functions` 5.1, `typescript` 4.9, `eslint` 8 | — | 3 Critical and 9 High transitive (`fast-xml-parser`, `protobufjs`, `node-forge`, `path-to-regexp`, …) | admin 14, functions 7, TS 5, ESLint 9 |

Cloud Functions declare `engines.node: "20"`, which reached end of life in April 2026.

**Fix:** T05 (Next and nodemailer), T06 (Firebase SDK 12), T07 (functions toolchain on Node 22). T02 adds Dependabot, and the CI audit gate plus the Trivy image gate (T18) keep them current.

### SEC-08 — Admin management and categories gated only in UI *(Medium, rules-dependent)*
**Where:**
- `useUserStore.ts:501-546`: `addAdmin` / `removeAdmin` write `admins/{uid}` from the client after `isSuperAdmin(user.email)`.
- `ProfilePanel.tsx:181`: `addDoc(collection(db,'categories'))`.
- The whole `admins` collection is streamed to every client (`useUserStore.ts:443`).

**Exploit (if rules are permissive):** `setDoc(doc(db,'admins', myUid), {...})` makes the attacker an admin.

**Fix:** admin changes only through the super-admin-checked callables `addAdmin` / `removeAdmin` (T08). Rules: `admins` is not client-writable, and is readable only by the user themselves or by admins. Categories can be written only by admins (T12).

### SEC-09 — Level perks enforced only in UI *(Medium)*
**Where:**
- `useUserStore.ts:657-705`: `highlightSpot(spotId, maxHighlights)` trusts a limit **passed in by the caller** and writes the spot's `highlighted` / `isHighlighted` directly.
- `updateCustomNameColor` / `updateCustomNameFont` (`:756-783`) run with no level check.
- Levels are computed on the client by downloading and counting documents.

**Fix:** a server-maintained `spotsCount` (T09), and transactional callables `highlightSpot` / `unhighlightSpot` / `updateNameStyle` that check the allowance on the server (T09, T10). Rules make those fields server-only (T12).

### SEC-10 — Lost updates and overwrites through whole-array rewrites *(Medium)*
**Where:** `toggleSpotImageLike`, `addSpotImages` and `deleteSpotImage` (`useSpotStore.ts:273,323,381`) rewrite the entire `spotImages` array from possibly stale local state. `migrateSpotImages` (`:305`) writes whenever **any viewer opens** a legacy spot (`SpotDetailsPanel.tsx:232`).

**Impact:** concurrent likes are lost, and any user allowed to update the array can rewrite other users' likes and images.

**Fix:** transactional callables for likes and image additions. Owner and admin deletions run under rules. Legacy image lists are converted at read time, with no writes on read (T10, T11b).

### SEC-11 — Storage uploads unscoped *(Medium)*
**Where:** `useSpotStore.ts:121` uploads to `spot-images/${ts}_${rand}_${file.name}`, so the path carries no uid and the user-controlled filename is embedded. Profile images use `{uid}/` paths but have no server-side size or type limits (only client compression).

**Fix:** new uploads go to `spot-images/{uid}/{random}.{ext}` (T11b). `storage.rules` enforce owner-only writes, a maximum of 5 MB and `image/(jpeg|png|webp)`. The legacy flat path becomes read-only (T12).

### SEC-12 — Weak Content-Security-Policy *(Medium)*
**Where:** `next.config.mjs:24-31` sets `script-src 'unsafe-eval' 'unsafe-inline'`, `img-src … https: http:`, and has no `object-src`, `base-uri`, `form-action` or `frame-ancestors`. It also sends the deprecated `X-XSS-Protection: 1; mode=block`.

**Fix (T15):**
- Drop `'unsafe-eval'` in production. Replace the `img-src` wildcard with an explicit host list. Add `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
- Add `Permissions-Policy`. Add `Cross-Origin-Opener-Policy: same-origin-allow-popups` (plain `same-origin` breaks the Google sign-in popup). Set `X-XSS-Protection: 0`.
- **T32:** nonce-based `script-src` removes `'unsafe-inline'`.

### SEC-13 — Pending spots visible to everyone *(Medium)*
**Where:** `useSpotStore.ts:163` streams all spots. Pending ones are hidden only by client-side filters (`page.tsx:82-84`, `DiscoveryPanel.tsx:73`).

**Impact:** unmoderated content, which may be inappropriate or contain private locations, is readable by anyone.

**Fix (T30):** split the listener into approved, own and admin queries, then restrict pending reads in the rules. This must come **after** the client change, because rules do not filter queries: an unfiltered query would fail for everyone.

### SEC-14 — FCM token hygiene *(Medium)*
**Where:**
- Sign-out (`useUserStore.ts:284-291`) does not delete the device's FCM token or remove it from `users/{uid}.fcmTokens`, so the next person on a shared device receives the previous user's notifications.
- `functions/src/index.ts:178-196` removes **every** token that failed for any reason, including transient ones.

**Fix:** on sign-out call `deleteToken` and `arrayRemove` (T11a). Prune only on `messaging/registration-token-not-registered` and `messaging/invalid-registration-token` (T08).

### SEC-15 — `innerHTML` in avatar error handler *(Low)*
**Where:** `ProfilePanel.tsx:306` builds HTML with `user.username.charAt(0)`. Usernames are restricted to `[a-z0-9_]` today, but this path bypasses React escaping and would become XSS if that validation ever changes.

**Fix:** use a state-driven React fallback (T15).

### SEC-16 — Username uniqueness race *(Low)*
**Where:** `useUserStore.ts:549-598` checks and then writes with no transaction, and rules cannot enforce uniqueness. Sign-up (`:255`) writes the username with **no** uniqueness check at all.

**Fix:** the transactional `claimUsername` callable over `usernames/{name}` (T09, T11a). The backfill reports existing duplicates rather than overwriting them.

### SEC-17 — Super-admin email in the client bundle *(Low)*
**Where:** `NEXT_PUBLIC_ADMIN_EMAIL` (`useSpotStore.ts:27`) is inlined into public JavaScript.

**Fix:** mark the super admin with `admins/{uid}.role == 'super'`, set by the bootstrap script (T08). Remove the env var (T11a).

### SEC-18 — Hardcoded personal data and URLs *(Low)*
**Where:** `api/feedback/route.ts:3` (fallback recipient email) and `functions/src/index.ts:161` (`https://spoton-app.web.app`).

**Fix:** move these to configuration: a required `FEEDBACK_RECIPIENT` (T14) and the functions parameter `APP_URL` (T08).

### SEC-19 — Verbose function logging *(Low)*
**Where:** `functions/src/index.ts:487` logs `request.data`, `:521` logs `questRewards`, and `:182` logs full FCM tokens.

**Fix:** log IDs and outcomes only; never log tokens (T08, T10).

### SEC-20 — Config hygiene *(Low)*
**Where:** the `firebase.json` hosting block serves `out/` with an SPA rewrite, but the app has API routes and no static export. An accidental `firebase deploy` would publish a broken site. Separately, `public/manifest.json` references a missing `screenshot-mobile.png`, and `/default-avatar.png` is referenced but missing.

**Fix:** remove the hosting block (T12) and fix the assets (T15).

### SEC-21 — Container and supply-chain requirements for the new deployment *(Info; requirements for T16–T18)*
- **Base image:** distroless Node 22 `nonroot`, pinned by digest. It has no shell or package manager, which keeps the attack surface and CVE noise small. The build stage uses a `node:22-*-slim` image pinned by digest.
- **Runtime hardening:** `read_only: true`, tmpfs mounts for `/tmp` and `/app/.next/cache`, `user: 1000:1000`, `cap_drop: [ALL]`, `security_opt: no-new-privileges:true`, `init: true`, limits on memory, CPU and pids, and log rotation.
- **Network exposure:** **no published host ports**. The container joins only the external `edge` network, where `cloudflared` runs. Port 3000 is reachable only by other containers on `edge`.
- **Secrets:** SMTP credentials live in `/srv/docker/spoton/.env` (chmod 600), are injected at runtime, and never enter the image. `NEXT_PUBLIC_*` values are public config and are passed as build args.
- **Supply chain:**
  - Actions are pinned by SHA and every workflow uses least-privilege `permissions`.
  - Trivy scans the exact OCI tarball that gets pushed, failing on HIGH or CRITICAL; exceptions go in `.trivyignore` with expiry dates.
  - A Syft CycloneDX SBOM is produced, plus keyless cosign signatures and an SBOM attestation.
  - Dependabot covers npm (root and `functions/`), Docker, docker-compose and GitHub Actions.
  - The server verifies signatures with `cosign verify` before bumping the digest.
- **Not Watchtower-managed.** The container carries the label `com.centurylinklabs.watchtower.enable=false`. Updates arrive as reviewed pull requests, which produce a new tag and digest.
- **Trust boundary:** Cloudflare terminates TLS. The app trusts `cf-connecting-ip` only because it is reachable exclusively through the tunnel.

---

## Positive observations
- Security headers already exist (a starting point for T15), and `X-Frame-Options: DENY` plus `nosniff` are present.
- No `dangerouslySetInnerHTML`, and no `eval` in the app code.
- Leaflet `divIcon` HTML uses only constants.
- Username format is validated (`^[a-z0-9_]{3,20}$`) on the edit path.
- Image uploads are compressed on the client, which reduces storage abuse (but is not a security control).
- Secrets are read from env variables; `.env*` files are git-ignored.
