# SpotOn — biztonsági bevezetési kézikönyv (T08–T12 élesbe)

A pontos, sorrendbe rendezett lépések, amelyeket Paul követ a szerveroldali biztonsági munka (Cloud Functions T07–T10, kliens T11a/T11b, szabályok T12) éles környezetbe való kiszállításához, biztonsági mentésekkel, ellenőrzéssel és visszaállítással.
A sorrend a ROADMAP §4, és **egyirányú** (ROADMAP trap 2): ne hagyj ki és ne rendezz át lépéseket. Minden lépés Paul manuális beavatkozása; itt semmi sem fut automatikusan.
Maga a konténer telepítése (4. lépés) a `docs/deploy.md` fájlban van. A szabályok alapállapota és auditja a `docs/audit/current-rules.md` fájlban található.

**Helykitöltők**, amelyeket magad cserélsz ki, mielőtt egy parancsot futtatnál:

| Helykitöltő | Jelentés |
|---|---|
| `<PROJECT_ID>` | az éles Firebase projekt azonosítója |
| `<BUCKET>` | az alapértelmezett Storage bucket, pl. `<PROJECT_ID>.appspot.com` vagy `<PROJECT_ID>.firebasestorage.app` (Console → Storage, a fájllista fölött látható) |
| `<PAUL_EMAIL>` | a saját bejelentkezési e-mail-címed, pontosan úgy, ahogy a telepített vészhelyzeti javításban szerepel |
| `<SA_KEY_PATH>` | a service-account kulcsfájl útvonala, a repón **kívül** |

**Konvenciók**
- Minden parancsot **bash**-ben futtass, a **repó gyökeréből**, egy naprakész `main` checkouton (`git switch main && git pull`).
- Az `npx firebase …` a repó rögzített firebase-tools verzióját (15.31.0) futtatja. Ne használj más verziójú, globálisan telepített `firebase`-t.
- A szkriptek (`scripts/*.ts`) **alapból száraz futásúak (dry-run)**, szükségük van a `--project` opcióra, és kiírnak egy `TARGET=<id> MODE=dry-run|APPLY EMULATOR=no` fejlécet. A fejlécet ellenőrizd, mielőtt a kimenet többi részét olvasnád.
- A visszaállítási fájlok a `~/spoton-rollback/` mappába kerülnek (a repón kívülre). Soha ne commitold őket.

---

## Step 0 — Vészhelyzeti szabályjavítás (Paul MÁR ALKALMAZTA 2026-09-26-án)

Itt tartjuk, hogy a sorrend auditálható maradjon. A javítás szövege a `docs/audit/current-rules.md` → "Emergency patch" alatt van.

**Mit csinált:** az `admins` és `categories` írásai `<PAUL_EMAIL>`-hez (ellenőrzött e-mail) vannak korlátozva; a Storage `spot-images/**` csak 5 MB alatti képek létrehozását engedi, felülírás vagy törlés nélkül; a Storage `spots/**` csak olvasható.
**Miért kell élesnek lennie az 1. lépés előtt:** enélkül az `admins/*` bármely bejelentkezett felhasználó által írható (LR-01). A T08 függvények megbíznak az `admins/{uid}.role` mezőben, így bárki írhatna `admins/<ownUid> {role:'super'}` dokumentumot, majd használhatná az `addAdmin` / `lookupUserByEmail` függvényeket.

Mielőtt folytatnád, ellenőrizd, hogy **még mindig él**:
- [ ] Console → Firestore → Rules: a `match /admins/{docId}` és a `match /categories/{categoryId}` mindegyikében szerepel az `allow write: if request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == '<PAUL_EMAIL>'`.
- [ ] Console → Storage → Rules: a `match /spot-images/{allPaths=**}` tartalmaz egy `allow create` szabályt az `5 * 1024 * 1024` mérettel és az `image/(jpeg|png|webp)` ellenőrzésekkel, valamint `allow update, delete: if false`-t; a `match /spots/{allPaths=**}` tartalmaz egy `allow write: if false`-t.

Ha bármelyik hiányzik, először alkalmazd újra a javítást a `docs/audit/current-rules.md` fájlból. Ne kezdd el az 1. lépést, amíg az `admins` mindenki által írható.

