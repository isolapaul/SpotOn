# Live Firebase Security Rules — snapshot and audit

**Copied:** 2026-09-26, pasted by Paul from the Firebase console (production).
**Purpose:** T12's prerequisite. It is the baseline the new `firestore.rules` and `storage.rules` are compared against, and the rollback target (see `docs/security-rollout.md`, T13).
The rules below are verbatim; the comments are Paul's originals in Hungarian.

## Firestore (live)

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- SEGÉDFÜGGVÉNYEK ---
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // --- 1. FELHASZNÁLÓK (Users) ---
    match /users/{userId} {
      allow read: if true;
      allow create, update: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // --- 2. ADMINOK (Admins) ---
    match /admins/{email} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // --- 3. HELYEK (Spots) ---
    match /spots/{spotId} {
      allow read: if true;
      
      // Létrehozás: Bárki, aki be van lépve
      allow create: if isAuthenticated();
      
      // Frissítés: Engedjük a bejelentkezett usereknek (kliens oldalon szűrünk)
      allow update: if isAuthenticated();
      
      // Törlés: Tulajdonos vagy Admin
      allow delete: if isAuthenticated() && 
                    (resource.data.createdBy == request.auth.uid || 
                     exists(/databases/$(database)/documents/admins/$(request.auth.token.email)));
    }
    
    // --- 4. KATEGÓRIÁK (Categories) - EZ HIÁNYZOTT! ---
    // Ezért szállt el a "Felfedezés" és az "Add Spot"
    match /categories/{categoryId} {
      allow read: if true; // Mindenki láthatja a kategóriákat
      allow write: if isAuthenticated(); // Admin/User létrehozhatja (később szigorítható)
    }

    // --- 5. KEDVENCEK (Favorites) - EZ IS HIÁNYZOTT! ---
    // Ezért szállt el a "Kedvencek" fül
    match /favorites/{favoriteId} {
      allow read, write: if isAuthenticated();
    }

    // --- 6. ÉRTÉKELÉSEK (Reviews) - EZ IS HIÁNYZOTT! ---
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // --- 7. ÉRTESÍTÉSEK (Notifications) ---
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
    }
    
    // --- 8. MINDEN MÁS TILTÁSA ---
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Storage (live)

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // 1. Profilképek
    match /profile-pictures/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // 2. Profil Bannerek
    match /profile-banners/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // 3. HELYEK KÉPEI (JAVÍTVA!)
    // A hibaüzeneted szerint a 'spot-images' mappába töltesz, nem a 'spots'-ba.
    match /spot-images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null; // Bárki feltölthet, aki be van lépve
    }
    
    // (Opcionális: Hagyjuk meg a régit is, ha esetleg máshol azt használnád)
    match /spots/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 4. Minden más tiltása alapból
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Audit of the live rules (2026-09-26)

These findings confirm the rules-dependent items in `security-review.md`. Anyone can sign in: Google sign-in and email sign-up are both open. So "signed-in user" below means **anyone on the internet**.

