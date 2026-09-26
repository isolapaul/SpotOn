# T13 — PII strip script and security rollout runbook

**Phase:** 2 · **Depends on:** T12 · **Risk:** low (code), high (the rollout it documents) · **Decisions:** D2, D8, D15
**Audit refs:** SEC-03, SEC-05, SEC-01 (rollout), ROADMAP §4, §5 traps 1, 2, 6, 7, 10

## Goal
Two deliverables:
1. An idempotent, dry-run-first script that removes the leaked reviewer PII and the spoofable metadata from existing reviews.
2. `docs/security-rollout.md`: the exact, ordered runbook Paul follows to ship T08–T12 to production safely, with backups, verification and rollback.

The first production cutover must not happen before this runbook exists.

## Context
- **Orchestrator note (2026-09-26):** ROADMAP §4 now starts with **step 0, the emergency rules patch** from `docs/audit/current-rules.md`. The runbook must include it as the first step, before the functions deploy, and must say why: LR-01 means `admins` is writable by any signed-in user, and the T08 functions trust `admins/{uid}.role`. Also add the admins-migration note: email-keyed admin docs are reported by the backfill, and Paul re-adds those admins from the Admin tab after the bootstrap.
- Legacy reviews in `spots/{id}.reviews[]` contain `userEmail` (public PII, SEC-03), and `userSpotsCount`, `customNameColor` and `customNameFont` (spoofable, SEC-05). After T11b, new reviews never contain them. After T12, the rules reject them. Old data still has them.
- Firestore triggers on `spots/{spotId}` updates:
  - `onReviewAdded` fires only when the reviews length grows;
  - `onSpotApproved` fires only on a `pending → approved` change;
  - `syncSpotsCount` fires only on create, delete or a `createdBy` change.

  So rewriting `reviews` in place sends no notifications and triggers no recount.
- Scripts share T08's `scripts/lib/cli.ts`:
  - `--project` is required; dry-run is the default; `--apply` writes;
  - `demo-*` projects are refused without the emulator;
  - Application Default Credentials are used.
- **Verified CLI facts** (firebase-tools 15.31.0 source):
  - There is **no** `firebase` command that downloads Firestore or Storage rules (only `database:rules:get` for RTDB). The rules are fetched through the Firebase Rules REST API. Release names: `projects/<id>/releases/cloud.firestore` and `projects/<id>/releases/firebase.storage/<bucket>`.
  - `firebase deploy` accepts `-c/--config <path>` (a different `firebase.json`), `--only`, `--project` and `--non-interactive`.
  - Function params: an interactive deploy prompts for a missing `APP_URL` and writes `functions/.env.<projectId>`, which is git-ignored by T08. A non-interactive deploy with the value missing fails.
- ROADMAP §4 order:
  1. functions;
  2. bootstrap;
  3. backfill;
     - step 3.5: transitional Firestore rules, only if T12 produced `docs/audit/transitional-firestore.rules`;
  4. client container (plus Vercel serving the same build);
  5. rules;
  6. PII strip;
  7. Vercel stages.

## Files
- Create:
  - `scripts/lib/stripReviewPii.ts` (pure) and `scripts/lib/stripReviewPii.test.ts`;
  - `scripts/strip-review-pii.ts`;
  - `docs/security-rollout.md`.
- Modify: T01's root vitest config, **only if** its `include` does not already cover `scripts/**/*.test.ts` (justify in the commit).
- Delete: none.

## Steps
1. **`scripts/lib/stripReviewPii.ts`** (pure, no imports):
   - `PII_REVIEW_KEYS = ['userEmail','userSpotsCount','customNameColor','customNameFont'] as const`.
   - `stripReviews(reviews: unknown): {changed: boolean; reviews: unknown[]; strippedCount: number}`:
     - a non-array gives `{changed:false, reviews: [], strippedCount: 0}`, and the caller must skip the document;
     - otherwise each element that is a plain object has those keys deleted, and every other key and the order are preserved;
     - non-object elements are kept as they are;
     - `strippedCount` = the number of reviews that had at least one key removed.

   Tests: mixed legacy and new reviews, order preserved, other keys untouched (`id, userId, userName, userPhoto, rating, comment, createdAt`), non-array input, empty array, already clean (`changed:false`), and non-object elements.
