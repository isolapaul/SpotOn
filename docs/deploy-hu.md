# SpotOn — szerver telepítési runbook

Hogyan futtasd az aláírt SpotOn image-et az otthoni szerveren a meglévő Cloudflare Tunnel mögött, és hogyan frissítsd vagy állítsd vissza.
Az itt hivatkozott fájlok a repository `deploy/` könyvtárában találhatók: `docker-compose.yml`, `.env.example`, `update.sh`.
Ebben a dokumentumban minden manuális lépés Paul számára. Semmi nem fut le automatikusan.

Helykitöltők, amelyeket magadnak kell kicserélned: `<server>` (a szerver SSH host neve), `<timestamp>` (a backup fájl nevéből).

---

## 1. Áttekintés

```
Browser
  → Cloudflare edge (TLS)
  → tunnel
  → cloudflared (docker net "edge")
  → http://spoton:3000
  → Firebase (Auth/Firestore/Storage/FCM/Functions)
```

- A container **stateless** (állapotmentes): minden adat a Firebase-ben él. Az egyetlen szerveroldali fájl a `docker-compose.yml` és az `.env` a `/srv/docker/spoton/` könyvtárban.
- **Nem tesz közzé** host portokat. Csak a `cloudflared` éri el, a külső `edge` docker hálózaton keresztül.
- uid/gid 1000 alatt fut, csak olvasható root filesystemmel, minden capability eldobva és `no-new-privileges`. Írás csak két tmpfs mountra megy (`/tmp`, `/app/.next/cache`).
- Tag **és** digest szerint van rögzítve, valamint `com.centurylinklabs.watchtower.enable=false` címkével ellátva, így a Watchtower soha nem nyúl hozzá. A frissítések kizárólag a `./update.sh` (§7) segítségével történnek, amely előbb ellenőrzi a cosign aláírást.

**Hova illik ez:** ROADMAP §4 4. lépés (a Cloud Functions deploy és a backfill után, a rules deploy előtt).

## 2. Előfeltételek

- Docker ≥ 29 és Compose v5 (`docker version`, `docker compose version`).
- Docker Buildx (`docker buildx version`): az `update.sh` a release digestet a `docker buildx imagetools inspect` paranccsal oldja fel.
- Az `edge` hálózat létezik (a `cloudflared` hozza létre és használja):
  ```bash
  docker network inspect edge
  ```
- cosign v3 telepítve a szerveren (§5).
- Paul GitHub fiókja (`isolapaul`) hozzáfér a privát `ghcr.io/isolapaul/spoton` csomaghoz.
- A szerver architektúrája amd64 (ROADMAP Q8). Bármely más architektúrán állj meg: a cosign bináris neve és az image platform megváltozik.

## 3. GitHub repository változók

GitHub → repository → Settings → Secrets and variables → Actions → **Variables** fül.
Ezek **változók, nem titkok (secrets)**: publikus kliens konfigurációk, amelyek build időben belefordulnak a JavaScript bundle-be (D16). A release workflow build argumentumként adja át őket a `docker build` parancsnak.

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `spoton.isolapaul.hu`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

Ezek bármely módosítása új taget és release-t igényel (ROADMAP trap 5). Ha a szerver `.env` fájljában állítod be őket, annak nincs hatása.

Ellenőrizd, hogy a csomag **Private**: GitHub → Profile → Packages → `spoton` → Package settings.

### GitHub beállítás a release pipeline-hoz (T18)

Egyszeri beállítások a GitHub repositoryban, mielőtt az első `v*` taget push-olnád:

