# SpotOn — security rollout runbook (T08–T12 to production)

The exact, ordered steps Paul follows to ship the server-side security work (Cloud Functions T07–T10, client T11a/T11b, rules T12) to production, with backups, verification and rollback.
The order is ROADMAP §4 and it is **one-way** (ROADMAP trap 2): do not skip or reorder steps. Every step is a manual action by Paul; nothing here runs automatically.
The container deploy itself (step 4) is in `docs/deploy.md`. The rules baseline and audit are in `docs/audit/current-rules.md`.

**Placeholders** you replace yourself before running a command:

| Placeholder | Meaning |
|---|---|
| `<PROJECT_ID>` | the production Firebase project id |
| `<BUCKET>` | the default Storage bucket, e.g. `<PROJECT_ID>.appspot.com` or `<PROJECT_ID>.firebasestorage.app` (Console → Storage, shown above the file list) |
| `<PAUL_EMAIL>` | your own sign-in email, exactly as it appears in the deployed emergency patch |
| `<SA_KEY_PATH>` | path of the service-account key file, **outside** the repository |

**Conventions**
- Run every command in **bash**, from the **repository root**, on an up-to-date `main` checkout (`git switch main && git pull`).
- `npx firebase …` runs the repository's pinned firebase-tools (15.31.0). Do not use a globally installed `firebase` of another version.
- The scripts (`scripts/*.ts`) are **dry-run by default**, need `--project`, and print a banner `TARGET=<id> MODE=dry-run|APPLY EMULATOR=no`. Check the banner before reading the rest of the output.
- Rollback files go to `~/spoton-rollback/` (outside the repo). Never commit them.

---

## Step 0 — Emergency rules patch (ALREADY APPLIED by Paul on 2026-09-26)

Kept here so the order stays auditable. The text of the patch is in `docs/audit/current-rules.md` → "Emergency patch".

**What it did:** `admins` and `categories` writes are locked to `<PAUL_EMAIL>` (verified email); Storage `spot-images/**` allows only image creates under 5 MB, no overwrite or delete; Storage `spots/**` is read-only.
**Why it must be live before step 1:** without it, `admins/*` is writable by any signed-in user (LR-01). The T08 functions trust `admins/{uid}.role`, so anyone could write `admins/<ownUid> {role:'super'}` and then use `addAdmin` / `lookupUserByEmail`.

Before continuing, verify it is **still live**:
- [ ] Console → Firestore → Rules: `match /admins/{docId}` and `match /categories/{categoryId}` both have `allow write: if request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == '<PAUL_EMAIL>'`.
- [ ] Console → Storage → Rules: `match /spot-images/{allPaths=**}` has `allow create` with the `5 * 1024 * 1024` size and `image/(jpeg|png|webp)` checks, and `allow update, delete: if false`; `match /spots/{allPaths=**}` has `allow write: if false`.

If either is missing, re-apply the patch from `docs/audit/current-rules.md` first. Do not start step 1 while `admins` is writable by everyone.