**Adminleltár (ezt most csináld meg, az 1. lépés előtt):**
- [ ] Console → Firestore → `admins`: írd le minden dokumentum azonosítóját és az `email` mezőjét (pl. a `~/spoton-rollback/legacy-admins.txt` fájlba; a mappát a `mkdir -p ~/spoton-rollback && chmod 700 ~/spoton-rollback` paranccsal hozd létre). Ezek a **korábbi (legacy)** admin-dokumentumok. Az azonosítóik Firestore automatikus azonosítók (20 karakter, pl. `Ab12Cd34Ef56Gh78Ij90`), nem uid-ek, így az új függvények és szabályok nem fogják felismerni őket (Paul válasza a `current-rules.md`-ben).
- [ ] **Biztonsági ellenőrzés:** az LR-01 miatt bárki létrehozhatott admin-dokumentumot a javítás előtt. Töröld most azonnal minden olyan dokumentumot, amelynek az `email`-jét nem ismered fel (a régi kliens minden felsorolt e-mailt adminként kezel). Amelyeket felismersz, tartsd meg, amíg az 5. lépés (§6) el nem készül; ezeket használja a jelenleg telepített kliens.
- [ ] **Telepített uid-kulcsú dokumentumok:** az `email` mező támadó által vezérelt, így ennek ellenőrzése nem elég. Az 1. lépés előtt továbbá:
  - töröld minden olyan dokumentumot, amelynek van `role` mezője (semmi legitim nem ír `role`-t a §3 előtt, és az új függvények megbíznak a `role == "super"`-ben);
  - minden olyan dokumentumnál, amelynek az azonosítója **nem** 20 karakteres (egy 28 karakteres azonosító egy Auth uid; a régi kliens ezek közül néhányat maga írt): Console → Authentication → keresd meg azt az uid-et. A dokumentumot csak akkor tartsd meg, ha annak a fióknak az e-mailje megegyezik a dokumentum `email`-jével **és** felismered; egyébként töröld.
  - Az eredményt (megtartott azonosítók) rögzítsd a `~/spoton-rollback/legacy-admins.txt` fájlban.

---

## §0 Előfeltételek (ellenőrzőlista)

- [ ] A Step 0 igazoltan él (fent).
- [ ] **Szüneteltesd a Vercel éles telepítéseket az összevonás (merge) előtt**, ha a Vercel abból az ágból épít, amelybe beolvasztasz (Vercel → Project → Settings → Git mutatja a Production Branch-et). Használd a Settings → Git → Ignored Build Step → "Don't build anything" beállítást (vagy válaszd le a Git repót). Máskülönben a merge az 1–3.5. lépések előtt kiszállítja az új klienst a Vercel domainre, és ott elromlik (trap 2). A konténer biztonságos: csak `v*` tagekből épül.
- [ ] A T08–T12 be van olvasztva a `main`-be; a CI zöld (`verify`, `verify:fn`, `test:rules`, `test:e2e`).
- [ ] Létezik egy release tag a függvények telepítéséhez, például:
  ```bash
  git tag security-v1 && git push origin security-v1
  ```
- [ ] A **korábbi** függvényállapot visszaállítási tagje a T07 commit (Node 22 eszközlánc, T08 előtti logika). Egy T07 előtti commit Node 20, és a telepítése blokkolva lehet. Az eredeti ág előzményében a T07 a `d38d859`; keresd meg a `git log --oneline --grep '^T07:'` paranccsal (ha az előzményt squash-merge-elték, használd az utolsó `main` commitot, amely tartalmazza a T07-et, de a T08-at nem):
  ```bash
  git tag pre-security d38d859
  git show pre-security:functions/package.json | grep '"node": "22"'   # must print a line
  git push origin pre-security
  ```
- [ ] A gyökér függőségei telepítve vannak (a szkripteknek szükségük van a gyökér `firebase-admin`-jára és a `tsx`-re, az `npx firebase`-nek pedig a rögzített CLI-re):
  ```bash
  npm ci
  npx firebase --version    # must print 15.31.0
  ```
- [ ] Bejelentkezve: `npx firebase login`. Az alábbi minden parancs explicit módon átadja a `--project <PROJECT_ID>` opciót.
- [ ] A `gcloud`, `gsutil`, `curl` és `jq` telepítve vannak (`gcloud --version`, `jq --version`), és a `gcloud auth login` megtörtént a tulajdonosi (owner) fiókoddal.
- [ ] A szkriptek hitelesítő adatai (Application Default Credentials), az alábbiak egyike:
  - egy service-account kulcs a `firebase-adminsdk-*`-hoz (Console → Project settings → Service accounts → Generate new private key), a repón kívül tárolva:
    ```bash
    chmod 600 <SA_KEY_PATH>
    export GOOGLE_APPLICATION_CREDENTIALS=<SA_KEY_PATH>
    ```
    és a bevezetés után (§10) a konzolban **törölve**;
  - vagy `gcloud auth application-default login && gcloud auth application-default set-quota-project <PROJECT_ID>`. Megjegyzés: a `getUserByEmail` (bootstrap) igényelheti az SA kulcsot.
- [ ] Nincsenek emulátor-változók ebben a shellben (a szkriptek elutasítják, ha valós projekt van velük kombinálva):
  ```bash
  unset FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST
  ```
- [ ] Az admin e-mail-címed a szabály-lépésekhez (ugyanaz az érték, mint a telepített javításban):
  ```bash
  export ADMIN_EMAIL='<PAUL_EMAIL>'
  ```
- [ ] A Blaze csomag aktív (a v2 függvényekhez szükséges).
- [ ] Helyezd a klienst karbantartási időablakba, vagy legalább tájékoztasd a felhasználókat, hogy a régi PWA-ablakok hibákat mutathatnak az átállás alatt (trap 2).

---

## §1 Biztonsági mentések (bármilyen változtatás előtt)