| ID | Severity | Path | Live rule | Concrete exploit |
|---|---|---|---|---|
| LR-01 | **Critical** | `admins/{id}` | `allow write: if isAuthenticated()` | Any user can create `admins/<anything>`. **In the currently deployed client, that makes them an admin:** its admin list is read from this collection. Consequences today:<br>• they can approve pending spots and get the admin UI;<br>• they can delete admins, including Paul's entry.<br>**After T08's functions are deployed:** a user could write `admins/<ownUid> {role:'super'}` and then call `addAdmin` / `lookupUserByEmail`, which returns any user's uid, username and photo by email. That makes this escalation worse, so the admins write **must be locked before the functions are deployed** (see the emergency patch below and ROADMAP §4 step 0). |
| LR-02 | **Critical** | `spots/{id}` | `allow update: if isAuthenticated()` | Any user can do any of these to any spot:<br>• set `status:'approved'`;<br>• rewrite name, description or images;<br>• delete or alter other users' reviews and likes;<br>• set `createdBy` to themselves, which then lets them delete the spot through the "owner" branch of the delete rule. |
| LR-03 | High | `spots/{id}` | `allow create: if isAuthenticated()` | Self-approval: create a spot with `status:'approved'` and any `createdBy`. |
| LR-04 | High | `users/{userId}` | `allow read: if true` | **Unauthenticated** read of every user document: email, `fcmTokens`, `savedSpots` and settings. It is a collection-wide read, so all users can be dumped. |
| LR-05 | High | `users/{userId}` | owner may write **any** field | A user can give themselves server-trusted fields. This matters once T09 and T10 are live:<br>• `spotsCount: 999` → level 5 perks;<br>• `questRewards.valentine2026.highlightBonus: 99` → unlimited highlights;<br>• `username` → bypasses the unique-username registry;<br>• `customNameFont` → a font value that is not on the allowlist.<br>T12's field allowlist fixes this. |
| LR-06 | Medium | `categories/{id}` | any signed-in user may write | Anyone can add, rename or delete categories. |
| LR-07 | Medium | Storage `spot-images/**`, `spots/**` | any signed-in user may write **anywhere** under these paths, with no size or type limit | Unlimited uploads of arbitrary files (HTML, SVG, executables, very large files). They are served publicly from the Firebase Storage domain and billed to Paul. Anyone can also overwrite or delete other users' spot images (paths are not user-scoped; SEC-11). |
| LR-08 | Low | Storage `profile-pictures/{uid}/**`, `profile-banners/{uid}/**` | owner-only, but no size or type limit | A user can upload large or non-image files to their own folder. |
| LR-09 | Info | `spots` delete rule | `exists(admins/$(request.auth.token.email))` | This checks for an admin document **keyed by email**, but the current client writes `admins/{uid}` (`useUserStore.addAdmin`). Admins added through the UI therefore probably do **not** pass this check, so they can only delete spots they "own". Legacy admin docs may also be keyed by email: the rule's `{email}` wildcard name and the old functions' email lookup both suggest it. See "Open question for Paul". |
| LR-10 | Info | `favorites`, `reviews`, `notifications` | allowed for signed-in users | **No code in this repo uses these collections** (checked with grep). Favorites live in `users.savedSpots`, reviews are embedded in `spots`, and notifications are local (zustand). Any stale data there stays readable or writable. The new rules deny them. Nothing in the app breaks, but see the open question. |

### Emergency patch (recommended now, before any other rollout step)

This works with the **currently deployed** client, so nothing visible breaks. It closes LR-01, LR-06 and most of LR-07 immediately. Replace only these blocks in the console.

**Firestore:** replace blocks 2 (`admins`) and 4 (`categories`):
```
    match /admins/{docId} {
      allow read: if true;   // the current client lists admins; T12 restricts this
      allow write: if request.auth != null
                   && request.auth.token.email_verified == true
                   && request.auth.token.email == '<YOUR_ADMIN_EMAIL>';   // your own login email
    }
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email_verified == true
                   && request.auth.token.email == '<YOUR_ADMIN_EMAIL>';
    }
```

**Storage:** replace blocks 3 and 4 (`spot-images`, `spots`):
```
    match /spot-images/{allPaths=**} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.size < 5 * 1024 * 1024
                    && request.resource.contentType.matches('image/(jpeg|png|webp)');
      allow update, delete: if false;   // the current client never overwrites or deletes objects
    }
    match /spots/{allPaths=**} {
      allow read: if true;
      allow write: if false;            // unused by the code
    }
```

Side effect: uploads of GIF or other non-JPEG/PNG/WebP files are rejected. The current client passes the photo's original type through compression, and a GIF would fail. That is acceptable.

`LR-02`–`LR-05` cannot be closed without breaking the currently deployed client: it writes reviews, likes and images directly and reads other users' documents. They are closed by the planned rollout: new functions and client first, then T12's full rules.

### Open question for Paul
Are your existing `admins` documents keyed by **email** or by **uid**? Check in the Firebase console: Firestore → `admins`, and look at the document IDs.