1. **Repository változók:** a fenti 7 `NEXT_PUBLIC_FIREBASE_*` érték. Nélkülük a `release.yml` a build lépésnél elbukik.
2. **Tag ruleset:** Settings → Rules → Rulesets → New tag ruleset, cél `v*`. Korlátozd a létrehozásokat, frissítéseket és törléseket, csak Paul legyen a bypass listán. Miért: a cosign aláírás csak azt bizonyítja, hogy a `release.yml` lefutott arra a tagre, nem azt, hogy ki push-olta a taget. Bárki, aki `v*` taget tud push-olni, kaphat aláírt release-t, amelyet az `update.sh` elfogad.
3. **Issues engedélyezve** (Settings → General → Features): a heti `image-rescan` workflow `image-cve` issue-kat nyit.
4. **Allowed actions**, csak akkor, ha a Settings → Actions → General "Allow select actions" értékre van állítva: pipáld be az "Allow actions created by GitHub" opciót (lefedi az `actions/*` elemeket, beleértve a beágyazott `actions/cache` és `actions/checkout` elemeket), és engedélyezd ezeket a rögzített commitokat:
   ```
   docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069,
   docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc,
   docker/login-action@dbcb813823bdd20940b903addbd779551569679f,
   aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25,
   aquasecurity/setup-trivy@3fb12ec12f41e471780db15c232d5dd185dcb514,
   anchore/sbom-action@3ad7283483fc7af8ff2b4ea19663c2d5ca935e26,
   sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6
   ```
   Amikor a Dependabot megemel egy actiont, frissítsd ezt a listát is.
5. **Az első tag push után:** GitHub → Profile → Packages → `spoton` → Package settings. A csomagnak **Private**-nak kell lennie, az `isolapaul/SpotOn`-hoz kötve, és a repositorynak **Actions** hozzáféréssel kell rendelkeznie (Manage Actions access), hogy az `image-rescan` a csak olvasható tokenjével le tudja húzni.
6. **A workflow artifactok 1 napig publikusak.** Publikus repositoryn az egyes release futtatások `release-image` artifactját (OCI image + SBOM) bárki letöltheti 1 napig (`retention-days: 1`). Ez elfogadott: csak publikus kódot és a publikus `NEXT_PUBLIC_*` értékeket tartalmazza, semmit az `.env`-ből.

### Opcionális, később: Dependabot a compose fájlhoz (ROADMAP Q4)

Ezt csak **azután** csináld, hogy az első valódi release telepítve van, azaz ha a repositoryban lévő `deploy/docker-compose.yml` már valódi `tag@digest`-et tartalmaz a csupa nullás helykitöltő helyett. Alapból nincs beállítva.

1. Hozz létre egy klasszikus PAT-ot az egyetlen `read:packages` scope-pal (ugyanolyan fajta, mint a §4, de külön token), és add hozzá `DEPENDABOT_GHCR_TOKEN` repository **secret**-ként (Settings → Secrets and variables → **Dependabot** → New repository secret).
2. A `.github/dependabot.yml`-ben adj hozzá egy legfelső szintű registry-t:
   ```yaml
   registries:
     ghcr:
       type: docker-registry
       url: ghcr.io
       username: isolapaul
       password: "${{secrets.DEPENDABOT_GHCR_TOKEN}}"
   ```
   és ezt a bejegyzést az `updates:` alá:
   ```yaml
   - package-ecosystem: docker-compose
     directory: /deploy
     schedule: { interval: weekly }
     registries: [ghcr]
   ```
3. A Dependabot PR-ek csak új taget és digestet javasolnak a `deploy/docker-compose.yml`-hez. Egy ilyen mergelése **nem** telepít semmit: a szerveren továbbra is a `./update.sh <tag>` paranccsal (§7) telepítesz, amely ellenőrzi az aláírást.

Ha a Dependabot nem tud autentikálni a privát csomaghoz, távolítsd el újra a bejegyzést. Ne bővítsd a token scope-ját.

## 4. GHCR bejelentkezés a szerveren

`brvpaul`-ként futtatva.

