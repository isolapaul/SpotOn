# SpotOn Roadmap: Hardening, Containerization, Refactor

Goals:
1. Close the security gaps in `audit/security-review.md`.
2. Remove the spaghetti code listed in `audit/code-review.md` without breaking anything.
3. Run SpotOn as a hardened, signed container on Paul's server at **https://spoton.isolapaul.hu**, behind the existing Cloudflare Tunnel.

Firebase stays the backend. Only the Next.js app moves off Vercel.

---

## 1. Decisions register

| # | Decision | Status |
|---|---|---|
| D1 | Containerize the Next.js app only. Firebase (Auth, Firestore, Storage, FCM, Functions) stays. | **Paul** |
| D2 | Paul provides the current production Firestore and Storage rules. T12 hardens them. | **Paul**, ⛔ pending paste |
| D3 | CI: GitHub Actions → Trivy → SBOM → cosign → **private** GHCR. Dependabot. | **Paul** |
| D4 | Implement everything. Each task gets an implementer agent, then an independent reviewer agent, then a commit. | **Paul** |
| D5 | Vercel: a single, tasteful "moved" banner (Stage A), then a 308 redirect (Stage B), then Vercel is deleted. | **Paul** |
| D6 | Proxy `/__/auth/*` so that `authDomain = spoton.isolapaul.hu`. | **Paul** |
| D7 | Optional tasks approved: hide pending spots (T30), React 19 (T31), nonce CSP (T32). | **Paul** |
| D8 | The level count keeps including pending spots, which is current behaviour. | default |
| D9 | The legacy Valentine `highlightBonus` stays honoured. | default |
| D10 | Anonymous feedback stays allowed, with a rate limit. | default |
| D11 | Trivy runs with `ignore-unfixed: true`, plus a `.trivyignore` whose entries have expiry dates. | default |
| D12 | The image limit per spot is 20. The UI text gets fixed to match. | default |
| D13 | The container is labelled `com.centurylinklabs.watchtower.enable=false` and pinned by digest. | default |
| D14 | Node 22 for both the container and functions. Upgrade to 24 before April 2027. | default |
| D15 | Reviews stay an embedded array. Rules make them append-only. No subcollection migration. | default |
| D16 | `NEXT_PUBLIC_*` values are Docker build args, taken from GitHub **variables**. One image per environment. | default |
| D17 | Base images: build on `node:22-trixie-slim`, run on `gcr.io/distroless/nodejs22-debian13:nonroot`, both pinned by digest. Debian 13 matches the server. Never mix Debian releases between the two stages. | default |

A "default" decision can be overridden by Paul at any time. If one changes, update this table and every task spec that depends on it.

---

## 2. Phases and tasks

Specs live in `docs/tasks/`. **Execute in this order**, unless the dependencies explicitly allow otherwise.