**Firestore export**, egy **dedikált privát bucketbe** (soha ne az alapértelmezett Storage bucketbe, `<BUCKET>`, amelynek hozzáférését az élő Storage szabályok szabályozzák):
```bash
gsutil mb -p <PROJECT_ID> -l europe-west3 -b on --pap enforced gs://<PROJECT_ID>-backups
gcloud firestore export gs://<PROJECT_ID>-backups/pre-security-$(date +%F) --project <PROJECT_ID>
```
A `-b on` engedélyezi az egységes bucket-szintű hozzáférést, a `--pap enforced` pedig blokkolja a nyilvános hozzáférést. Ha a Firestore adatbázis nem `europe-west3`-ban van, használd az ő helyét a `-l`-hez (Console → Firestore → database details). Több régiós adatbázis esetén a bucketnek több régiósnak kell lennie: `eur3` → `-l EU`, `nam5` → `-l US` (ha bizonytalan vagy, nézd meg a Firestore "Export and import data" dokumentációt). Ha a bucket már létezik (újbóli futtatás), hagyd ki a `mb` sort.

**Jelenlegi szabályok.** Nincs olyan `firebase` parancs, amely letöltené a Firestore vagy Storage szabályokat; használd a Firebase Rules REST API-t, és mentsd őket a repón kívülre:
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
Az utolsó sornak `OK: rules saved`-et kell kiírnia. Ha egy hívás meghiúsul (üres `echo`, `null`, vagy nincs `OK`), használd a tartalék megoldást: másold be a szöveget a Console → Firestore → Rules és a Console → Storage → Rules helyről abba a két fájlba, és a §10-ben jegyezd fel, melyik módszert használtad.

Hozd létre a visszaállítási konfigurációt:
```bash
echo '{"firestore":{"rules":"firestore.rules"},"storage":{"rules":"storage.rules"}}' > ~/spoton-rollback/firebase.json
```

**Hasonlítsd össze az auditált alapállapottal.** A T12 az élő szabályokra lett tervezve, **ahogy azokat a step 0 javította** (`docs/audit/current-rules.md`: "Firestore (live)" és "Storage (live)" az "Emergency patch" blokkokkal). A `docs/audit/transitional-firestore.rules` pontosan az a Firestore alapállapot plusz egy hozzáadott blokk, tehát a Firestore-hoz:
```bash
diff -wB <(grep -v '^//' docs/audit/transitional-firestore.rules | sed "s/<YOUR_ADMIN_EMAIL>/$(printf '%s' "$ADMIN_EMAIL" | sed 's/[&/\]/\\&/g')/g") ~/spoton-rollback/firestore.rules
```
(Szüksége van a §0-ból származó `ADMIN_EMAIL`-re.) Elvárt: csak `<`-vel kezdődő sorok, amelyek a `T12 transitional` kommenthez és a `match /publicProfiles/{uid}` / `match /usernames/{name}` blokkokhoz tartoznak (azok a jogosultságok, amelyekkel az élő szabályok még nem rendelkeznek). Bármely `>`-vel kezdődő sor azt jelenti, hogy az éles környezet eltér az alapállapottól. A Storage-hoz szemmel hasonlítsd össze a `~/spoton-rollback/storage.rules`-t a "Storage (live)"-val, ahol a 3. és 4. blokkot a javítás Storage blokkjai váltják fel.
A csak kommentekben vagy szóközökben lévő eltérések rendben vannak, beleértve egy olyan `<`/`>` párt, amely csak egy záró `//` kommentben tér el. **Bármely más eltérés: állj meg és kérdezz**, mert a T12 a másik verzióra lett tervezve.

---

## §2 1. lépés: a Cloud Functions telepítése

```bash
npm --prefix functions ci && npm --prefix functions run build
npx firebase deploy --only functions --project <PROJECT_ID>
```
- Amikor az `APP_URL`-t kéri, add meg a `https://spoton.isolapaul.hu`-t. Ez a `functions/.env.<PROJECT_ID>` fájlba mentődik (git-ignored; soha ne commitold). Egy `--non-interactive` telepítés e fájl nélkül meghiúsul.
- **Ha a CLI felajánlja bármely függvény törlését, válaszolj Nemet, és szakítsd meg** (trap 6: egy törölt függvény elveszett).
- Az új Firestore triggerek első telepítése meghiúsulhat, amíg az Eventarc jogosultságok elterjednek. Várj néhány percet, és futtasd újra ugyanazt a parancsot.

Ellenőrizd a Console → Functions helyen, hogy mindezek léteznek, `europe-west3`-ban, Node.js 22-n:
- `onSpotApproved`, `onReviewAdded`, `onSpotFavorited`, `onNewPendingSpot`, `highlightSpot`;
- `addAdmin`, `removeAdmin`, `lookupUserByEmail`, `syncPublicProfile`, `syncSpotsCount`, `syncAdminFlag`, `claimUsername`, `updateNameStyle`, `toggleImageLike`, `addSpotImages`, `unhighlightSpot`.

A régi kliensek továbbra is működnek, mivel a szabályok változatlanok.

---

## §3 2. lépés: a szuperadmin bootstrapolása

```bash
npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email "$ADMIN_EMAIL"
npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email "$ADMIN_EMAIL" --apply
```
A száraz futás kiírja a tervezett `admins/<uid>` dokumentumot; a második futás megírja azt.
Ellenőrizd a konzolban, hogy az `admins/<uid>` létezik (az azonosítója a te 28 karakteres Auth uid-ed, nem valamelyik legacy automatikus azonosító), és `role == "super"` szerepel benne.