2. **`scripts/strip-review-pii.ts --project <id> [--apply] [--check]`**:
   - Page through `spots` ordered by `FieldPath.documentId()`, 200 per page.
   - For each document where `stripReviews(doc.get('reviews')).changed`, queue `batch.update(ref, {reviews}, {lastUpdateTime: doc.updateTime})`. The precondition prevents losing a review appended concurrently.
   - Commit batches of **at most 400** writes, and only with `--apply`.
   - If a batch fails with `FAILED_PRECONDITION` (code 9), re-read that batch's docs and retry, at most 3 times, then report.
   - `--check` is read-only and exits 1 if any review still holds a PII key. That makes it the post-condition check.
   - Output **counts only**: `spots scanned`, `spots to update`, `reviews stripped`, `writes committed`, `retries`. **Never print emails, names or review content.**
   - Idempotent: a second `--apply` gives `spots to update: 0`.
3. **Emulator test**: see Acceptance. It relies on T04's seed containing legacy reviews with `userEmail` (and T11b's e2e review).
4. **`docs/security-rollout.md`**: write the runbook with the sections below.
   - Use placeholders only: `<PROJECT_ID>`, `<BUCKET>` (for example `<PROJECT_ID>.appspot.com` or `.firebasestorage.app`; take it from Console → Storage), `<PAUL_EMAIL>` and `<SA_KEY_PATH>`.
   - No real ids, emails or keys.
   - Every command must be copy-pasteable.

   **§0 Preconditions (checklist):**
   - T08–T12 are merged on `main`; CI is green (`verify`, `verify:fn`, `test:rules`, `test:e2e`); a release tag exists for the functions (for example `security-v1`).
   - The rollback tag for the **previous** functions state is the T07 commit (Node 22 toolchain, pre-T08 logic; a pre-T07 commit is Node 20 and its deploy may be blocked):
     ```bash
     git tag pre-security <commit of T07>
     git show pre-security:functions/package.json | grep '"node": "22"'   # must print a line
     ```
   - Root dependencies installed (the scripts need the root `firebase-admin` and `tsx`): `npm ci`.
   - `firebase --version` matches the pinned version; `firebase login`; `firebase use <PROJECT_ID>` or `--project` on every command.
   - Credentials for the scripts:
     - either a service-account key for `firebase-adminsdk-*` (Console → Project settings → Service accounts → Generate key), stored outside the repo (`chmod 600`), with `export GOOGLE_APPLICATION_CREDENTIALS=<SA_KEY_PATH>`, and **deleted** in the console after the rollout;
     - or `gcloud auth application-default login && gcloud auth application-default set-quota-project <PROJECT_ID>`. Note: `getUserByEmail` may need the SA key.
   - The Blaze plan is active (required for v2 functions), and `gcloud` is installed.
   - Put the client in a maintenance window, or at least tell users that old PWA windows may show errors (trap 2).

   **§1 Backups (before any change):**
   - Firestore export, into a **dedicated private bucket** (never the default Storage bucket `<BUCKET>`, whose access is governed by the live, possibly permissive, Storage rules):
     ```bash
     gsutil mb -p <PROJECT_ID> -l europe-west3 -b on --pap enforced gs://<PROJECT_ID>-backups
     gcloud firestore export gs://<PROJECT_ID>-backups/pre-security-$(date +%F) --project <PROJECT_ID>
     ```
     `-b on` enables uniform bucket-level access and `--pap enforced` blocks public access. If the Firestore database is not in `europe-west3`, use its location for `-l` (Console → Firestore → database details).
   - Current rules. Save them outside the repo:
     ```bash
     TOKEN=$(gcloud auth print-access-token)
     curl -s -H "Authorization: Bearer $TOKEN" https://firebaserules.googleapis.com/v1/projects/<PROJECT_ID>/releases/cloud.firestore   # note "rulesetName"
     curl -s -H "Authorization: Bearer $TOKEN" https://firebaserules.googleapis.com/v1/<rulesetName> | jq -r '.source.files[0].content' > ~/spoton-rollback/firestore.rules
     curl -s -H "Authorization: Bearer $TOKEN" "https://firebaserules.googleapis.com/v1/projects/<PROJECT_ID>/releases/firebase.storage/<BUCKET>"
     curl -s -H "Authorization: Bearer $TOKEN" https://firebaserules.googleapis.com/v1/<rulesetName> | jq -r '.source.files[0].content' > ~/spoton-rollback/storage.rules
     ```
     Fallback: copy the text from Console → Firestore → Rules, and Console → Storage → Rules.
   - Create `~/spoton-rollback/firebase.json`:
     ```json
     {"firestore":{"rules":"firestore.rules"},"storage":{"rules":"storage.rules"}}
     ```
     Compare the saved rules with `docs/audit/current-rules.md`. They must match. If they don't, stop, because T12 was designed against the other version.

   **§2 Step 1: deploy functions.**
   - `npm --prefix functions ci && npm --prefix functions run build`.
   - `firebase deploy --only functions --project <PROJECT_ID>`. When prompted for `APP_URL`, enter `https://spoton.isolapaul.hu`. It is saved to `functions/.env.<PROJECT_ID>` (git-ignored).
   - **If the CLI offers to delete any function, answer No and abort** (trap 6).
   - Verify in Console → Functions that these exist in `europe-west3` on Node 22:
     - `onSpotApproved`, `onReviewAdded`, `onSpotFavorited`, `onNewPendingSpot`, `highlightSpot`;
     - `addAdmin`, `removeAdmin`, `lookupUserByEmail`, `syncPublicProfile`, `syncSpotsCount`, `syncAdminFlag`, `claimUsername`, `updateNameStyle`, `toggleImageLike`, `addSpotImages`, `unhighlightSpot`.
   - A first deploy of new Firestore triggers can fail while Eventarc permissions propagate. Wait a few minutes and re-run the same command.
   - Old clients keep working, because the rules are unchanged.

   **§3 Step 2: bootstrap the super admin.**
   ```bash
   npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email <PAUL_EMAIL>
   npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email <PAUL_EMAIL> --apply
   ```
   Verify in the console that `admins/<uid>.role == "super"`.

   **§4 Step 3: backfill profiles.**
   - Run the dry run:
     ```bash
     npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> | tee ~/spoton-rollback/backfill-dry.txt
     ```
   - Check `admins invalid`. **If it is greater than 0, stop and ask** (do not continue towards the rules deploy): those `admins/{id}` docs have an id that is not an existing Auth uid with a matching email, and would lose admin rights under the new functions and rules.
   - Review `duplicates`, `conflicts` and `invalid` (trap 10). For each duplicate, Paul decides who keeps the name, and edits the other user's `users/<uid>.username` in the console to a unique valid name (`^[a-z0-9_]{3,20}$`). The mirror trigger updates `publicProfiles`. Re-run the dry run until `duplicates: 0`; `invalid` entries may stay, since those users are prompted when they change their name.
   - Apply, then verify:
     ```bash
     npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> --apply
     npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID>
     ```
     The last run must print `planned writes: 0`.
   - Spot-check a few `publicProfiles/<uid>` documents: `spotsCount` includes pending spots (trap 7).

   **§4.5 Step 3.5: deploy transitional rules** (only if T12 produced `docs/audit/transitional-firestore.rules`; otherwise skip). They are the live rules plus exactly the read grants the new client needs before T12's rules go live (T12 step 6).
   ```bash
   mkdir -p ~/spoton-transitional
   cp docs/audit/transitional-firestore.rules ~/spoton-transitional/firestore.rules
   echo '{"firestore":{"rules":"firestore.rules"}}' > ~/spoton-transitional/firebase.json
   firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-transitional/firebase.json
   ```
   Old clients keep working (only reads were added). Rollback: `firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/firebase.json`.

   **§5 Step 4: deploy the client.** Follow `docs/deploy.md` (T16–T18) to `https://spoton.isolapaul.hu`, and redeploy Vercel from the same commit. Smoke-test on the new domain:
   - sign in; change the username;
   - Paul sees the admin tab; a normal account doesn't;
   - add a spot with a photo (it becomes pending);
   - approve it as Paul;
   - add a review; add a photo to an existing spot;
   - highlight (with a level ≥ 3 account);
   - enable notifications, then sign out.

   **§6 Step 5: deploy the rules** (trap 1: only after step 4 is live everywhere).
   - Re-run the §1 rules backup (the live rules could have changed). If §4.5 was applied, the saved Firestore rules now equal `docs/audit/transitional-firestore.rules` rather than `docs/audit/current-rules.md`; that is expected, and they are the rollback target from now on (the new client needs their read grants).
   - `firebase deploy --only firestore:rules,storage --project <PROJECT_ID>`.
   - Immediately repeat the §5 smoke test.
   - Monitor for 24 to 48 hours:
     - Console → Firestore → Usage (security rules evaluations: allowed / denied / errors);
     - Cloud Monitoring metric `firestore.googleapis.com/rules/evaluation_count` filtered by `result=DENY`;
     - client reports.

     Expected: a small, steady trickle of denies from old PWA windows (trap 2). A spike correlated with a user flow means **roll back the rules** (§9) and report.

   **§7 Step 6: strip review PII.**
   ```bash
   npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID>
   npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --apply
   npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --check
   ```
   `--check` must exit 0. This step is irreversible except by restoring the §1 export, so do not restore it.

   **§8 Step 7 and later:** Vercel Stage A/B and deletion (T19); the T30 client, then the T30 rules. Link to the ROADMAP; no details here.

   **§9 Rollback (per component, newest first):**
   - **Rules:**
     ```bash
     firebase deploy --only firestore:rules,storage --project <PROJECT_ID> --config ~/spoton-rollback/firebase.json
     ```
     This restores the pre-T12 behaviour instantly. The data written since then is compatible.
   - **Client:** point `docker-compose.yml` back to the previous image digest; redeploy Vercel's previous deployment. **Only while the old rules are live**, because old clients break under the T12 rules.
   - **Functions:**
     ```bash
     git checkout pre-security
     npm --prefix functions ci && firebase deploy --only functions --project <PROJECT_ID>
     ```
     Accept deleting only the new functions, and **only after** the client has been rolled back. Then `git checkout main`.
   - **Bootstrap:** delete `admins/<uid>` in the console, but only after the client rollback (the old client uses `NEXT_PUBLIC_ADMIN_EMAIL`).
   - **Transitional rules (§4.5):** `firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/firebase.json`, with `~/spoton-rollback/firestore.rules` still holding the original §1 backup. Only while the old client is live, or after the client rollback.
   - **Backfill:** no rollback is needed (additive fields and collections).
   - **PII strip:** not reversible by design.

   **§10 Final checklist:** one checkbox per step above, with date and initials, plus:
   - once the rollout is confirmed stable, let the backups expire after N days (Paul chooses N, for example 30):
     ```bash
     echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > ~/spoton-rollback/lifecycle.json
     gsutil lifecycle set ~/spoton-rollback/lifecycle.json gs://<PROJECT_ID>-backups
     ```
     or delete them directly with `gsutil rm -r gs://<PROJECT_ID>-backups/pre-security-<date>`;
   - delete the SA key;
   - confirm `functions/.env.<PROJECT_ID>` is not committed;
   - `git status` is clean;
   - the rollback files are archived.

