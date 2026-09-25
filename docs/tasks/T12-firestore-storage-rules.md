# T12 — Firestore and Storage rules, with emulator tests

**Phase:** 2 · **Depends on:** **D2 (Paul's current rules)**, T11b (and T08–T11a) · **Risk:** high · **Decisions:** D2, D8, D15
**Audit refs:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-08, SEC-09, SEC-10, SEC-11, SEC-16, SEC-20

## Prerequisite (BLOCKING)
The orchestrator must first paste Paul's **current production** Firestore and Storage rules, verbatim, into `docs/audit/current-rules.md`, under the headings `## Firestore (live)` and `## Storage (live)`, with the date they were copied.
- If that file is missing or either section is empty, **do not start**. Report "blocked on D2".
- The implementer never fetches rules from production.

## Goal
Put strict, tested `firestore.rules` and `storage.rules` under version control, and wire them into `firebase.json`. This makes the rules the real security boundary.
- Every client write path left after T11a/T11b is allowed with exactly its field set.
- Every attack in the security review is denied.
- The rules are proven by emulator tests in CI.
- The stale hosting block is removed.

## Context
- **Rules do not filter queries** (ROADMAP trap 1). The client after T11a/T11b issues these reads:
  - `spots` (all, ordered by `createdAt`: `useSpotStore.ts` `fetchSpots`);
  - `spots where createdBy == me` (`ProfilePanel`);
  - `users/{me}` (get);
  - `admins/{me}` (get), plus `admins` (list, admins only);
  - `publicProfiles/{any}` and `usernames/{any}` (get);
  - `categories` (list, super admin only).

  Pending spots stay publicly readable here. Hiding them is T30.
- The client write paths and their exact key sets are in the table in `docs/tasks/T11b-client-spot-interactions.md` ("Context"). The `users` key allowlist is in `docs/tasks/T11a-client-profiles-usernames-admin.md` ("Context"). **Do not rely on those tables alone:** T21/T22 (and others) may land before this task. Re-derive the actual write paths from the code with `grep -rnE "updateDoc|setDoc|addDoc|deleteDoc|uploadBytes" src`, and stop and ask if a path is not covered below:
  - `addSpot`: `addDoc` with `createdAt: serverTimestamp()`.
  - `addReview`: `arrayUnion`, which **appends**, of `{id: "<uid>_<ms>", userId, userName, userPhoto?, rating, comment, createdAt: Timestamp}`.
  - `users` writes from T11a:
    - new doc: `setDoc(merge)` of `{uid, email, photoURL, profilePictureURL, profileBannerURL, savedSpots, createdAt, lastLoginAt}`;
    - login: `{lastLoginAt}`;
    - favourites: `{savedSpots}`;
    - avatar: `{profilePictureURL, photoURL}`;
    - banner: `{profileBannerURL}`;
    - push: `{fcmTokens, language, notificationsEnabled, lastTokenUpdate, notificationSettings?}`;
    - disable: `{notificationsEnabled}`;
    - settings: `{notificationSettings}`;
    - sign-out: `{fcmTokens: arrayRemove}`.
- Server-only fields, written only by Cloud Functions through the Admin SDK, which bypasses rules:
  - `users.{username, customNameColor, customNameFont, highlightedSpots, questProgress, questRewards, spotsCount}`;
  - `spots.{highlighted, isHighlighted}`, plus `spotImages` likes and additions;
  - all of `publicProfiles`, `usernames` and `admins`.
- **Username decision:** the client never writes `username`, including at creation. New users get their generated name through `claimUsername` (T11a step 4e). So `username` is simply absent from the client key allowlist.
- **Rules language, verified on Firestore emulator 1.22.0:** list range slicing `list[i:j]`, `List.removeAll`, `diff().affectedKeys().hasOnly()` and `keys().hasOnly()` all work. An append-only check with `newR[0:oldR.size()] == oldR` plus validation of `newR[oldR.size()]` accepted a valid append, and rejected an invalid rating, a modified old entry and a reordered list.
  - Alternative if needed: `newR.removeAll(oldR).size() == 1`. It also rejects a duplicate append, but does not preserve order.
- **One review per user** cannot be enforced in the rules, since they cannot iterate over the array. It stays a client-side check (`SpotDetailsPanel.tsx:346`). A server-side check (a trigger that removes duplicates) is optional future work and is not in this task.
- `firebase.json` today has `"firestore": {"indexes": …}`, `"functions": […]`, a stale `"hosting"` block (SEC-20), and T04's `"emulators"`.
- `firestore.indexes.json` has a second index (`createdBy, status, createdAt`) that is believed to serve only the removed quest query. **Leave both indexes as they are.** Removing it is out of scope unless a later task verifies that nothing uses it.
- The Storage legacy flat path `spot-images/{file}` stays readable. New uploads use `spot-images/{uid}/{uuid}.{ext}`, `profile-pictures/{uid}/{ts}_{name}` and `profile-banners/{uid}/{ts}_{name}`.

## Files
- Create:
  - `firestore.rules`, `storage.rules`;
  - `tests/rules/helpers.ts`, `tests/rules/firestore.spots.test.ts`, `tests/rules/firestore.users-admin.test.ts`, `tests/rules/storage.test.ts`. The Firestore tests are split so that no file exceeds about 300 lines;
  - `vitest.rules.config.ts`;
  - `docs/audit/transitional-firestore.rules`, **only if** step 6 finds a missing read.
- Modify:
  - `firebase.json`;
  - `package.json` (the `test:rules` script and the devDependency `@firebase/rules-unit-testing`, pinned exactly to `5.0.2`, which has a peer dependency on `firebase ^12` from T06);
  - T01's root vitest config: verify only. T01 step 3 already excludes `tests/rules/**`; change it only if that exclude is missing;
  - `.github/workflows/ci.yml` (T02; add the job);
  - `docs/audit/current-rules.md` (append a comparison section; see step 6).
- Delete: none.

## Steps
1. **`firestore.rules`.** Implement exactly the following. Helper names are free, but the semantics are binding:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function signedIn() { return request.auth != null; }
       function isSelf(uid) { return signedIn() && request.auth.uid == uid; }
       function isAdmin() { return signedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }
       function changed() { return request.resource.data.diff(resource.data).affectedKeys(); }
       function isStr(v, min, max) { return v is string && v.size() >= min && v.size() <= max; }

       // ---------- spots ----------
       function validLocation(l) {
         return l is map && l.keys().hasOnly(['lat','lng']) && l.keys().hasAll(['lat','lng'])
           && l.lat is number && l.lat >= -90 && l.lat <= 90
           && l.lng is number && l.lng >= -180 && l.lng <= 180;
       }
       function validSpotCreate() {
         let d = request.resource.data;
         return signedIn()
           && d.keys().hasOnly(['name','category','description','location','createdBy','createdByName',
                                'createdByPhoto','imageUrls','spotImages','primaryImageIndex','status','createdAt'])
           && d.keys().hasAll(['name','category','description','location','createdBy',
                               'imageUrls','spotImages','primaryImageIndex','status','createdAt'])
           && d.createdBy == request.auth.uid
           && (d.status == 'pending' || (d.status == 'approved' && isAdmin()))
           && d.createdAt == request.time
           && isStr(d.name, 1, 100)
           && d.description is string && d.description.size() <= 2000
           && d.category in ['scenic','smoke-spot','viewpoint','other','hiking','random','date-spot','park','part']
           && validLocation(d.location)
           && (!('createdByName' in d) || isStr(d.createdByName, 0, 100))
           && (!('createdByPhoto' in d) || isStr(d.createdByPhoto, 0, 2048))
           && d.imageUrls is list && d.imageUrls.size() >= 1 && d.imageUrls.size() <= 20
           && d.spotImages is list && d.spotImages.size() <= 20
           && d.primaryImageIndex is int && d.primaryImageIndex >= 0 && d.primaryImageIndex < d.imageUrls.size();
       }
       function validNewReview(r) {
         return r is map
           && r.keys().hasOnly(['id','userId','userName','userPhoto','rating','comment','createdAt'])
           && r.keys().hasAll(['id','userId','userName','rating','comment','createdAt'])
           && r.userId == request.auth.uid
           && r.id is string && r.id.matches(request.auth.uid + '_[0-9]+')
           && isStr(r.userName, 1, 100)
           && (!('userPhoto' in r) || isStr(r.userPhoto, 0, 2048))
           && r.rating is int && r.rating >= 1 && r.rating <= 5
           && r.comment is string && r.comment.size() <= 1000
           && r.createdAt is timestamp && r.createdAt <= request.time + duration.value(5, 'm');
       }
       function isReviewAppend() {
         let oldR = resource.data.get('reviews', []);
         let newR = request.resource.data.get('reviews', []);
         return signedIn()
           && changed().hasOnly(['reviews'])
           && newR is list
           && newR.size() == oldR.size() + 1
           && newR[0:oldR.size()] == oldR
           && validNewReview(newR[oldR.size()]);
       }
       function onlyRemoved(oldL, newL) {
         return newL is list && newL.size() <= oldL.size() && newL.removeAll(oldL).size() == 0;
       }
       function validOwnerImages() {
         let newU = request.resource.data.get('imageUrls', []);
         return (newU == ['/placeholder-spot.jpg'] || onlyRemoved(resource.data.get('imageUrls', []), newU))
           && onlyRemoved(resource.data.get('spotImages', []), request.resource.data.get('spotImages', []));
       }
       function isOwnerEdit() {
         let d = request.resource.data;
         let ak = changed();
         return signedIn()
           && resource.data.createdBy == request.auth.uid
           && resource.data.status == 'approved'
           && ak.hasOnly(['name','description','primaryImageIndex','imageUrls','spotImages'])
           && (!ak.hasAny(['name']) || isStr(d.name, 1, 100))
           && (!ak.hasAny(['description']) || (d.description is string && d.description.size() <= 2000))
           && (!ak.hasAny(['primaryImageIndex']) || (d.primaryImageIndex is int && d.primaryImageIndex >= 0 && d.primaryImageIndex < 20))
           && (!ak.hasAny(['imageUrls','spotImages']) || validOwnerImages());
       }
       match /spots/{spotId} {
         allow read: if true;                       // pending hiding = T30
         allow create: if validSpotCreate();
         allow update: if isAdmin() || isReviewAppend() || isOwnerEdit();
         allow delete: if isAdmin();
       }

       // ---------- users ----------
       function userClientKeys() {
         return ['uid','email','photoURL','profilePictureURL','profileBannerURL','savedSpots','fcmTokens',
                 'language','notificationsEnabled','notificationSettings','lastTokenUpdate','lastLoginAt','createdAt'];
       }
       function validNotifSettings(s) {
         return s is map && s.keys().hasOnly(['spotApproved','spotReviewed','newPendingSpot'])
           && (!('spotApproved' in s) || s.spotApproved is bool)
           && (!('spotReviewed' in s) || s.spotReviewed is bool)
           && (!('newPendingSpot' in s) || s.newPendingSpot is bool);
       }
       function validUserFields(d, ak) {
         return (!ak.hasAny(['uid']) || d.uid == request.auth.uid)
           && (!ak.hasAny(['email']) || d.email == '' || d.email == request.auth.token.get('email', ''))
           && (!ak.hasAny(['photoURL']) || isStr(d.photoURL, 0, 2048))
           && (!ak.hasAny(['profilePictureURL']) || isStr(d.profilePictureURL, 0, 2048))
           && (!ak.hasAny(['profileBannerURL']) || isStr(d.profileBannerURL, 0, 2048))
           && (!ak.hasAny(['savedSpots']) || (d.savedSpots is list && d.savedSpots.size() <= 1000))
           && (!ak.hasAny(['fcmTokens']) || (d.fcmTokens is list && d.fcmTokens.size() <= 100))
           && (!ak.hasAny(['language']) || d.language in ['hu','en','de'])
           && (!ak.hasAny(['notificationsEnabled']) || d.notificationsEnabled is bool)
           && (!ak.hasAny(['notificationSettings']) || validNotifSettings(d.notificationSettings))
           && (!ak.hasAny(['lastTokenUpdate']) || isStr(d.lastTokenUpdate, 0, 64))
           && (!ak.hasAny(['lastLoginAt']) || d.lastLoginAt == request.time)
           && (!ak.hasAny(['createdAt']) || d.createdAt == request.time);
       }
       match /users/{userId} {
         allow get: if isSelf(userId);
         allow list: if false;
         allow create: if isSelf(userId)
           && request.resource.data.keys().hasOnly(userClientKeys())
           && validUserFields(request.resource.data, request.resource.data.keys());
         allow update: if isSelf(userId)
           && changed().hasOnly(userClientKeys())
           && validUserFields(request.resource.data, changed());
         allow delete: if false;
       }

       // ---------- server-maintained ----------
       match /publicProfiles/{uid} { allow read: if true; allow write: if false; }
       match /usernames/{name}     { allow read: if true; allow write: if false; }
       match /admins/{adminId} {
         allow get: if isSelf(adminId) || isAdmin();
         allow list: if isAdmin();
         allow write: if false;
       }
       match /categories/{categoryId} {
         allow read: if true;
         allow create: if isAdmin()
           && request.resource.data.keys().hasOnly(['name','icon','createdAt'])
           && isStr(request.resource.data.name, 1, 50) && isStr(request.resource.data.icon, 1, 8)
           && request.resource.data.createdAt == request.time;
         allow update, delete: if isAdmin();
       }
       // everything else: denied (no match)
     }
   }
   ```
   If the emulator rejects a construct (for example `let` inside a function, or a `.get()` on `request.auth.token`), inline it or use the `removeAll` alternative from Context. **Do not weaken** any condition. Document such substitutions in the commit message.
2. **`storage.rules`:**
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       function validImage() {
         return request.resource.size < 5 * 1024 * 1024
           && request.resource.contentType.matches('image/(jpeg|png|webp)');
       }
       function ownerCreate(userId) {
         return request.auth != null && request.auth.uid == userId && resource == null && validImage();
       }
       match /spot-images/{fileName} { allow read: if true; allow write: if false; }            // legacy flat
       match /spot-images/{userId}/{fileName} { allow read: if true; allow create: if ownerCreate(userId); }
       match /profile-pictures/{userId}/{fileName} { allow read: if true; allow create: if ownerCreate(userId); }
       match /profile-banners/{userId}/{fileName} { allow read: if true; allow create: if ownerCreate(userId); }
     }
   }
   ```
   Update and delete are denied: nothing in the client overwrites or deletes objects (ROADMAP trap 9). Check whether `resource == null` is accepted on create in the storage emulator. If it is redundant, drop it and state that in the commit message.