---

## §4 3. lépés: profilok visszatöltése (backfill)

Száraz futás:
```bash
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> | tee ~/spoton-rollback/backfill-dry.txt
```

**Ellenőrizd az `admins invalid`-ot.** Minden `admins/{id}` dokumentum, amelynek az azonosítója nem egy létező Auth uid egyező e-maillel, `invalid admin doc: <id>` néven van felsorolva. Ennél a projektnél az **elvárt** bejegyzések a step 0 leltár legacy automatikus-azonosítójú dokumentumai (beleértve a saját régi bejegyzésedet is): ezek ismertek, és lentebb kicserélésre kerülnek.
- Hasonlítsd össze minden `invalid admin doc:` sort a `~/spoton-rollback/legacy-admins.txt`-vel.
- **Ha bármely felsorolt azonosító nincs a leltárban, vagy a §3-ból származó új `admins/<uid>`-ed fel van sorolva: állj meg és kérdezz** (ne haladj tovább a szabálytelepítés felé).
- **Ha egy felsorolt azonosító nem 20 karakteres automatikus azonosító** (például egy 28 karakteres uid, amelyet a step 0-nál megtartottál): állj meg és kérdezz, mert egy invalidként felsorolt uid-kulcsú dokumentum azt jelenti, hogy az e-mailje nem egyezik azzal a fiókkal.
- Egyébként folytasd. A többi admin elveszíti az adminjogokat az **új** kliensben, amíg újra hozzá nem adod őket a §5-ben (a jelenleg telepített kliens még mindig a legacy dokumentumokat olvassa).

**Vizsgáld át a `duplicates`, `conflicts` és `invalid`-ot** (trap 10). Minden duplikátumnál döntsd el, ki tartja meg a nevet, és a másik felhasználó `users/<uid>.username` mezőjét szerkeszd a konzolban egy egyedi, érvényes névre (`^[a-z0-9_]{3,20}$`). A tükör-trigger frissíti a `publicProfiles`-t. Ismételd a száraz futást, amíg `duplicates: 0` nem lesz. Az `invalid` bejegyzések maradhatnak: azokat a felhasználókat felszólítja a rendszer, amikor megváltoztatják a nevüket.

Alkalmazd, majd ellenőrizd:
```bash
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID> --apply
npx tsx scripts/backfill-profiles.ts --project <PROJECT_ID>
```
Az utolsó futásnak `planned writes: 0`-t kell kiírnia.
Szúrópróbaszerűen ellenőrizz néhány `publicProfiles/<uid>` dokumentumot: a `spotsCount` tartalmazza a függőben lévő (pending) spotokat (trap 7).

---

## §4.5 3.5. lépés: az átmeneti (transitional) Firestore szabályok telepítése

Csak akkor, ha a T12 létrehozta a `docs/audit/transitional-firestore.rules`-t (létrehozta). Ezek a step 0 által javított élő szabályok, szó szerint, plusz pontosan az a két olvasási jogosultság, amelyre az új kliensnek szüksége van, mielőtt a T12 szabályai élesednek: nyilvános `get` a `publicProfiles/{uid}`-on és `usernames/{name}`-en (T12 step 6). A Storage szabályokhoz ebben a lépésben **nem** nyúlunk.

**1. Tartsd meg az átmenet előtti (pre-transitional) mentést** (mostantól a `~/spoton-rollback/firestore.rules`-t a §6 felül fogja írni):
```bash
mkdir -p ~/spoton-rollback/pre-transitional
cp ~/spoton-rollback/firestore.rules ~/spoton-rollback/storage.rules ~/spoton-rollback/firebase.json ~/spoton-rollback/pre-transitional/
```