## Must NOT change
- Review elements keep every non-PII key and their order. Reviews are never added, removed or reordered.
- No other document or field is touched by the script.
- The runbook step order follows ROADMAP §4 exactly. The runbook never contains real project ids, emails or credentials.
- No production access from the implementer: the scripts are run only against the emulator.

## Acceptance
```bash
npm run verify                       # includes scripts/lib/stripReviewPii.test.ts
npx firebase emulators:exec --project demo-spoton --only auth,firestore \
  "npx tsx scripts/seed-emulator.ts && \
   ! npx tsx scripts/strip-review-pii.ts --project demo-spoton --check && \
   npx tsx scripts/strip-review-pii.ts --project demo-spoton | tee /tmp/pii1.txt && \
   npx tsx scripts/strip-review-pii.ts --project demo-spoton --apply && \
   npx tsx scripts/strip-review-pii.ts --project demo-spoton --check && \
   npx tsx scripts/strip-review-pii.ts --project demo-spoton | tee /tmp/pii2.txt"
grep -E "spots to update: [1-9]" /tmp/pii1.txt
grep -E "spots to update: 0" /tmp/pii2.txt
! grep -iE "@|userEmail\"?:" /tmp/pii1.txt /tmp/pii2.txt     # counts only, no PII printed
! npx tsx scripts/strip-review-pii.ts --apply                # refuses without --project
test -f docs/security-rollout.md
grep -nE "releases/cloud.firestore|firestore:rules,storage|--config ~/spoton-rollback|bootstrap-super-admin|backfill-profiles|strip-review-pii" docs/security-rollout.md
! grep -nE "[A-Za-z0-9._%+-]+@(gmail|isolapaul)\." docs/security-rollout.md   # no real emails
for p in '--pap enforced' 'admins invalid' 'transitional-firestore.rules' 'git tag pre-security'; do grep -qF -- "$p" docs/security-rollout.md || echo "missing: $p"; done   # prints nothing
```

## Rollback
`git revert` (the script and docs only). For the production rollback of the rollout itself, see runbook §9.

## Stop and ask Paul if…
- The seed has no legacy reviews with PII. Ask T04's owner rather than inventing prod-like data.
- Paul's saved production rules (§1) differ from `docs/audit/current-rules.md`.
- The Rules REST API calls in §1 fail for Paul's account. Then use the console copy fallback, and record which method was used.
- Paul wants the PII strip before the rules deploy. That is unsafe: until the T12 rules are live, old clients can still write `userEmail`.