3. **`firebase.json`:**
   - `"firestore": {"rules": "firestore.rules", "indexes": "firestore.indexes.json"}`;
   - `"storage": {"rules": "storage.rules"}`;
   - **delete** the whole `"hosting"` block;
   - keep `"functions"` and T04's `"emulators"` byte-identical.
4. **Test infrastructure:**
   - `vitest.rules.config.ts` sets `test: {include: ['tests/rules/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 60000}`.
   - T01's config already excludes `tests/rules/**` (verify only).
   - `tests/rules/helpers.ts`:
     - `initializeTestEnvironment({projectId: 'demo-spoton', firestore: {rules: readFileSync('firestore.rules','utf8')}, storage: {rules: readFileSync('storage.rules','utf8')}})`, with the host and port taken from the env that `emulators:exec` sets;
     - seed data via `withSecurityRulesDisabled`, covering: an approved spot owned by `alice`; a pending spot owned by `alice`; a **legacy** spot with `imageUrls` only and a legacy review containing `userEmail`; `admins/adminUid` without `role`; `admins/superUid` with `role: 'super'`; `users/alice`; `publicProfiles/alice`; `usernames/alice`;
     - `clearFirestore` / `clearStorage` in `beforeEach`.
   - `package.json`: `"test:rules": "firebase emulators:exec --only firestore,storage --project demo-spoton \"vitest run --config vitest.rules.config.ts\""`, using T04's pinned `firebase-tools`.