**Admin inventory (do this now, before step 1):**
- [ ] Console → Firestore → `admins`: write down every document id and its `email` field (e.g. in `~/spoton-rollback/legacy-admins.txt`; create the folder with `mkdir -p ~/spoton-rollback && chmod 700 ~/spoton-rollback`). These are the **legacy** admin docs. Their ids are Firestore auto-ids (20 characters, e.g. `Ab12Cd34Ef56Gh78Ij90`), not uids, so the new functions and rules will not recognise them (Paul's answer in `current-rules.md`).
- [ ] **Security check:** because of LR-01, anyone could have created an admin doc before the patch. Delete, right now, every doc whose `email` you do not recognise (the old client treats any listed email as an admin). Keep the ones you recognise until step 5 (§6) is done; they are what the currently deployed client uses.
- [ ] **Planted uid-keyed docs:** the `email` field is attacker-controlled, so checking it is not enough. Before step 1, also:
  - delete every doc that has a `role` field (nothing legitimate writes `role` before §3, and the new functions trust `role == "super"`);
  - for every doc whose id is **not** 20 characters (a 28-character id is an Auth uid; the old client wrote some of these itself): Console → Authentication → search that uid. Keep the doc only if that account's email equals the doc's `email` **and** you recognise it; otherwise delete it.
  - Record the result (kept ids) in `~/spoton-rollback/legacy-admins.txt`.

---

## §0 Preconditions (checklist)

- [ ] Step 0 is verified live (above).
- [ ] **Pause Vercel production deploys before merging** if Vercel builds from the branch you merge into (Vercel → Project → Settings → Git shows the Production Branch). Use Settings → Git → Ignored Build Step → "Don't build anything" (or disconnect the Git repository). Otherwise the merge ships the new client to the Vercel domain before steps 1–3.5 and it breaks there (trap 2). The container is safe: it is built only from `v*` tags.
- [ ] T08–T12 are merged on `main`; CI is green (`verify`, `verify:fn`, `test:rules`, `test:e2e`).
- [ ] A release tag exists for the functions deploy, for example:
  ```bash
  git tag security-v1 && git push origin security-v1
  ```
- [ ] The rollback tag for the **previous** functions state is the T07 commit (Node 22 toolchain, pre-T08 logic). A pre-T07 commit is Node 20 and its deploy may be blocked. On the original branch history T07 is `d38d859`; find it with `git log --oneline --grep '^T07:'` (if the history was squash-merged, use the last `main` commit that contains T07 but not T08):
  ```bash
  git tag pre-security d38d859
  git show pre-security:functions/package.json | grep '"node": "22"'   # must print a line
  git push origin pre-security
  ```
- [ ] Root dependencies installed (the scripts need the root `firebase-admin` and `tsx`, and `npx firebase` needs the pinned CLI):
  ```bash
  npm ci
  npx firebase --version    # must print 15.31.0
  ```
- [ ] Logged in: `npx firebase login`. Every command below passes `--project <PROJECT_ID>` explicitly.
- [ ] `gcloud`, `gsutil`, `curl` and `jq` are installed (`gcloud --version`, `jq --version`), and `gcloud auth login` is done with your owner account.
- [ ] Credentials for the scripts (Application Default Credentials), one of:
  - a service-account key for `firebase-adminsdk-*` (Console → Project settings → Service accounts → Generate new private key), stored outside the repo:
    ```bash
    chmod 600 <SA_KEY_PATH>
    export GOOGLE_APPLICATION_CREDENTIALS=<SA_KEY_PATH>
    ```
    and **deleted** in the console after the rollout (§10);
  - or `gcloud auth application-default login && gcloud auth application-default set-quota-project <PROJECT_ID>`. Note: `getUserByEmail` (bootstrap) may need the SA key.
- [ ] No emulator variables in this shell (the scripts refuse a real project combined with them):
  ```bash
  unset FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST
  ```
- [ ] Your admin email for the rules steps (the same value as in the deployed patch):
  ```bash
  export ADMIN_EMAIL='<PAUL_EMAIL>'
  ```
- [ ] The Blaze plan is active (required for v2 functions).
- [ ] Put the client in a maintenance window, or at least tell users that old PWA windows may show errors during the switch (trap 2).

---

## §1 Backups (before any change)

**Firestore export**, into a **dedicated private bucket** (never the default Storage bucket `<BUCKET>`, whose access is governed by the live Storage rules):
```bash
gsutil mb -p <PROJECT_ID> -l europe-west3 -b on --pap enforced gs://<PROJECT_ID>-backups
gcloud firestore export gs://<PROJECT_ID>-backups/pre-security-$(date +%F) --project <PROJECT_ID>
```
`-b on` enables uniform bucket-level access and `--pap enforced` blocks public access. If the Firestore database is not in `europe-west3`, use its location for `-l` (Console → Firestore → database details). For a multi-region database the bucket must be multi-region: `eur3` → `-l EU`, `nam5` → `-l US` (check the Firestore "Export and import data" docs if unsure). If the bucket already exists (a re-run), skip the `mb` line.

**Current rules.** There is no `firebase` command that downloads Firestore or Storage rules; use the Firebase Rules REST API and save them outside the repo:
```bash
mkdir -p ~/spoton-rollback && chmod 700 ~/spoton-rollback
TOKEN=$(gcloud auth print-access-token)
RULES_API=https://firebaserules.googleapis.com/v1
FS_RULESET=$(curl -sf -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <PROJECT_ID>" "$RULES_API/projects/<PROJECT_ID>/releases/cloud.firestore" | jq -r '.rulesetName')
echo "$FS_RULESET"    # projects/<PROJECT_ID>/rulesets/<id>
curl -sf -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <PROJECT_ID>" "$RULES_API/$FS_RULESET" | jq -r '.source.files[0].content' > ~/spoton-rollback/firestore.rules
ST_RULESET=$(curl -sf -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <PROJECT_ID>" "$RULES_API/projects/<PROJECT_ID>/releases/firebase.storage/<BUCKET>" | jq -r '.rulesetName')
echo "$ST_RULESET"
curl -sf -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: <PROJECT_ID>" "$RULES_API/$ST_RULESET" | jq -r '.source.files[0].content' > ~/spoton-rollback/storage.rules
grep -q rules_version ~/spoton-rollback/firestore.rules && grep -q rules_version ~/spoton-rollback/storage.rules && echo "OK: rules saved"
```
The last line must print `OK: rules saved`. If a call fails (empty `echo`, `null`, or no `OK`), use the fallback: copy the text from Console → Firestore → Rules and Console → Storage → Rules into those two files, and note in §10 which method you used.

Create the rollback config:
```bash
echo '{"firestore":{"rules":"firestore.rules"},"storage":{"rules":"storage.rules"}}' > ~/spoton-rollback/firebase.json
```

**Compare with the audited baseline.** T12 was designed against the live rules **as patched by step 0** (`docs/audit/current-rules.md`: "Firestore (live)" and "Storage (live)" with the "Emergency patch" blocks). `docs/audit/transitional-firestore.rules` is exactly that Firestore baseline plus one added block, so for Firestore:
```bash
diff -wB <(grep -v '^//' docs/audit/transitional-firestore.rules | sed "s/<YOUR_ADMIN_EMAIL>/$(printf '%s' "$ADMIN_EMAIL" | sed 's/[&/\]/\\&/g')/g") ~/spoton-rollback/firestore.rules
```
(It needs `ADMIN_EMAIL` from §0.) Expected: only lines starting with `<` that belong to the `T12 transitional` comment and the `match /publicProfiles/{uid}` / `match /usernames/{name}` blocks (the grants the live rules do not have yet). Any line starting with `>` means production differs from the baseline. For Storage, compare `~/spoton-rollback/storage.rules` by eye with "Storage (live)" where blocks 3 and 4 are replaced by the patch's Storage blocks.
Differences only in comments or whitespace are fine, including a `<`/`>` pair that differs only in a trailing `//` comment. **Any other difference: stop and ask**, because T12 was designed against the other version.

---

## §2 Step 1: deploy the Cloud Functions

```bash
npm --prefix functions ci && npm --prefix functions run build
npx firebase deploy --only functions --project <PROJECT_ID>
```
- When prompted for `APP_URL`, enter `https://spoton.isolapaul.hu`. It is saved to `functions/.env.<PROJECT_ID>` (git-ignored; never commit it). A `--non-interactive` deploy without that file fails.
- **If the CLI offers to delete any function, answer No and abort** (trap 6: a deleted function is gone).
- A first deploy of new Firestore triggers can fail while Eventarc permissions propagate. Wait a few minutes and re-run the same command.

Verify in Console → Functions that all of these exist, in `europe-west3`, on Node.js 22:
- `onSpotApproved`, `onReviewAdded`, `onSpotFavorited`, `onNewPendingSpot`, `highlightSpot`;
- `addAdmin`, `removeAdmin`, `lookupUserByEmail`, `syncPublicProfile`, `syncSpotsCount`, `syncAdminFlag`, `claimUsername`, `updateNameStyle`, `toggleImageLike`, `addSpotImages`, `unhighlightSpot`.

Old clients keep working, because the rules are unchanged.

---

## §3 Step 2: bootstrap the super admin

```bash
npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email "$ADMIN_EMAIL"
npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email "$ADMIN_EMAIL" --apply
```
The dry run prints the planned `admins/<uid>` document; the second run writes it.
Verify in the console that `admins/<uid>` exists (its id is your 28-character Auth uid, not one of the legacy auto-ids) and has `role == "super"`.

---

## §4 Step 3: backfill profiles

Dry run:
```bash
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> | tee ~/spoton-rollback/backfill-dry.txt
```

**Check `admins invalid`.** Every `admins/{id}` doc whose id is not an existing Auth uid with a matching email is listed as `invalid admin doc: <id>`. For this project the **expected** entries are the legacy auto-id docs from the step 0 inventory (including your own old entry): they are known and are replaced below.
- Compare every `invalid admin doc:` line with `~/spoton-rollback/legacy-admins.txt`.
- **If any listed id is not in the inventory, or your new `admins/<uid>` from §3 is listed: stop and ask** (do not continue towards the rules deploy).
- **If a listed id is not a 20-character auto-id** (for example a 28-character uid kept at step 0): stop and ask, because a uid-keyed doc listed as invalid means its email does not match that account.
- Otherwise continue. The other admins lose admin rights in the **new** client until you re-add them in §5 (the currently deployed client still reads the legacy docs).

**Review `duplicates`, `conflicts` and `invalid`** (trap 10). For each duplicate, decide who keeps the name, and edit the other user's `users/<uid>.username` in the console to a unique valid name (`^[a-z0-9_]{3,20}$`). The mirror trigger updates `publicProfiles`. Re-run the dry run until `duplicates: 0`. `invalid` entries may stay: those users are prompted when they change their name.

Apply, then verify:
```bash
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> --apply
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID>
```
The last run must print `planned writes: 0`.
Spot-check a few `publicProfiles/<uid>` documents: `spotsCount` includes pending spots (trap 7).

---

## §4.5 Step 3.5: deploy the transitional Firestore rules

Only if T12 produced `docs/audit/transitional-firestore.rules` (it did). They are the live rules as patched by step 0, verbatim, plus exactly the two read grants the new client needs before T12's rules go live: public `get` on `publicProfiles/{uid}` and `usernames/{name}` (T12 step 6). Storage rules are **not** touched in this step.

**1. Keep the pre-transitional backup** (from now on `~/spoton-rollback/firestore.rules` will be overwritten by §6):
```bash
mkdir -p ~/spoton-rollback/pre-transitional
cp ~/spoton-rollback/firestore.rules ~/spoton-rollback/storage.rules ~/spoton-rollback/firebase.json ~/spoton-rollback/pre-transitional/
```

**2. Build the deployable file.** The repo file contains the placeholder `<YOUR_ADMIN_EMAIL>`; the block below substitutes `$ADMIN_EMAIL` (§0) and fails closed: on an empty or unset value, a leftover placeholder, or an email that does not match the live patch, it deletes the output and prints `FAILED`.
```bash
mkdir -p ~/spoton-transitional && rm -f ~/spoton-transitional/firestore.rules ~/spoton-transitional/firebase.json
(
  case "${ADMIN_EMAIL:-}" in ''|'<PAUL_EMAIL>'|*"'"*|*' '*) echo "STOP: set ADMIN_EMAIL (see §0)" >&2; exit 1;; esac
  esc=$(printf '%s' "$ADMIN_EMAIL" | sed 's/[&/\]/\\&/g') || exit 1
  sed "s/<YOUR_ADMIN_EMAIL>/$esc/g" docs/audit/transitional-firestore.rules > ~/spoton-transitional/firestore.rules || exit 1
  if grep -q 'YOUR_ADMIN_EMAIL' ~/spoton-transitional/firestore.rules; then echo "STOP: placeholder left" >&2; exit 1; fi
  if [ "$(grep -cF "'$ADMIN_EMAIL'" ~/spoton-transitional/firestore.rules)" -ne 2 ]; then echo "STOP: expected 2 substitutions" >&2; exit 1; fi
  if ! grep -qF "'$ADMIN_EMAIL'" ~/spoton-rollback/firestore.rules; then echo "STOP: ADMIN_EMAIL is not the email in the live rules (§1 backup)" >&2; exit 1; fi
  echo '{"firestore":{"rules":"firestore.rules"}}' > ~/spoton-transitional/firebase.json || exit 1
  echo "OK: transitional rules ready"
) || { rm -f ~/spoton-transitional/firestore.rules ~/spoton-transitional/firebase.json; echo "FAILED: nothing to deploy"; }
```
It must print `OK: transitional rules ready`. The `sed` escaping handles `&`, `/` and `\` in the value (an `&` would otherwise insert the matched placeholder); an email with a quote or a space is rejected because it would break the rules string. `diff docs/audit/transitional-firestore.rules ~/spoton-transitional/firestore.rules` shows only the substituted lines: the two `request.auth.token.email == '…'` lines and the header comment that names the placeholder. (Each check in the block exits explicitly: `set -e` would be ignored inside a subshell followed by `||`.)

**3. Deploy only these Firestore rules:**
```bash
npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-transitional/firebase.json --dry-run
npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-transitional/firebase.json
```
How this is scoped (checked against firebase-tools 15.31.0): `-c/--config <path>` makes the CLI use that `firebase.json`, and its directory becomes the project directory, so `"rules": "firestore.rules"` resolves to `~/spoton-transitional/firestore.rules`, not to the repo's `firestore.rules`. `--only firestore:rules` limits the deploy to Firestore rules (no indexes, no Storage, no functions), and that config contains nothing else anyway. `--dry-run` compiles the rules on the server without releasing them; the second command releases them.

Verify: Console → Firestore → Rules shows the `publicProfiles` / `usernames` blocks and still the step 0 `admins` / `categories` blocks.
Old clients keep working (only reads were added).
Rollback: `npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/pre-transitional/firebase.json`.

---

## §5 Step 4: deploy the client

Follow `docs/deploy.md` (T16–T18; including its §10 one-time console settings for the new domain) to `https://spoton.isolapaul.hu`, and redeploy Vercel from the **same commit** (do not set `NEXT_PUBLIC_MOVED_TO` yet; that is step 7). If you paused Vercel in §0, re-enable the build step (or reconnect Git) now, deploy, check that the Vercel deployment's commit SHA matches the container's release commit, and run the sign-in / add-review smoke test on the Vercel URL too.

**Smoke test on the new domain:**
- [ ] sign in; change the username;
- [ ] Paul sees the admin tab; a normal account does not;
- [ ] add a spot with a photo (it becomes pending);
- [ ] approve it as Paul;
- [ ] add a review; add a photo to an existing spot;
- [ ] highlight (with a level ≥ 3 account);
- [ ] enable notifications, then sign out.

**Do not expect in this window** (until §6): an admin deleting **another user's** spot. The live delete rule checks `admins/{token.email}` (LR-09), which no admin doc matches; this is already the case in production today. It works after the final rules (§6).

**Re-add the other admins** (the ones from the step 0 inventory you still want): as Paul, Profile → Admin tab → add by email. This calls the `addAdmin` callable, which writes `admins/{uid}` with `role: "admin"`. The person must have signed in at least once (otherwise "User not found"). Check that each re-added admin sees the pending tab in the new client.

---

## §6 Step 5: deploy the final rules

Only after step 4 is live everywhere (trap 1): the container on the new domain **and** Vercel serving the new build.

Re-run the §1 **rules** backup commands (the `mkdir` … `OK: rules saved` block, then the `firebase.json` line); the live rules could have changed. Because §4.5 was applied, the saved Firestore rules now equal `~/spoton-transitional/firestore.rules` rather than the §1 baseline (check with `diff -wB ~/spoton-transitional/firestore.rules ~/spoton-rollback/firestore.rules`, no output expected). That is expected: they are the rollback target from now on, because the new client needs their read grants.

```bash
npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID> --dry-run
npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID>
```
This uses the repo's `firebase.json`, so it deploys the repo's `firestore.rules` and `storage.rules` (T12).

Immediately repeat the §5 smoke test, plus:
- [ ] as an admin, delete a test spot created by another account (works now);
- [ ] a re-added admin still sees the pending tab and can approve.

Monitor for 24 to 48 hours:
- Console → Firestore → Usage (security rules evaluations: allowed / denied / errors);
- Cloud Monitoring metric `firestore.googleapis.com/rules/evaluation_count` filtered by `result=DENY`;
- client reports.

Expected: a small, steady trickle of denies from old PWA windows (trap 2). A spike correlated with a user flow means **roll back the rules** (§9) and report.

**Clean up the legacy admin docs** once the final rules are live, the smoke test passes and the admins you want are re-added: Console → Firestore → `admins` → delete each legacy auto-id doc from the step 0 inventory. Under the new rules they grant nothing. Do **not** delete any doc whose id is an Auth uid and that has a `role` field (those are the current admins).

---

## §7 Step 6: strip review PII

Only after §6. Until the T12 rules are live, old clients can still write `userEmail` into new reviews, so stripping earlier is pointless and unsafe to rely on.

```bash
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID>
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --apply
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --check; echo "exit=$?"
```
- The dry run prints counts only: `spots scanned`, `spots to update`, `reviews stripped`, `writes committed`, `retries`.
- `--apply` removes `userEmail`, `userSpotsCount`, `customNameColor` and `customNameFont` from every embedded review, keeping every other key and the review order. Only `reviews` is rewritten, in place, so no notification or recount trigger fires. Each write is guarded by the spot's last update time; if a review was added concurrently, the batch is re-read and retried (at most 3 times).
- `--check` must print `check: OK` and `exit=0`. A second dry run shows `spots to update: 0`.
- If `--apply` ends with `failed: … busy spot(s) still failing their precondition` (exit 3), someone was reviewing those spots at that moment. Nothing was lost; run `--apply` again. Exit 1 from `--check` means PII remains; exit 3 from any mode means the script failed (read the message).

This step is irreversible except by restoring the §1 export, so do not restore it.

---

## §8 Step 7 and later

Vercel Stage A / Stage B and deleting the Vercel project (T19; `docs/deploy.md` §15), then the T30 client followed by the T30 rules. See `docs/ROADMAP.md` §4 steps 7–8.

---

## §9 Rollback (per component, newest first)

Never roll back past step 0: every rollback target below already contains the emergency patch.

- **Rules (§6):**
  ```bash
  npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID> --config ~/spoton-rollback/firebase.json
  ```
  This restores the rules saved in §6 (the transitional Firestore rules and the patched Storage rules) instantly. The data written since then is compatible.
- **Client (§5):** point `docker-compose.yml` back to the previous image digest (`docs/deploy.md` §11); redeploy Vercel's previous deployment. **Only while the old rules are live**, because old clients break under the T12 rules.
- **Transitional rules (§4.5):**
  ```bash
  npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/pre-transitional/firebase.json
  ```
  Restores the §1 baseline. Only while the old client is live, or after the client rollback (the new client needs the transitional read grants).
- **Functions (§2):**
  ```bash
  git checkout pre-security
  npm ci && npm --prefix functions ci && npx firebase deploy --only functions --project <PROJECT_ID>
  git checkout main && npm ci
  ```
  Accept deleting only the new functions, and **only after** the client has been rolled back.
- **Bootstrap (§3):** delete `admins/<uid>` in the console, but only after the client rollback (the old client uses `NEXT_PUBLIC_ADMIN_EMAIL`). Keep the legacy admin docs until then; the old client reads them.
- **Backfill (§4):** no rollback needed (additive fields and collections).
- **PII strip (§7):** not reversible by design.

---

## §10 Final checklist

| Step | Done (date, initials) |
|---|---|
| Step 0 emergency patch verified live; admin inventory taken; unknown admin docs deleted | |
| §0 preconditions; `pre-security` tag pushed | |
| §1 Firestore export; rules saved (method: REST API / console copy); baseline compared | |
| §2 functions deployed; all 16 functions on Node 22 in `europe-west3` | |
| §3 super admin bootstrapped | |
| §4 backfill applied; `planned writes: 0`; `admins invalid` = legacy docs only | |
| §4.5 transitional rules deployed | |
| §5 client live on the new domain and Vercel; smoke test; admins re-added | |
| §6 final rules deployed; smoke test; 24–48 h monitoring clean; legacy admin docs deleted | |
| §7 PII strip applied; `--check` exit 0 | |

Then:
- [ ] Once the rollout is confirmed stable, let the backups expire after N days (you choose N, for example 30):
  ```bash
  echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > ~/spoton-rollback/lifecycle.json
  gsutil lifecycle set ~/spoton-rollback/lifecycle.json gs://<PROJECT_ID>-backups
  ```
  or delete them directly with `gsutil rm -r gs://<PROJECT_ID>-backups/pre-security-<date>`.
- [ ] Delete the service-account key: Console → Project settings → Service accounts → Manage service account permissions → the `firebase-adminsdk-*` account → Keys → delete; then delete the local file (`rm <SA_KEY_PATH>`) and `unset GOOGLE_APPLICATION_CREDENTIALS`.
- [ ] `functions/.env.<PROJECT_ID>` is not committed: `git ls-files functions | grep '\.env'` prints only `functions/.env.demo-spoton`.
- [ ] `git status` is clean.
- [ ] Archive `~/spoton-rollback/` and `~/spoton-transitional/` (outside the repo, private).

---

## §11 Troubleshooting

| Symptom | Check / action |
|---|---|
| The **currently deployed (old)** app sometimes does not load after signing in (reported after step 0) | Most likely **BUG-24**, not the patch: the loading screen can stay stuck when the map's ready timer is cancelled by a re-render (`docs/audit/code-review.md`). It is timing-dependent, a reload usually helps, and the fix (T04) ships with the step 4 client. The step 0 patch only restricts writes to `admins`, `categories` and Storage `spot-images` / `spots`, and the old client does none of these while loading. To confirm: open DevTools → Console on the stuck page. `FirebaseError: Missing or insufficient permissions` means a rules denial; no such error means BUG-24. Also check Console → Firestore → Usage (security rules evaluations: denied) and the Storage rules monitoring for denies at that time. |
| A denial **is** proven to come from a rules change | Roll back that change: after §4.5 or §6 use §9. For the step 0 patch there is no local file: Console → Firestore (or Storage) → Rules keeps the published versions in its history panel; open the version before 2026-09-26, compare, and publish only the part that must go back. **Never** re-open `admins` writes to every signed-in user (LR-01), and never while the T08 functions are deployed. Report the denial. |
| Old PWA windows show permission errors after §6 | Expected (trap 2). The user reloads the page or reinstalls the PWA from the new domain. |
| A script prints `refusing: real project … must not be combined with emulator env` | Emulator variables are set in this shell. Run the `unset` line from §0, or open a new shell. |
| A script fails with a permission or quota error | Use the SA key from §0 instead of `gcloud` user credentials. |
| §1 REST calls return nothing or `null` | Use the console copy fallback and note it in §10. |
| `npx firebase deploy` prompts to delete functions | Answer **No** and abort (trap 6), except in the §9 functions rollback. |
| `strip-review-pii.ts` reports `still failing its precondition after 3 retries` | Reviews are being added to those spots right now. Wait and re-run `--apply`; it is idempotent and only rewrites spots that still need it. |