**2. Építsd fel a telepíthető fájlt.** A repó fájlja tartalmazza a `<YOUR_ADMIN_EMAIL>` helykitöltőt; az alábbi blokk behelyettesíti a `$ADMIN_EMAIL`-t (§0), és biztonságosan zár (fail closed): üres vagy be nem állított értéknél, egy megmaradt helykitöltőnél, vagy egy olyan e-mailnél, amely nem egyezik az élő javítással, törli a kimenetet, és `FAILED`-et ír ki.
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
`OK: transitional rules ready`-t kell kiírnia. A `sed` escapelés kezeli az értékben lévő `&`, `/` és `\` karaktereket (egy `&` egyébként beszúrná az illesztett helykitöltőt); az idézőjelet vagy szóközt tartalmazó e-mail elutasításra kerül, mert megtörné a szabálysztringet. A `diff docs/audit/transitional-firestore.rules ~/spoton-transitional/firestore.rules` csak a behelyettesített sorokat mutatja: a két `request.auth.token.email == '…'` sort és a helykitöltőt megnevező fejlécet. (A blokk minden ellenőrzése explicit módon lép ki: a `set -e` figyelmen kívül lenne hagyva egy `||`-t követő alhéjon (subshell) belül.)

**3. Telepítsd csak ezeket a Firestore szabályokat:**
```bash
npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-transitional/firebase.json --dry-run
npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-transitional/firebase.json
```
Hogyan van ez behatárolva (a firebase-tools 15.31.0-hoz ellenőrizve): a `-c/--config <path>` arra készteti a CLI-t, hogy azt a `firebase.json`-t használja, és annak könyvtára lesz a projektkönyvtár, így a `"rules": "firestore.rules"` a `~/spoton-transitional/firestore.rules`-ra oldódik fel, nem a repó `firestore.rules`-ára. A `--only firestore:rules` a telepítést a Firestore szabályokra korlátozza (nincs index, nincs Storage, nincsenek függvények), és az a konfiguráció amúgy sem tartalmaz mást. A `--dry-run` a szerveren lefordítja a szabályokat kiadás nélkül; a második parancs kiadja őket.

Ellenőrizd: a Console → Firestore → Rules mutatja a `publicProfiles` / `usernames` blokkokat, és még mindig a step 0 `admins` / `categories` blokkokat.
A régi kliensek továbbra is működnek (csak olvasások lettek hozzáadva).
Visszaállítás: `npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/pre-transitional/firebase.json`.

---

## §5 4. lépés: a kliens telepítése

Kövesd a `docs/deploy.md`-t (T16–T18; beleértve annak §10 egyszeri konzolbeállításait az új domainhez) a `https://spoton.isolapaul.hu`-hoz, és telepítsd újra a Vercelt **ugyanabból a commitból** (ne állítsd be még a `NEXT_PUBLIC_MOVED_TO`-t; az a 7. lépés). Ha a §0-ban szüneteltetted a Vercelt, most engedélyezd újra a build lépést (vagy csatlakoztasd újra a Gitet), telepíts, ellenőrizd, hogy a Vercel telepítés commit SHA-ja megegyezik a konténer release commitjával, és futtasd a bejelentkezés / értékelés-hozzáadás füstpróbát a Vercel URL-en is.

**Füstpróba az új domainen:**
- [ ] jelentkezz be; változtasd meg a felhasználónevet;
- [ ] Paul látja az admin fület; egy normál fiók nem;
- [ ] adj hozzá egy spotot fényképpel (függőben lévő (pending) lesz);
- [ ] hagyd jóvá Paulként;
- [ ] adj hozzá egy értékelést; adj egy fényképet egy meglévő spothoz;
- [ ] kiemelés (highlight) (egy ≥ 3 szintű fiókkal);
- [ ] engedélyezd az értesítéseket, majd jelentkezz ki.

**Ne várd ebben az időablakban** (a §6-ig): hogy egy admin törölje **egy másik felhasználó** spotját. Az élő törlési szabály az `admins/{token.email}`-t ellenőrzi (LR-09), amelynek egyetlen admin-dokumentum sem felel meg; ez már ma is így van az éles környezetben. Ez a végleges szabályok után (§6) működik.

**Add hozzá újra a többi admint** (a step 0 leltárból azokat, akiket még szeretnél): Paulként, Profile → Admin fül → hozzáadás e-mail alapján. Ez az `addAdmin` callable-t hívja, amely `admins/{uid}`-t ír `role: "admin"` értékkel. Az adott személynek legalább egyszer be kellett jelentkeznie (különben "User not found"). Ellenőrizd, hogy minden újra hozzáadott admin látja a függőben lévő (pending) fület az új kliensben.

---

## §6 5. lépés: a végleges szabályok telepítése

Csak azután, hogy a 4. lépés mindenhol él (trap 1): a konténer az új domainen **és** a Vercel az új buildet szolgálja ki.

Futtasd újra a §1 **szabály**-mentési parancsokat (a `mkdir` … `OK: rules saved` blokkot, majd a `firebase.json` sort); az élő szabályok megváltozhattak. Mivel a §4.5 alkalmazva lett, a mentett Firestore szabályok most a `~/spoton-transitional/firestore.rules`-szal egyeznek, nem a §1 alapállapottal (ellenőrizd a `diff -wB ~/spoton-transitional/firestore.rules ~/spoton-rollback/firestore.rules` paranccsal, nem várható kimenet). Ez elvárt: mostantól ezek a visszaállítási célpont, mert az új kliensnek szüksége van azok olvasási jogosultságaira.

```bash
npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID> --dry-run
npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID>
```
Ez a repó `firebase.json`-ját használja, tehát a repó `firestore.rules`-át és `storage.rules`-át (T12) telepíti.

Azonnal ismételd meg a §5 füstpróbát, plusz:
- [ ] adminként törölj egy másik fiók által létrehozott teszt-spotot (most működik);
- [ ] egy újra hozzáadott admin továbbra is látja a függőben lévő (pending) fület, és jóvá tud hagyni.

Figyeld 24–48 órán át:
- Console → Firestore → Usage (biztonsági szabály kiértékelések: engedélyezett / megtagadott / hibák);
- Cloud Monitoring metrika `firestore.googleapis.com/rules/evaluation_count` `result=DENY`-re szűrve;
- kliens-jelentések.

Elvárt: kis, egyenletes megtagadás-csordogálás a régi PWA-ablakoktól (trap 2). Egy felhasználói folyamathoz köthető kiugrás azt jelenti, hogy **állítsd vissza a szabályokat** (§9), és jelentsd.