5. **Tests.** Each case uses `assertSucceeds` / `assertFails`. **Every** client path in the T11a/T11b tables must have an allow test, and every SEC finding needs at least one deny test.
   - **Allow:**
     - public read of `spots` (unauthenticated, including the list query `orderBy('createdAt','desc')`), `publicProfiles`, `usernames` and `categories`;
     - `spots where createdBy == alice` as alice;
     - create a pending spot (with images; with the placeholder only; without `createdByPhoto`);
     - an admin creates an approved spot;
     - append a review to a spot with reviews, to one without a `reviews` field, and to the legacy spot (the old entry still contains `userEmail`); with and without `userPhoto`; rating 1 and rating 5; a 1000-character comment;
     - owner on an approved spot: `name`, `description`, `primaryImageIndex`, `deleteSpotImage` (remove one; remove the last, giving `['/placeholder-spot.jpg']`; the legacy spot, with `spotImages: []` added);
     - admin: approve, delete, edit any field;
     - `users/alice`:
       - create with the exact T11a new-user payload (`serverTimestamp`);
       - `{lastLoginAt}`;
       - `savedSpots` `arrayUnion` and `arrayRemove`;
       - `{profilePictureURL, photoURL}`;
       - `{profileBannerURL}`;
       - the push payload with and without `notificationSettings`;
       - `{notificationsEnabled:false}`;
       - `{notificationSettings}`;
       - `fcmTokens` `arrayRemove`;
       - get own doc;
     - `admins`: get own doc, both when it exists and when it doesn't (a non-admin's own id); an admin lists the collection;
     - `categories`: an admin creates one.
   - **Deny, grouped by audit finding:**
     - **SEC-02:**
       - a non-admin creates with `status:'approved'`;
       - `createdBy` set to another uid;
       - an extra key (`reviews`, `highlighted`, `isHighlighted`, `foo`);
       - `createdAt` not equal to the server time;
       - more than 20 images; `primaryImageIndex` out of range; an invalid category or location;
       - unauthenticated create;
       - a non-admin sets `status`;
       - a non-owner edits the name;
       - the owner edits a **pending** spot;
       - the owner changes `createdBy`, `status`, `highlighted` or `isHighlighted`;
       - the owner adds an image URL;
       - a non-admin deletes.
     - **SEC-03 / SEC-05:**
       - a new review with `userEmail`, `userSpotsCount`, `customNameColor` or `customNameFont`;
       - `userId` of another user;
       - an `id` not prefixed `<uid>_`;
       - rating 0, 6, 4.5 or `'5'`;
       - a 1001-character comment;
       - a missing `createdAt`;
       - modifying an existing review; deleting one; reordering; appending two;
       - an append combined with another field change;
       - unauthenticated append.
     - **SEC-04:**
       - get another user's doc; list `users`; an unauthenticated get;
       - create or update another user's doc.
     - **SEC-08:**
       - write `admins/{self}` (create, or update the role);
       - a non-admin lists `admins` or gets another user's admin doc;
       - a non-admin creates a category.
     - **SEC-09:**
       - a user writes `username` (create and update), `customNameColor`, `customNameFont`, `highlightedSpots`, `spotsCount`, `questRewards` or `questProgress`;
       - an owner writes `spot.highlighted` or `spot.isHighlighted`.
     - **SEC-10:**
       - the owner changes `likes` or `likedBy` inside `spotImages`;
       - a non-owner rewrites `spotImages`.
     - **SEC-16:** a client writes `usernames/*` or `publicProfiles/*`.
     - **Misc:** `language:'fr'`; `notificationSettings` with an extra key; `lastLoginAt` set by the client clock; an unknown collection (read and write).
     - **SEC-11 (storage):**
       - Allow: owner JPEG, PNG and WebP under 5 MB at `spot-images/{uid}/x.jpg`, `profile-pictures/{uid}/1_x.jpg` and `profile-banners/{uid}/1_x.jpg`; unauthenticated read of the legacy `spot-images/123_a.jpg` and of a new path.
       - Deny: another uid's folder; unauthenticated upload; exactly 5 MB (5 × 1024 × 1024 bytes); `image/gif`; `text/html`; `application/octet-stream`; a write to the legacy flat path; overwriting an existing object; delete; an unknown top-level path.