- Hozz létre egy klasszikus PAT-ot: GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic).
  - Scope: **csak** `read:packages`.
  - Lejárat: 1 év. Tegyél egy naptáremlékeztetőt egy héttel a lejárta elé.
  - A GitHub Container Registry továbbra is **klasszikus** PAT-ot igényel; a fine-grained tokenek nem támogatottak hozzá (ROADMAP Q3; források: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry>, <https://github.com/orgs/community/discussions/38467>). Ellenőrizd ezt újra, ha a GitHub hozzáadja a fine-grained támogatást, és akkor válts át csak olvasható fine-grained tokenre.
- Jelentkezz be és zárold le a credential fájlt (az első parancs arra vár, hogy beillesszd a tokent; semmi nem íródik ki):
  ```bash
  read -rs GHCR_PAT && echo "$GHCR_PAT" | docker login ghcr.io -u isolapaul --password-stdin && unset GHCR_PAT
  chmod 600 ~/.docker/config.json
  ```
- Megjegyzés: credential helper nélkül a Docker base64-kódolással, azaz gyakorlatilag **plaintext** formában tárolja a tokent a `~/.docker/config.json` fájlban (a `docker login` figyelmeztetést ír erről). Ez itt elfogadható, mert a token csak olvasható (`read:packages`) és a fájl `chmod 600`. A cosign ugyanezt a fájlt olvassa a GHCR-hez való autentikáláshoz. Ha a szerver valaha kompromittálódik, vond vissza a tokent a GitHubon.

## 5. cosign telepítése

cosign v3.x. A szerver verziójának ≥-nak kell lennie, mint a `.github/workflows/release.yml`-ben rögzített `cosign-release`.

```bash
COSIGN_VERSION=v3.0.6   # = cosign-release pinned in .github/workflows/release.yml (T18)
COSIGN_SHA256=c956e5dfcac53d52bcf058360d579472f0c1d2d9b69f55209e256fe7783f4c74   # cosign-linux-amd64 of v3.0.6
cd "$(mktemp -d)" && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
  && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign_checksums.txt" \
  && grep ' cosign-linux-amd64$' cosign_checksums.txt | sha256sum -c - \
  && echo "${COSIGN_SHA256}  cosign-linux-amd64" | sha256sum -c - \
  && sudo install -m 0755 cosign-linux-amd64 /usr/local/bin/cosign && cosign version
```

Mindkét checksum sornak `cosign-linux-amd64: OK`-t kell kiírnia: az első a letöltést ellenőrzi a release checksums fájljával szemben, a második az itt rögzített SHA-256-tal szemben. Egyébként semmi nem települ.
Amikor a workflow `cosign-release`-e megemelkedik (egy újabb v3.x is jó), ismételd meg ezt az új `COSIGN_VERSION`-nel **és** annak `COSIGN_SHA256`-jával (az adott release `cosign_checksums.txt` fájljának `cosign-linux-amd64` sora).

## 6. Első telepítés

A `/srv/docker` root tulajdonú, ezért a service könyvtár `sudo`-val jön létre, majd átadásra kerül `brvpaul`-nak.
Az első parancs a szerveren fut; az `scp`/`ssh` sorok a munkaállomásodon futnak, a telepíteni kívánt release tag helyi checkoutjából.

```bash
sudo mkdir -p /srv/docker/spoton && sudo chown brvpaul:brvpaul /srv/docker/spoton && chmod 750 /srv/docker/spoton
# from a local checkout of the release tag:
scp deploy/docker-compose.yml brvpaul@<server>:/srv/docker/spoton/docker-compose.yml
scp deploy/.env.example      brvpaul@<server>:/srv/docker/spoton/.env
scp deploy/update.sh         brvpaul@<server>:/srv/docker/spoton/update.sh
ssh -t brvpaul@<server> 'chmod 600 /srv/docker/spoton/.env && chmod 750 /srv/docker/spoton/update.sh && ${EDITOR:-nano} /srv/docker/spoton/.env'
```

A szerkesztőben töltsd ki az `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` és `FEEDBACK_RECIPIENT` értékeket (a fájlban lévő kommentek elmagyarázzák mindegyiket). A jelszót tedd egyszeres idézőjelbe (`SMTP_PASS='...'`): egyébként a Compose kibontja benne a `$` jelet, és a ` #`-t komment kezdeteként kezeli.

A másolt `docker-compose.yml` még mindig a `v0.0.0@sha256:000…` helykitöltőt tartalmazza, így még nem tud elindulni. Folytasd a **§7 Frissítés** résszel: az rögzíti a valódi release-t és elindítja a containert.

## 7. Frissítés (minden release-nél)

```bash
cd /srv/docker/spoton
./update.sh v2.1.0                           # tag from the release / Dependabot PR
```

Mit csinál a szkript (`deploy/update.sh`), sorrendben:

1. Csak végleges release tageket fogad el (`vX.Y.Z`); az `-rc` image-ek tesztelésre valók, és elutasításra kerülnek.
2. Feloldja a taget a GHCR-beli digestjére és kiírja azt. **Hasonlítsd össze a kiírt digestet a release job összefoglalójával** a GitHub Actionsben.
3. `cosign verify`: az image aláírásának pontosan innen kell származnia: `https://github.com/isolapaul/SpotOn/.github/workflows/release.yml@refs/tags/<the tag you passed>` (a release workflow futtatása **arra** a tagre), kibocsátva a `https://token.actions.githubusercontent.com` által. Bármely más tagre készített aláírás elutasításra kerül.
4. `cosign verify-attestation --type cyclonedx`: az SBOM attesztációnak ugyanabból az identitásból kell származnia.
5. Csak ezután: elmenti a `docker-compose.yml`-t `docker-compose.yml.<timestamp>.bak` néven, rögzíti a `tag@digest`-et az image sorban, lefuttatja a `docker compose pull` és `docker compose up -d --wait --wait-timeout 120` parancsokat, amely elbukik, ha az új container nem lesz egészséges 120 másodpercen belül.

Az első sikertelen ellenőrzésnél megáll, mielőtt hozzányúlna a compose fájlhoz. **Soha** ne telepíts kézzel, ha a szkript elbukik; előbb derítsd ki, miért.
Ha egy ellenőrzés átment, de a `docker compose pull` ezután elbukik, a futó container változatlan, de a `docker-compose.yml` már az új release-t nevezi meg: állítsd vissza az előzőt a §11 szerint. Ha az `up` elbukik vagy az új container nem lesz időben egészséges, a szkript hibával lép ki, és az új release lehet, hogy egészségtelenül fut: szintén állítsd vissza a §11 szerint.
Ha maga az `update.sh` módosul egy release-ben, előbb másold az új verziót a szerverre (ugyanaz az `scp` sor, mint a §6, majd `chmod 750`).

## 8. Egészség és logok

```bash
docker inspect --format '{{.State.Health.Status}}' spoton      # healthy (within ~60 s)
docker logs --tail 100 spoton
docker exec spoton /nodejs/bin/node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>console.log(r.status,await r.text()))'   # optional probe: 200 {"status":"ok"}
```

## 9. Cloudflare Zero Trust

- Zero Trust dashboard → Networks → Tunnels → a tunneled → **Public hostnames** (újabb dashboardokban: *Published application routes*) → Add:
  - Subdomain `spoton`, domain `isolapaul.hu`, path üres;
  - Service: típus **HTTP**, URL `spoton:3000`.
- DNS: a `spoton.isolapaul.hu` CNAME-je automatikusan létrejön.
- Zóna ajánlások (Cloudflare dashboard → `isolapaul.hu`):
  - SSL/TLS → Edge Certificates: **Always Use HTTPS** bekapcsolva, minimum TLS verzió 1.2.
  - Speed / Scrape Shield: **Rocket Loader off**, **Email Address Obfuscation off**; Web Analytics (Browser Insights) auto-inject kikapcsolva erre a hostnévre; nincs Zaraz. Bármi, ami scripteket injektál a HTML-be, megtöri a Content-Security-Policy-t (T15).
  - Security → WAF → rate limiting szabály (opcionális):
    `http.request.uri.path eq "/api/feedback" and http.request.method eq "POST"`, IP-nként számolva, action Block.
    A Free csomagban az időszak 10 s, tehát használj pl. 3 kérés / 10 s értéket. Az app saját limitje (T14) marad a mérvadó.
  - Bot Fight Mode: **off**. A Cloudflare JavaScript Detections scriptjét injektálja a HTML-be, amit a nonce CSP (T32) blokkol, hacsak a Cloudflare nem adja hozzá az oldal nonce-át. Ha bekapcsolod, töltsd be a `/`-t, jelentkezz be Google-lel és regisztrálj push-t nyitott DevToolsszal: a konzolon nem szabad CSP hibáknak megjelenniük.
  - Caching: hagyd az alapértelmezettet. A `/_next/static` immutable; az API `no-store`-t küld.
    **Ne** adj hozzá *Cache Everything*-et vagy bármely cache szabályt, amely HTML-t cache-el ezen a hostnéven: a cache-elt oldalak most elavult CSP-t szolgálnának ki, és a T32 után megtörnék a nonce alapú CSP-t.
  - Nonce alapú CSP (T32): az oldalak most dinamikusan renderelődnek, kérésenként friss script nonce-szal (`Cache-Control: private, no-cache, no-store`). A container méretezése változatlan: egyetlen page route van.
    Bárminek, ami scripteket injektál a HTML-be (Rocket Loader, Zaraz, Web Analytics auto-inject, Bot Fight Mode / JavaScript Detections) kikapcsolva kell maradnia, vagy újra kell tesztelni a konzolban CSP hibákra: `'strict-dynamic'` alatt egy nonce nélkül injektált script blokkolásra kerül.
    Ellenőrzés: `curl -sI https://spoton.isolapaul.hu/` kétszer → két különböző `'nonce-…'` érték, és a `cf-cache-status` nem `HIT`.

## 10. Firebase és Google Cloud konzolok

Egyszeri, mielőtt átváltanád a felhasználókat az új domainre (ROADMAP trap 4).

- Firebase console → Authentication → Settings → **Authorized domains** → add hozzá a `spoton.isolapaul.hu`-t.
- Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs → *Web client (auto created by Google Service)*:
  - **Authorized JavaScript origins** += `https://spoton.isolapaul.hu`;
  - **Authorized redirect URIs** += `https://spoton.isolapaul.hu/__/auth/handler`.
- Google Cloud console → APIs & Services → Credentials → a Browser API key: ha HTTP-referrer korlátozásai vannak, add hozzá a `https://spoton.isolapaul.hu/*`-ot.
- Cloud Functions: deployolj `APP_URL=https://spoton.isolapaul.hu`-val (T08 paraméter; lásd `docs/security-rollout.md`).

A `/__/auth/*` proxy a Firebase-hez (T15) be van építve az image-be; a `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spoton.isolapaul.hu` (§3) rábírja a klienst, hogy ezt használja.

## 11. Visszaállítás (rollback)

```bash
cd /srv/docker/spoton && ls docker-compose.yml.*.bak
cp docker-compose.yml.<timestamp>.bak docker-compose.yml && docker compose up -d
```

A legújabb `.bak` (amelyet a sikertelen/rossz frissítés írt) tartalmazza az előző `tag@digest`-et; ellenőrizd a `grep -H image: docker-compose.yml.*.bak` paranccsal.
Az előző digest még mindig a GHCR-ben van, mert a release-ek soha nem írják felül a tageket, és már ellenőrizve lett, amikor először telepítették.

## 12. Backupok

Az app stateless: minden adat a Firebase-ben van. Csak a `/srv/docker/spoton/{docker-compose.yml,.env}`-t mentsd.
Az `.env` tartalmazza az SMTP jelszót, ezért a backupot titkosítva tárold.

## 13. Telepítés utáni ellenőrzőlista

- [ ] `healthy` státusz (§8); `curl -sI https://spoton.isolapaul.hu/ | grep -i content-security-policy`.
- [ ] `curl -s https://spoton.isolapaul.hu/__/auth/handler | grep -qi firebase && echo OK || echo FAIL` (az auth proxy működik).
- [ ] Google bejelentkezés: asztali popup; iOS Safari átirányítás; iOS home-screen PWA.
- [ ] Térkép csempék mind az 5 témában.
- [ ] Adj hozzá egy spotot képpel (teszt felhasználóként); a kép megjelenik.
- [ ] Push: engedélyezd az értesítéseket és váltsd ki egyet (pl. hagyj jóvá egy teszt spotot); az értesítés megérkezik, és rákattintva megnyílik az app.
- [ ] Feedback: küldj egyet képpel; az email megérkezik `SpotOn_feedback` tárggyal.
- [ ] DevTools konzol: nincs CSP hiba a fenti folyamatokon.
- [ ] `docker inspect spoton --format '{{json .HostConfig.PortBindings}}'` → `{}` (nincs közzétett port).

## 14. Hibaelhárítás

| Tünet | Ellenőrzés |
|---|---|
| `unhealthy` státusz | `docker logs --tail 100 spoton` |
| 502 / Bad gateway a böngészőben | A tunnel hostnév szolgáltatásának `HTTP` → `spoton:3000`-nak kell lennie, és a containernek az `edge` hálózaton kell lennie (`docker network inspect edge`). |
| A bejelentkezés `auth/unauthorized-domain` hibával bukik | §10 (authorized domain, OAuth origin és redirect URI). |
| `EROFS` (read-only file system) a logokban | Valami a tmpfs útvonalakon (`/tmp`, `/app/.next/cache`) kívülre ír. Ne tedd a root filesystemet írhatóvá; jelentsd bugként. |

## 15. A Vercel elhagyása (T19)

A régi cím, a `https://spot-on-rho.vercel.app`, három szakaszban kerül kivezetésre. Minden böngésző origin megtartja a saját
bejelentkezését, kedvencek cache-ét, telepítését és push feliratkozását, így a felhasználóknak egyszer maguknak kell megnyitniuk az új címet.

### A szakasz: költözés banner

Csak azután, hogy a telepítés utáni ellenőrzőlista (§13) zöld a `spoton.isolapaul.hu`-n.

1. Vercel → Project → Settings → Environment Variables → add hozzá `NEXT_PUBLIC_MOVED_TO` = `https://spoton.isolapaul.hu`
   (csak **Production**).
2. Deployments → Redeploy a legutóbbi production deploymentet. Ez egy build-idejű változó: redeploy nélküli
   beállításának nincs hatása.
3. Tartsd a Vercel `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`-jét a `<project>.firebaseapp.com`-on (a `/__/auth` proxy ott nincs használatban).

A Vercel build ekkor egy vékony bannert mutat a felső gombok alatt ("SpotOn has a new address: spoton.isolapaul.hu",
Open és Hide). A Hide véglegesen elrejti azon az eszközön. A régi domainen a telepítési overlay és az értesítési
prompt ki van kapcsolva (ROADMAP Q2). A Docker image nem kaphatja meg a változót (a `check-public-env.mjs --production`
elutasítja), így a banner soha nem jelenik meg az új domainen.

Ellenőrzés: nyisd meg a `https://spot-on-rho.vercel.app`-ot → egy banner és nincs telepítési overlay.

Visszaállítás: távolítsd el a változót és deployolj újra, vagy `git revert`.

### B szakasz: állandó átirányítás (kb. 30 nappal az A szakasz után)

```bash
cp deploy/vercel-stage-b.json vercel.json
git add vercel.json && git commit -m "Redirect the Vercel domain to spoton.isolapaul.hu"
git push   # the branch Vercel deploys
```

Ellenőrzés:

```bash
curl -sI 'https://spot-on-rho.vercel.app/some/path?x=1'
# HTTP/2 308
# location: https://spoton.isolapaul.hu/some/path?x=1
```

- A `vercel.json`-t csak a Vercel olvassa. Nincs hatása a Docker image-re (a `.dockerignore` kizárja).
- A böngészők cache-elnek egy 308-at, ezért kezeld visszafordíthatatlanként. A `vercel.json` törlése és újra deployolás megállítja az új
  átirányításokat, de a böngészők, amelyek cache-elték a 308-at, továbbra is átirányítanak; ezért fut az A szakasz előbb 30 napig.
- A régi telepített PWA-k induláskor követik az átirányítást.
- A régi origin push tokenjei addig működnek, amíg le nem takarítják őket; egy ilyen értesítésre kattintva a régi
  URL nyílik meg, amely átirányít.

### C szakasz: a Vercel projekt törlése (kb. 90 nappal a B szakasz után)

Töröld a Vercel projektet. Ezután egy cleanup taskban távolítsd el a `vercel.json`, `deploy/vercel-stage-b.json`,
`src/components/MovedBanner.tsx`, `src/lib/movedTo.ts` (+ teszt) fájlokat, az `InstallGate` és
`NotificationPrompt` guardjait, a `movedBanner*` fordítási kulcsokat, a `NEXT_PUBLIC_MOVED_TO` bejegyzést a `next.config.mjs`-ben
és az `e2e/moved-banner.spec.ts`-t.