**Takarítsd ki a legacy admin-dokumentumokat**, amint a végleges szabályok élnek, a füstpróba sikeres, és a kívánt adminok újra hozzá lettek adva: Console → Firestore → `admins` → töröld minden legacy automatikus-azonosítójú dokumentumot a step 0 leltárból. Az új szabályok alatt ezek semmit sem adnak. **Ne** törölj olyan dokumentumot, amelynek az azonosítója egy Auth uid, és van `role` mezője (azok a jelenlegi adminok).

---

## §7 6. lépés: az értékelések PII-jének eltávolítása

Csak a §6 után. Amíg a T12 szabályok nem élnek, a régi kliensek még mindig írhatnak `userEmail`-t az új értékelésekbe, így a korábbi eltávolítás értelmetlen, és nem biztonságos rá támaszkodni.

```bash
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID>
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --apply
npx tsx scripts/strip-review-pii.ts --project <PROJECT_ID> --check; echo "exit=$?"
```
- A száraz futás csak számokat ír ki: `spots scanned`, `spots to update`, `reviews stripped`, `writes committed`, `retries`.
- Az `--apply` eltávolítja a `userEmail`, `userSpotsCount`, `customNameColor` és `customNameFont` mezőket minden beágyazott értékelésből, megtartva minden más kulcsot és az értékelések sorrendjét. Csak a `reviews` íródik újra, helyben, így semmilyen értesítési vagy újraszámolási trigger nem sül el. Minden írást a spot utolsó frissítési ideje véd; ha egy értékelés egyidejűleg lett hozzáadva, a köteg (batch) újraolvasásra és újrapróbálásra kerül (legfeljebb háromszor).
- A `--check`-nek `check: OK`-t és `exit=0`-t kell kiírnia. Egy második száraz futás `spots to update: 0`-t mutat.
- Ha az `--apply` így végződik: `failed: … busy spot(s) still failing their precondition` (exit 3), valaki éppen értékelte azokat a spotokat abban a pillanatban. Semmi nem veszett el; futtasd az `--apply`-t újra. Az `--check` 1-es kilépése azt jelenti, hogy PII maradt; bármely módban a 3-as kilépés azt jelenti, hogy a szkript meghiúsult (olvasd el az üzenetet).

Ez a lépés visszafordíthatatlan, kivéve a §1 export visszaállításával, tehát ne állítsd vissza.

---

## §8 7. lépés és utána

Vercel Stage A / Stage B és a Vercel projekt törlése (T19; `docs/deploy.md` §15), majd a T30 kliens, amelyet a T30 szabályok követnek. Lásd a `docs/ROADMAP.md` §4 7–8. lépéseit.

### §8.1 8. lépés: függőben lévő (pending) spotok elrejtése (T30), előbb a kliens, azután a szabályok

Legalább 24 órás eltéréssel két telepítés, ebben a sorrendben (trap 1: a szabályok nem szűrik a lekérdezéseket). A régi kliens **az összes** spotot egyetlen szűretlen lekérdezéssel olvassa, amelyet a T30 szabályok megtagadnak: egy frissen betöltött régi kliens a **betöltő képernyőn** marad (a betöltési kapuja arra a lekérdezésre vár), egy már megnyitott régi ablak pedig megtartja a meglévő spotjait, de nem kap frissítést. A `status` mező nélkül tárolt spotokat (csak régi adatokból lehetséges; a létrehozási szabály megköveteli) függőben lévő (pending) spotként kezeli: csak a létrehozójuk és az adminok látják.

A kliens-telepítéstől szándékozott változás (ROADMAP Q7): egy **másik** felhasználó függőben lévő (pending) spotja, amelyet valaki kedvencelt, többé nem jelenik meg a Kedvencei között. A tulajdonosok továbbra is látják a saját függőben lévő spotjaikat; az adminok továbbra is mindent látnak.

1. **Index, azután kliens.** Előbb telepítsd az új indexet (a régi kliens nem használja, így ez ártalmatlan):
   ```bash
   npx firebase deploy --only firestore:indexes --project <PROJECT_ID>
   ```
   Ha a CLI felajánlja indexek **törlését** (olyanoké, amelyek léteznek az éles környezetben, de nem a `firestore.indexes.json`-ban), válaszolj **Nemet**, szakítsd meg és kérdezz. A Console → Firestore → Indexes ekkor mindkét `spots` indexet **Enabled** állapotban kell mutassa (az építés percektől órákig tart):
   - `createdBy ↑ createdAt ↓` (új, T30: a saját-spotok lekérdezés);
   - `status ↑ createdAt ↓` (meglévő: a jóváhagyott-spotok lekérdezés). Ha ez hiányzik az éles környezetben, állj meg és kérdezz.

   Ezután telepítsd a konténert egy olyan commitból, amely tartalmazza a T30 klienst (`docs/deploy.md`). Ha a Vercel még mindig kiszolgálja az appot (Stage A), telepítsd újra a Vercelt is ugyanabból a commitból, megtartva a `NEXT_PUBLIC_MOVED_TO`-t; a Stage B (308 átirányítás) vagy Stage C után a Vercelnek semmire sincs szüksége. (Az engedélyezett index nélkül a bejelentkezett felhasználók saját-spotok figyelője (listener) `The query requires an index` hibával hiúsul meg a DevTools konzolban; a térképet ez nem érinti.) Füstpróba:
   - [ ] kijelentkezve: a térkép mutatja a jóváhagyott spotokat, nincsenek függőben lévő (sárga) jelölők;
   - [ ] egy normál fiók: Profile → My Spots mutatja a saját függőben lévő spotját; a térkép továbbra is elrejti;
   - [ ] egy admin: függőben lévő jelölők a térképen és a Pending Approval fül a számlálójával;
   - [ ] nincsenek `permission` vagy `index` hibák a DevTools konzolban.