After the functions are deployed, only uid-keyed docs count as admins. Your own entry is created by `scripts/bootstrap-super-admin.ts`. Any other email-keyed admin would lose admin rights, and `scripts/backfill-profiles.ts` reports them as `admins invalid: N` (ROADMAP §4 step 3 stops there). You re-add them from the Profile → Admin tab once you are super admin.

Is there any data in `favorites`, `reviews` (top-level) or `notifications` that you want to keep? The app does not use these collections, and T12's rules will make them inaccessible to clients. The data is not deleted.

### Paul's answers (2026-09-26)
- **Unused collections** (`favorites`, top-level `reviews`, `notifications`): nothing is needed, so T12 denies them. The data is not deleted.
- **Admin doc IDs:** they look like `3duKwjbZQJjSmdLPhvWg`, which is 20 characters. That is a Firestore **auto-generated ID**. It is neither a Firebase Auth UID (28 characters) nor an email. So the existing `admins` docs were created with auto IDs, most likely from an older client version or by hand in the console, and **the new functions and rules will not recognise them as admins.**
  - Plan: `bootstrap-super-admin.ts` creates Paul's `admins/{uid}` with `role: 'super'`. `backfill-profiles.ts` reports every other admin doc under `admins invalid: N`. Paul reviews that list and re-adds only the admins he still wants, from Profile → Admin (the `addAdmin` callable writes `admins/{uid}`). The legacy auto-ID docs can then be deleted in the console.
  - **Security check for Paul:** because of LR-01, anyone could have created an admin doc. Look at the `email` field of every document in `admins`, and delete any entry you do not recognise.

---

## Comparison with repo rules (T12)

**Baseline ("live rule")** is the production rules **as patched** with the emergency patch above, which Paul has deployed (2026-09-26): `admins` and `categories` writes locked to Paul's verified email; Storage `spot-images/**` limited to image creates under 5 MB with no update or delete; Storage `spots/**` read-only. **"New rule"** is the repo's `firestore.rules` / `storage.rules` (T12). The last column checks the reads the T11a/T11b client issues **before** T12's rules are deployed (ROADMAP §4: client before rules): `publicProfiles/{uid}` get, `usernames/{name}` get, `admins/{self}` get, `admins` list (admins only) and `categories` list. Rows that serve none of these reads are marked "n/a" (the other reads the new client issues there, such as `spots` and `users/{self}`, are allowed by the live rules).

### Firestore