| Phase | Task | Title | Depends on | Risk |
|---|---|---|---|---|
| 0 Safety net | T01 | Tooling baseline (ESLint 9, Vitest, verify scripts) | — | low |
| | T02 | CI workflow and Dependabot | T01 | low |
| | T03 | Remove dead client code | T01 | low |
| | T04 | Emulator harness, seed data, Playwright smoke | T01 | low-med |
| 1 Patched stack | T05 | Next 16.3.x and nodemailer 10 | T04 | low-med |
| | T06 | Firebase JS SDK 12 | T05 | med |
| | T07 | Functions toolchain (Node 22, admin 14, functions 7, TS 5) | T02 | med |
| 2 Security | T08 | Functions: admin identity, notifications backbone | T07 | med |
| | T09 | Functions: public profiles, spotsCount, usernames, name style | T08 | med |
| | T10 | Functions: spot mutation callables | T09 | med |
| | T11a | Client: profiles, usernames, admin, sign-out token | T09 | med-high |
| | T11b | Client: spot interactions via callables, review PII | T10, T11a | med-high |
| | T12 | Firestore and Storage rules, with emulator tests | **D2**, T11b | high |
| | T13 | PII strip script and security rollout runbook | T12 | low |
| | T14 | Harden `/api/feedback` | T05, T11a | low |
| | T15 | Web hardening (CSP, headers, auth proxy, innerHTML, assets) | T06, T11a | med |
| 3 Container | T16 | Standalone build and hardened Dockerfile | T14, T15 | med |
| | T17 | Compose file, `.env.example`, server runbook | T16 | low |
| | T18 | Release pipeline (Trivy, SBOM, cosign, GHCR) | T16, T02 | med |
| | T19 | Domain-move notice (Vercel only), then the 308 | T17 | low |
| | T20 | README, CHANGELOG, env matrix | T17, T18 | low |
| 4 Bugs | T21 | Data and logic bug fixes | T11b | low |
| | T22 | i18n and styling bug fixes | T21 | low |
| 5 Refactor | T23 | Pure `lib/` modules with characterisation tests | T22 | low |
| | T24 | A single `useT()` translation hook | T23 | low |
| | T25 | Shared UI primitives (PanelShell, ModalShell, swipe, stars) | T24 | med |
| | T26 | Data hooks (`usePublicProfile`, `useIsAdmin`) | T25 | low |
| | T27 | Split ProfilePanel | T26 | med |
| | T28 | Split SpotDetailsPanel | T26 | med |
| | T29 | Panel state machine in `page.tsx` | T27, T28 | med |
| 6 Optional | T30 | Hide pending spots (split queries, then rules) | T12, T29 | med-high |
| | T31 | React 19, react-leaflet 5, zustand 5 | T29 | med |
| | T32 | Nonce-based strict CSP | T15, T31 | med |

**Parallelism.** T12 is blocked until Paul pastes the rules (D2). While it waits, these can proceed: T14, T15, T16–T20, T21, T22 and the refactor phase. T16 and later only need T14 and T15. **The first production cutover must not happen before T13's rollout runbook exists**, because moving the domain with open rules gains nothing.

Recommended real-world order when D2 is late: Phase 0 → Phase 1 → T08–T11b → T14, T15 → T16–T18 → T21–T22 → T12 and T13 (as soon as the rules arrive) → T19, T20 → Phase 5 → Phase 6.

---

## 3. Execution protocol (subagents)

For every task `Txx`:

1. **Implementer agent.** Its prompt contains only: "Read `CLAUDE.md` and `docs/tasks/Txx-*.md`. Implement exactly that spec. Stop and report if anything is ambiguous or if an acceptance check fails for reasons outside the spec." It works on branch `claude/sharp-lovelace-b3n3vt` and does **not** commit.
2. **Reviewer agent.** A fresh agent that saw none of the implementation. Its prompt: "You are an independent senior reviewer. Read `CLAUDE.md`, `docs/tasks/Txx-*.md`, and `git diff`. Verify:
   - every step is done;
   - every **Must NOT change** item still holds;
   - all acceptance commands pass (re-run them);
   - no secrets, no scope creep, no leftover debug code.

   Report PASS, or a list of concrete defects with `file:line`."
3. If the reviewer reports defects, the implementer (or orchestrator) fixes them and the reviewer runs again. There is no fixed round limit, but if the same defect repeats, escalate to Paul.
4. The orchestrator commits (`Txx: …`) and pushes, then marks the task done in §6.
5. **Stop conditions:** the spec contradicts the code, a decision is missing, the change would touch production, or the tests need a behaviour change the spec does not allow. In any of these cases, ask Paul.

Additional review gates:
- `/code-review` and `/security-review` over the accumulated diff after Phase 2, before T16.
- Both again at the end, followed by a final independent full-diff review.

---

## 4. Production rollout order (Paul executes; details in `docs/security-rollout.md` and `docs/deploy.md`)

1. Deploy the Cloud Functions (T07–T10), with `APP_URL=https://spoton.isolapaul.hu`.
2. Run `scripts/bootstrap-super-admin.ts` (T08). Paul becomes `admins/{uid}` with `role: 'super'`.
3. Run `scripts/backfill-profiles.ts`: dry run first, then apply, then resolve any duplicate usernames it reports (T09). If it reports `admins invalid` greater than 0, stop and ask.
   - **Step 3.5**, only if T12 produced `docs/audit/transitional-firestore.rules`: deploy those transitional Firestore rules (the live rules plus the reads the new client needs), before step 4.
