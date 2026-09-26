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