| Path | Live rule (patched) | New rule (T12) | Effect | Live rule allows the T11a/T11b reads? |
|---|---|---|---|---|
| `spots/{id}` | read: all · create/update: any signed-in user · delete: owner, or `admins/{token.email}` exists | read: all (pending hiding is T30) · create: validated key set, `createdBy == uid`, `status 'pending'` (admins may use `'approved'`), `createdAt == request.time` · update: admin, **or** a single valid review append, **or** owner edit of an **approved** spot (`name`, `description`, `primaryImageIndex`, image removals only) · delete: admin | Closes LR-02, LR-03, SEC-02/03/05/09/10. Owners can no longer delete their own spots (the UI only offers delete to admins). LR-09's email-keyed admin check is gone: admins are `admins/{uid}`. | n/a |
| `users/{uid}` | read: **anyone** (incl. list) · create/update/delete: owner, any field | get: owner only · list: nobody · create/update: owner, client key allowlist with value checks · delete: nobody | Closes LR-04, LR-05, SEC-04/09. Server-only fields (`username`, `customName*`, `highlightedSpots`, `quest*`, `spotsCount`) become Admin-SDK only. | n/a (`users/{self}` get: yes) |
| `admins/{id}` | read: all · write: Paul's verified email only | get: self or any admin · list: admins · write: nobody (the `addAdmin`/`removeAdmin` callables use the Admin SDK) | Closes SEC-08 reads (admin list no longer public). Legacy auto-ID admin docs grant nothing. | **yes** (`admins/{self}` get and `admins` list: `read: if true`) |
| `categories/{id}` | read: all · write: Paul's verified email only | read: all · create: admin, keys `name, icon, createdAt` (1–50 / 1–8 chars, server time) · update/delete: admin | LR-06 stays closed; write access widens from Paul only to every `admins/{uid}` holder (the UI still offers it to the super admin only). | **yes** (`categories` list) |
| `publicProfiles/{uid}` | no match → denied by the catch-all | get: all · list: nobody · write: nobody (functions only) | New server-maintained collection (T09). No list, so neither usernames nor the `isAdmin` mirror can be enumerated. | **no** → transitional grant |
| `usernames/{name}` | no match → denied by the catch-all | get: all · list: nobody · write: nobody (functions only) | New server-maintained collection (T09). No list, so neither usernames nor the `isAdmin` mirror can be enumerated. | **no** → transitional grant |
| `favorites/{id}` | read/write: any signed-in user | no match → denied | Unused by the code (LR-10). Paul confirmed on 2026-09-26: deny; data is not deleted. | n/a |
| `reviews/{id}` (top-level) | read: all · write: any signed-in user | no match → denied | Unused by the code (reviews are embedded in `spots`). Paul confirmed: deny. | n/a |
| `notifications/{id}` | read/update/delete: `resource.data.userId == uid` · create: any signed-in user | no match → denied | Unused by the code (notifications are local). Paul confirmed: deny. | n/a |
| `/{document=**}` | read/write: denied | no match → denied | Unchanged. | n/a |

### Storage

| Path | Live rule (patched) | New rule (T12) | Effect | Live rule allows the T11a/T11b reads? |
|---|---|---|---|---|
| `profile-pictures/{uid}/**` | read: all · write (create, overwrite, delete): owner, no size/type limit | `profile-pictures/{uid}/{file}`: read: all · create: owner, `< 5 MB`, `image/(jpeg\|png\|webp)`, not over an existing object · no update/delete | Closes LR-08. Only one path segment below `{uid}` (the client writes `{ts}_{name}`). | n/a |
| `profile-banners/{uid}/**` | same as profile pictures | same as profile pictures | Closes LR-08. | n/a |
| `spot-images/**` | read: all · create: any signed-in user, `< 5 MB` image, **any path** · no update/delete | `spot-images/{file}` (legacy flat): read-only · `spot-images/{uid}/{file}`: read: all · create: owner, same size/type limits · no update/delete | Closes the rest of LR-07 and SEC-11: uploads are user-scoped. | n/a |
| `spots/**` | read: all · write: denied | no match → denied (read too) | **Unused by the code** (grep: the client only uses `spot-images/`, `profile-pictures/`, `profile-banners/`). Reads through the SDK are denied; tokenized download URLs stored in documents are served by Firebase without rule evaluation. Decided in ROADMAP Q13: fully denied. If something under Storage `spots/` turns out to be needed through the SDK, add a read-only `match /spots/{allPaths=**} { allow read: if true; }` before deploying. | n/a |
| `/{allPaths=**}` | read/write: denied | no match → denied | Unchanged. | n/a |

### Transitional rules
Two answers in the last column are **no**: `publicProfiles/{uid}` and `usernames/{name}` get. The T11a client needs both (profile badges and name styles; username availability check), and the live rules deny them. So T12 adds `docs/audit/transitional-firestore.rules`: the live Firestore rules as patched, verbatim, plus exactly these two public `get` grants (no list). T13 deploys it at rollout step 3.5, before the client (step 4). Paul replaces `<YOUR_ADMIN_EMAIL>` with the same email as in the deployed patch. No Storage transitional rules are needed: the new client's reads and its `spot-images/{uid}/…` uploads are allowed by the patched Storage rules. Known gap during the window (already true in production today, LR-09): the live spot delete rule checks `admins/{token.email}`, so an admin cannot delete another user's spot until the final rules (step 5) are deployed; smoke tests between steps 3.5 and 5 must not expect admin delete to work.