6. **Diff against production** (`docs/audit/current-rules.md`). Append a section `## Comparison with repo rules (T12)`: one table row per path (spots, users, admins, publicProfiles, usernames, categories, storage paths, **and any other path the live rules mention**), with the columns "live rule", "new rule", "effect" and "does live rule allow these T11a/T11b reads?". The last column checks the reads the T11a/T11b client issues **before** these rules are deployed (ROADMAP §4: client before rules): `publicProfiles/{uid}` get (public), `usernames/{name}` get (public), `admins/{self}` get, `admins` list (admins only), and `categories` list; answer yes/no per row. If the live rules allow a collection or path that the client code in this repo does not use, list it and **stop and ask** before dropping it.
   - **Transitional rules:** if any answer is "no", also create `docs/audit/transitional-firestore.rules` = the live Firestore rules verbatim, plus **exactly** the missing read grants from that column, and nothing else. T13 deploys it before the client (runbook step 3.5). If every answer is "yes", do not create the file and say so in the comparison section.
7. **Commit body — accepted residual risks.** List these explicitly in the commit message body:
   - spot create does not validate the contents of `imageUrls` / `spotImages` elements (only list types and sizes);
   - a review's `userPhoto` may be an arbitrary URL (up to 2048 characters); mitigated by T15's CSP `img-src`.