4. Deploy the client container (T16–T18) to `spoton.isolapaul.hu`, and keep Vercel serving the same build.
5. Save the current production rules to a file, then run `firebase deploy --only firestore:rules,storage` (T12). Watch for denied requests.
6. Run `scripts/strip-review-pii.ts`: dry run, then apply (T13).
7. Vercel Stage A: set `NEXT_PUBLIC_MOVED_TO` on Vercel and redeploy (T19). About 30 days later, Stage B: 308 redirect. About 90 days later, delete the Vercel project.
8. Later: the T30 client deploy, followed by the T30 rules deploy.

**Rollback:**
- Rules: redeploy the saved rules file.
- Container: point back at the previous digest in `docker-compose.yml`.
- Functions: redeploy the previous git tag.

---

## 5. Traps (read before starting any task)

1. **Rules do not filter queries.** If a rule hides pending spots or other users' documents, any unfiltered query fails for everyone. Change the client queries first (T11a, T11b, T30), and only then tighten the rules.
2. **Deploy order is one-way.** If the rules go live before the super-admin bootstrap, Paul loses admin rights. If they go live before the new client, old clients break. Old PWA windows open during the switch will show permission errors, which is acceptable.
3. **The domain move resets per-origin state.** localStorage, FCM tokens and PWA installs are tied to the origin, so users sign in again and reinstall the PWA. This is what the T19 notice is for.
4. **Google sign-in on the new domain** needs three things: the domain added to Firebase Auth → Authorized domains; the OAuth redirect URI `https://spoton.isolapaul.hu/__/auth/handler`; and the `/__/auth` proxy (T15). COOP must be `same-origin-allow-popups`.
5. **`NEXT_PUBLIC_*` values are compiled into the image.** Changing any of them requires a rebuild.
6. **Renaming or dropping an exported function deletes it on deploy.** Keep `highlightSpot`, `onSpotApproved`, `onReviewAdded`, `onSpotFavorited` and `onNewPendingSpot`.
7. **`spotsCount` must count pending spots**, or current users drop a level (D8).
8. **Trivy HIGH/CRITICAL findings with no available fix** would block every release without `ignore-unfixed`. Distroless avoids the npm and shell CVE noise that Alpine brings.
9. **Storage objects are never deleted** today, so orphaned files accumulate. This is out of scope and noted for the future.
10. **Existing duplicate usernames may exist.** The backfill reports them and never overwrites.
11. **Rules tests need Java 21**, and `firebase-tools` has to be pinned.
12. **This sandbox has no running Docker daemon.** Container tasks try to start `dockerd`. If that fails, they are verified in GitHub Actions instead.

---

## 6. Open questions for Paul (defaults apply unless Paul overrides)

| # | Question | Default |
|---|---|---|
| Q1 | T14: feedback now needs at least 1 character of text. Image-only feedback is no longer possible. | accept |
| Q2 | T19: on the **old** Vercel domain only, the install prompt and the notification prompt are suppressed while the move banner exists. | accept |
| Q3 | T17: GHCR pulls use a **classic** PAT with only `read:packages`, because GitHub Packages officially supports only classic tokens. | accept |
| Q4 | T17: Dependabot can bump the private GHCR image in compose if a `DEPENDABOT_GHCR_TOKEN` secret is added. Otherwise that entry is dropped. | drop the entry until the token exists |
| Q5 | T09/T22: legacy or non-allowlisted custom name colours fall back to the level colour. | accept |
| Q6 | T22: aria-labels and alt texts stay in English for now, because E2E selectors depend on them. | accept, translate later |
| Q7 | T30: a pending spot that someone else favourited disappears from their favourites. | accept |
| Q8 | Server CPU architecture is assumed to be amd64 (i5-8500T). | accept |
| Q9 | T15: the auth proxy upstream is `<projectId>.firebaseapp.com`. Paul confirms his current `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` has that form. | confirm at deploy |

## 7. Progress

| Task | Status | Commit |
|---|---|---|
| Docs (CLAUDE.md, audits, roadmap, specs) | done; independently reviewed (T01–T13, T21–T32); T14–T20 review and T29 re-review pending | |
| T01 Tooling baseline | done, review PASS | (this commit) |