2. **Várj legalább 24 órát**, hogy a régi kliens nyitott lapjai és PWA-ablakai újratöltődjenek.
3. **Szabályok.** Mentsd az élő szabályokat egy külön mappába: futtasd a §1 **szabály**-mentési blokkot (`mkdir` … `OK: rules saved`) minden `~/spoton-rollback`-et `~/spoton-rollback/pre-t30`-ra cserélve, majd
   ```bash
   echo '{"firestore":{"rules":"firestore.rules"}}' > ~/spoton-rollback/pre-t30/firebase.json
   diff -wB ~/spoton-rollback/pre-t30/firestore.rules firestore.rules
   ```
   A `diff` csak a T30 változásokat kell mutassa: a `spots` `allow read` szabályt és a kommentjét, valamint a fejléc-komment sort. Bármely más eltérés: állj meg és kérdezz. Azután:
   ```bash
   npx firebase deploy --only firestore:rules --project <PROJECT_ID> --dry-run
   npx firebase deploy --only firestore:rules --project <PROJECT_ID>
   ```
   Ismételd meg az 1. lépés füstpróbáját, plusz: egy normál fiók Kedvencei továbbra is mutatják a jóváhagyott kedvenceit.
4. **Figyeld** a Firestore megtagadásokat 24–48 órán át (mint a §6-ban: Console → Firestore → Usage, és `firestore.googleapis.com/rules/evaluation_count` `result=DENY`-vel). Elvárt: kis csordogálás a régi ablakoktól, amelyek nem töltődtek újra (beragadt betöltő képernyő vagy elavult spotok, amíg újra nem töltődnek). Egy felhasználói folyamathoz köthető kiugrás azt jelenti, hogy állítsd vissza.
5. **Visszaállítás:**
   - Szabályok: `npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/pre-t30/firebase.json` (azonnali).
   - Kliens: csak a szabályok visszaállítása **után** (a T30 előtti kliens nem működik a T30 szabályok alatt); ezután irányítsd a `docker-compose.yml`-t vissza az előző digestre.
   - Az új index ártalmatlan, és maradhat.

---

## §9 Visszaállítás (komponensenként, a legújabbal kezdve)

Soha ne állíts vissza a step 0 elé: az alábbi minden visszaállítási célpont már tartalmazza a vészhelyzeti javítást.

- **T30 szabályok és kliens (§8.1):** lásd a §8.1 5. lépését (előbb a szabályok, azután a kliens).
- **Szabályok (§6):**
  ```bash
  npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID> --config ~/spoton-rollback/firebase.json
  ```
  Ez azonnal visszaállítja a §6-ban mentett szabályokat (az átmeneti Firestore szabályokat és a javított Storage szabályokat). Az azóta írt adatok kompatibilisek.
- **Kliens (§5):** irányítsd a `docker-compose.yml`-t vissza az előző image digestre (`docs/deploy.md` §11); telepítsd újra a Vercel korábbi telepítését. **Csak amíg a régi szabályok élnek**, mert a régi kliensek elromlanak a T12 szabályok alatt.
- **Átmeneti szabályok (§4.5):**
  ```bash
  npx firebase deploy --only firestore:rules --project <PROJECT_ID> --config ~/spoton-rollback/pre-transitional/firebase.json
  ```
  Visszaállítja a §1 alapállapotot. Csak amíg a régi kliens él, vagy a kliens visszaállítása után (az új kliensnek szüksége van az átmeneti olvasási jogosultságokra).
- **Függvények (§2):**
  ```bash
  git checkout pre-security
  npm ci && npm --prefix functions ci && npx firebase deploy --only functions --project <PROJECT_ID>
  git checkout main && npm ci
  ```
  Fogadd el csak az új függvények törlését, és **csak azután**, hogy a kliens vissza lett állítva.
- **Bootstrap (§3):** töröld az `admins/<uid>`-t a konzolban, de csak a kliens visszaállítása után (a régi kliens a `NEXT_PUBLIC_ADMIN_EMAIL`-t használja). Tartsd meg addig a legacy admin-dokumentumokat; a régi kliens olvassa őket.
- **Backfill (§4):** nincs szükség visszaállításra (additív mezők és gyűjtemények).
- **PII-eltávolítás (§7):** tervezetten nem visszafordítható.

---

## §10 Végső ellenőrzőlista