8. **CI:** add a job `rules` to `.github/workflows/ci.yml`:
   - `actions/checkout`, `actions/setup-node` (Node 22, npm cache) and `actions/setup-java` (`distribution: temurin`, `java-version: '21'`). Pin every action by commit SHA, following T02's convention;
   - `npm ci`, then `npm run test:rules`;
   - optionally, `actions/cache` for `~/.cache/firebase/emulators`.

## Must NOT change
- Every client flow from T11a/T11b works under the rules (proved by the allow tests and `npm run test:e2e`, which T04 runs against the emulator with these rules loaded once `firebase.json` references them).
- Spots stay publicly readable, including pending ones (T30 changes that).
- Legacy data stays readable and appendable: spots with only `imageUrls`, reviews with `userEmail`, and missing optional fields.
- The functions config and emulator config in `firebase.json`; both indexes in `firestore.indexes.json`.
- No deploy. Paul runs `firebase deploy --only firestore:rules,storage` in T13's runbook.

## Acceptance
```bash
java -version 2>&1 | grep -q '"21' || echo "Java 21 required"
npm ci
npm run test:rules                   # all rules tests green
npm run verify
npm run verify:fn
npm run test:e2e                     # full app flows pass with the new rules loaded by the emulator
node -e "const f=require('./firebase.json'); if(f.hosting||!f.firestore.rules||!f.storage.rules) process.exit(1)"
grep -c "assertFails" tests/rules/*.test.ts    # sanity: deny cases exist in every file
grep -n "Comparison with repo rules (T12)" docs/audit/current-rules.md
```

## Rollback
`git revert`. Nothing is deployed by this task. For the production rollback of deployed rules, see `docs/security-rollout.md` (T13): redeploy the saved rules.

## Stop and ask Paul if…
- `docs/audit/current-rules.md` is missing or empty (D2).
- The live rules grant access to paths or collections this spec does not know about.
- The live rules reveal that some client flow relies on reading other users' data in a way not covered by T11a/T11b.
- Any chosen limit breaks known real data or users: name ≤ 100, description ≤ 2000, userName ≤ 100, `fcmTokens` ≤ 100, `savedSpots` ≤ 1000, category name ≤ 50, icon ≤ 8.
- A binding condition cannot be expressed in the rules language as it runs in the emulator.