| Lépés | Kész (dátum, kézjegy) |
|---|---|
| Step 0 vészhelyzeti javítás igazoltan él; adminleltár elkészült; ismeretlen admin-dokumentumok törölve | |
| §0 előfeltételek; `pre-security` tag pusholva | |
| §1 Firestore export; szabályok mentve (módszer: REST API / konzolmásolás); alapállapot összehasonlítva | |
| §2 függvények telepítve; mind a 16 függvény Node 22-n, `europe-west3`-ban | |
| §3 szuperadmin bootstrapolva | |
| §4 backfill alkalmazva; `planned writes: 0`; `admins invalid` = csak legacy dokumentumok | |
| §4.5 átmeneti szabályok telepítve | |
| §5 kliens él az új domainen és a Vercelen; füstpróba; adminok újra hozzáadva | |
| §6 végleges szabályok telepítve; füstpróba; 24–48 órás figyelés tiszta; legacy admin-dokumentumok törölve | |
| §7 PII-eltávolítás alkalmazva; `--check` exit 0 | |
| §8.1 T30 index engedélyezve, majd T30 kliens; ≥ 24 órával később T30 szabályok telepítve; füstpróba; figyelés tiszta | |

Azután:
- [ ] Amint a bevezetés igazoltan stabil, hagyd, hogy a biztonsági mentések N nap után lejárjanak (te választod meg az N-t, például 30):
  ```bash
  echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > ~/spoton-rollback/lifecycle.json
  gsutil lifecycle set ~/spoton-rollback/lifecycle.json gs://<PROJECT_ID>-backups
  ```
  vagy töröld őket közvetlenül a `gsutil rm -r gs://<PROJECT_ID>-backups/pre-security-<date>` paranccsal.
- [ ] Töröld a service-account kulcsot: Console → Project settings → Service accounts → Manage service account permissions → a `firebase-adminsdk-*` fiók → Keys → törlés; majd töröld a helyi fájlt (`rm <SA_KEY_PATH>`) és `unset GOOGLE_APPLICATION_CREDENTIALS`.
- [ ] A `functions/.env.<PROJECT_ID>` nincs commitolva: a `git ls-files functions | grep '\.env'` csak a `functions/.env.demo-spoton`-t írja ki.
- [ ] A `git status` tiszta.
- [ ] Archiváld a `~/spoton-rollback/` és `~/spoton-transitional/` mappákat (a repón kívül, privátan).

---

## §11 Hibaelhárítás

| Tünet | Ellenőrzés / teendő |
|---|---|
| A **jelenleg telepített (régi)** app néha nem töltődik be a bejelentkezés után (a step 0 után jelentve) | Valószínűleg **BUG-24**, nem a javítás: a betöltő képernyő beragadhat, amikor a térkép készenléti időzítőjét egy újrarenderelés megszakítja (`docs/audit/code-review.md`). Ez időzítésfüggő, egy újratöltés általában segít, és a javítás (T04) a step 4 klienssel érkezik. A step 0 javítás csak az `admins`, `categories` és Storage `spot-images` / `spots` írásait korlátozza, és a régi kliens betöltés közben egyiket sem teszi. Ellenőrzéshez: nyisd meg a DevTools → Console-t a beragadt oldalon. A `FirebaseError: Missing or insufficient permissions` szabály-megtagadást jelent; ilyen hiba hiánya BUG-24-et jelent. Ellenőrizd a Console → Firestore → Usage-t is (biztonsági szabály kiértékelések: megtagadott), és a Storage szabályok figyelését az akkori megtagadásokra. |
| Egy megtagadásról **bizonyítottan** kiderül, hogy egy szabályváltozásból ered | Állítsd vissza azt a változást: a §4.5 vagy §6 után használd a §9-et. A step 0 javításhoz nincs helyi fájl: a Console → Firestore (vagy Storage) → Rules az előzménypaneljében megtartja a publikált verziókat; nyisd meg a 2026-09-26 előtti verziót, hasonlítsd össze, és csak azt a részt publikáld, aminek vissza kell mennie. **Soha** ne nyisd meg újra az `admins` írásait minden bejelentkezett felhasználó számára (LR-01), és soha, amíg a T08 függvények telepítve vannak. Jelentsd a megtagadást. |
| A régi PWA-ablakok jogosultsági hibákat mutatnak a §6 után | Elvárt (trap 2). A felhasználó újratölti az oldalt, vagy újratelepíti a PWA-t az új domainről. |
| Egy szkript ezt írja ki: `refusing: real project … must not be combined with emulator env` | Emulátor-változók vannak beállítva ebben a shellben. Futtasd a §0 `unset` sorát, vagy nyiss egy új shellt. |
| Egy szkript jogosultsági vagy kvótahibával hiúsul meg | Használd a §0 SA kulcsát a `gcloud` felhasználói hitelesítő adatai helyett. |
| A §1 REST hívások semmit vagy `null`-t adnak vissza | Használd a konzolmásolásos tartalék megoldást, és jegyezd fel a §10-ben. |
| Az `npx firebase deploy` függvények törlését kéri | Válaszolj **Nemet**, és szakítsd meg (trap 6), kivéve a §9 függvény-visszaállításban. |
| A `strip-review-pii.ts` ezt jelenti: `still failing its precondition after 3 retries` | Éppen most adnak értékeléseket azokhoz a spotokhoz. Várj, és futtasd újra az `--apply`-t; idempotens, és csak azokat a spotokat írja újra, amelyeknek még szüksége van rá. |
