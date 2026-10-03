# SpotOn — server deployment runbook

How to run the signed SpotOn image on the home server behind the existing Cloudflare Tunnel, and how to update or roll it back.
Files referenced here live in `deploy/` in the repository: `docker-compose.yml`, `.env.example`, `update.sh`.
Everything in this document is a manual step for Paul. Nothing here runs automatically.

Placeholders you replace yourself: `<server>` (SSH host name of the server), `<timestamp>` (from the backup file name).

---

## 1. Overview

```
Browser
  → Cloudflare edge (TLS)
  → tunnel
  → cloudflared (docker net "edge")
  → http://spoton:3000
  → Firebase (Auth/Firestore/Storage/FCM/Functions)
```

- The container is **stateless**: all data lives in Firebase. The only server-side files are `docker-compose.yml` and `.env` in `/srv/docker/spoton/`.
- It publishes **no host ports**. Only `cloudflared` reaches it, over the external docker network `edge`.
- It runs as uid/gid 1000, with a read-only root filesystem, all capabilities dropped and `no-new-privileges`. Writes go only to two tmpfs mounts (`/tmp`, `/app/.next/cache`).
- It is pinned by tag **and** digest and labelled `com.centurylinklabs.watchtower.enable=false`, so Watchtower never touches it. Updates happen only through `./update.sh` (§7), which verifies the cosign signature first.

**Where this fits:** the container is the client half of a release. When a release also changes Cloud Functions, rules or indexes, deploy those as described in §16, in that section's order.

## 2. Prerequisites

- Docker ≥ 29 and Compose v5 (`docker version`, `docker compose version`).
- Docker Buildx (`docker buildx version`): `update.sh` resolves the release digest with `docker buildx imagetools inspect`.
- The `edge` network exists (it is created and used by `cloudflared`):
  ```bash
  docker network inspect edge
  ```
- cosign v3 installed on the server (§5).
- Paul's GitHub account (`isolapaul`) has access to the private package `ghcr.io/isolapaul/spoton`.
- Server architecture is amd64 (assumed: i5-8500T). On any other architecture, stop: the cosign binary name and the image platform change.

## 3. GitHub repository variables

GitHub → repository → Settings → Secrets and variables → Actions → **Variables** tab.
These are **variables, not secrets**: they are public client config that gets compiled into the JavaScript bundle at build time (D16). The release workflow passes them to `docker build` as build args.

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `spoton.isolapaul.hu`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `NEXT_PUBLIC_CONTROLLER_NAME` = the data controller's full name, shown on `/privacy` and `/terms` (A1)
- `NEXT_PUBLIC_CONTACT_EMAIL` = the contact e-mail shown there (public; use an address you are happy to publish)
- `NEXT_PUBLIC_MAPBOX_TOKEN` = the Mapbox **public** access token (starts with `pk.`), restricted in the Mapbox account to the URL `https://spoton.isolapaul.hu`. Required for releases (the build refuses to start without it); without it the map is a blank background. It is public by nature: every map request carries it. The old `NEXT_PUBLIC_CARTO_API_KEY` variable is no longer used and can be deleted.

The container build refuses to run without the last two (`scripts/check-public-env.mjs --production`).

Any change to these requires a new tag and release (`NEXT_PUBLIC_*` values are compiled into the bundle). Setting them in the server's `.env` does nothing.

Check that the package is **Private**: GitHub → Profile → Packages → `spoton` → Package settings.

### GitHub setup for the release pipeline (T18)

One-time settings in the GitHub repository before the first `v*` tag is pushed:

1. **Repository variables:** the 7 `NEXT_PUBLIC_FIREBASE_*` values above. Without them `release.yml` fails at the build step.
2. **Tag ruleset:** Settings → Rules → Rulesets → New tag ruleset, target `v*`. Restrict creations, updates and deletions, with only Paul on the bypass list. Why: the cosign signature proves only that `release.yml` ran for that tag, not who pushed the tag. Anyone who can push a `v*` tag can get a signed release that `update.sh` accepts.
3. **Issues enabled** (Settings → General → Features): the weekly `image-rescan` workflow opens `image-cve` issues.
4. **Allowed actions**, only if Settings → Actions → General is set to "Allow select actions": tick "Allow actions created by GitHub" (covers `actions/*`, including the nested `actions/cache` and `actions/checkout`), and allow these pinned commits:
   ```
   docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069,
   docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc,
   docker/login-action@dbcb813823bdd20940b903addbd779551569679f,
   aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25,
   aquasecurity/setup-trivy@3fb12ec12f41e471780db15c232d5dd185dcb514,
   anchore/sbom-action@3ad7283483fc7af8ff2b4ea19663c2d5ca935e26,
   sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6
   ```
   When Dependabot bumps an action, update this list too.
5. **After the first tag push:** GitHub → Profile → Packages → `spoton` → Package settings. The package must be **Private**, linked to `isolapaul/SpotOn`, and the repository must have **Actions** access (Manage Actions access), so that `image-rescan` can pull it with its read-only token.
6. **Workflow artifacts are public for 1 day.** On a public repository, the `release-image` artifact (OCI image + SBOM) of each release run can be downloaded by anyone for 1 day (`retention-days: 1`). This is accepted: it contains only public code and the public `NEXT_PUBLIC_*` values, nothing from `.env`.

### Optional, later: Dependabot for the compose file

Do this only **after** the first real release is deployed, i.e. once `deploy/docker-compose.yml` in the repository holds a real `tag@digest` instead of the all-zero placeholder. It is not set up by default.

1. Create a classic PAT with the single scope `read:packages` (same kind as §4, but a separate token) and add it as the repository **secret** `DEPENDABOT_GHCR_TOKEN` (Settings → Secrets and variables → **Dependabot** → New repository secret).
2. In `.github/dependabot.yml`, add a top-level registry:
   ```yaml
   registries:
     ghcr:
       type: docker-registry
       url: ghcr.io
       username: isolapaul
       password: "${{secrets.DEPENDABOT_GHCR_TOKEN}}"
   ```
   and this entry under `updates:`:
   ```yaml
   - package-ecosystem: docker-compose
     directory: /deploy
     schedule: { interval: weekly }
     registries: [ghcr]
   ```
3. Dependabot PRs only propose a new tag and digest for `deploy/docker-compose.yml`. Merging one does **not** deploy anything: you still deploy on the server with `./update.sh <tag>` (§7), which verifies the signature.

If Dependabot cannot authenticate to the private package, remove the entry again. Do not widen the token's scope.

## 4. GHCR login on the server

Run as `brvpaul`.

- Create a classic PAT: GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic).
  - Scope: **only** `read:packages`.
  - Expiry: 1 year. Put a calendar reminder a week before it expires.
  - The GitHub Container Registry still requires a **classic** PAT; fine-grained tokens are not supported for it (sources: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry>, <https://github.com/orgs/community/discussions/38467>). Re-check this if GitHub adds fine-grained support, and switch to a read-only fine-grained token then.
- Log in and lock down the credential file (the first command waits for you to paste the token; nothing is echoed):
  ```bash
  read -rs GHCR_PAT && echo "$GHCR_PAT" | docker login ghcr.io -u isolapaul --password-stdin && unset GHCR_PAT
  chmod 600 ~/.docker/config.json
  ```
- Note: without a credential helper, Docker stores the token base64-encoded, i.e. effectively **plaintext**, in `~/.docker/config.json` (`docker login` prints a warning about this). That is acceptable here because the token is read-only (`read:packages`) and the file is `chmod 600`. cosign reads the same file to authenticate to GHCR. If the server is ever compromised, revoke the token on GitHub.

## 5. Install cosign

cosign v3.x. The server's version must be ≥ the `cosign-release` pinned in `.github/workflows/release.yml`.

```bash
COSIGN_VERSION=v3.0.6   # = cosign-release pinned in .github/workflows/release.yml (T18)
COSIGN_SHA256=c956e5dfcac53d52bcf058360d579472f0c1d2d9b69f55209e256fe7783f4c74   # cosign-linux-amd64 of v3.0.6
cd "$(mktemp -d)" && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
  && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign_checksums.txt" \
  && grep ' cosign-linux-amd64$' cosign_checksums.txt | sha256sum -c - \
  && echo "${COSIGN_SHA256}  cosign-linux-amd64" | sha256sum -c - \
  && sudo install -m 0755 cosign-linux-amd64 /usr/local/bin/cosign && cosign version
```

Both checksum lines must print `cosign-linux-amd64: OK`: the first checks the download against the release's checksums file, the second against the SHA-256 pinned here. Otherwise nothing is installed.
When the workflow's `cosign-release` is bumped (a newer v3.x is also fine), repeat this with the new `COSIGN_VERSION` **and** its `COSIGN_SHA256` (the `cosign-linux-amd64` line of that release's `cosign_checksums.txt`).

## 6. First install

`/srv/docker` is root-owned, so the service directory is created with `sudo` and then handed to `brvpaul`.
The first command runs on the server; the `scp`/`ssh` lines run on your workstation, from a local checkout of the release tag you are about to deploy.

```bash
sudo mkdir -p /srv/docker/spoton && sudo chown brvpaul:brvpaul /srv/docker/spoton && chmod 750 /srv/docker/spoton
# from a local checkout of the release tag:
scp deploy/docker-compose.yml brvpaul@<server>:/srv/docker/spoton/docker-compose.yml
scp deploy/.env.example      brvpaul@<server>:/srv/docker/spoton/.env
scp deploy/update.sh         brvpaul@<server>:/srv/docker/spoton/update.sh
ssh -t brvpaul@<server> 'chmod 600 /srv/docker/spoton/.env && chmod 750 /srv/docker/spoton/update.sh && ${EDITOR:-nano} /srv/docker/spoton/.env'
```

In the editor, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `FEEDBACK_RECIPIENT` (the comments in the file explain each one). Wrap the password in single quotes (`SMTP_PASS='...'`): otherwise Compose expands `$` in it and treats ` #` as the start of a comment.

The copied `docker-compose.yml` still contains the placeholder `v0.0.0@sha256:000…`, so it cannot start yet. Continue with **§7 Update**: it pins the real release and starts the container.

## 7. Update (every release)

```bash
cd /srv/docker/spoton
./update.sh v2.0.2                           # tag from the release / Dependabot PR
```

A release starts when a `vX.Y.Z` tag is pushed on the commit to release; the release workflow then builds, scans, signs and publishes the image.

What the script (`deploy/update.sh`) does, in order:

1. Accepts final release tags only (`vX.Y.Z`); `-rc` images are for testing and are refused.
2. Resolves the tag to its digest in GHCR and prints it. **Compare the printed digest with the release job summary** on GitHub Actions.
3. `cosign verify`: the image signature must come from exactly `https://github.com/isolapaul/SpotOn/.github/workflows/release.yml@refs/tags/<the tag you passed>` (the release workflow run for **that** tag), issued by `https://token.actions.githubusercontent.com`. A signature made for any other tag is rejected.
4. `cosign verify-attestation --type cyclonedx`: the SBOM attestation must come from the same identity.
5. Only then: backs up `docker-compose.yml` to `docker-compose.yml.<timestamp>.bak`, pins `tag@digest` in the image line, runs `docker compose pull` and `docker compose up -d --wait --wait-timeout 120`, which fails if the new container is not healthy within 120 s.

It stops at the first failed check, before touching the compose file. **Never** deploy by hand if the script fails; find out why first.
If a check passed but `docker compose pull` then fails, the running container is unchanged, but `docker-compose.yml` already names the new release: restore the previous one with §11. If `up` fails or the new container does not become healthy in time, the script exits with an error and the new release may be running unhealthy: roll back with §11 as well.
If `update.sh` itself changes in a release, copy the new version to the server first (same `scp` line as §6, then `chmod 750`).

## 8. Health and logs

```bash
docker inspect --format '{{.State.Health.Status}}' spoton      # healthy (within ~60 s)
docker logs --tail 100 spoton
docker exec spoton /nodejs/bin/node -e 'fetch("http://127.0.0.1:3000/api/health").then(async r=>console.log(r.status,await r.text()))'   # optional probe: 200 {"status":"ok"}
```

## 9. Cloudflare Zero Trust

- Zero Trust dashboard → Networks → Tunnels → your tunnel → **Public hostnames** (newer dashboards: *Published application routes*) → Add:
  - Subdomain `spoton`, domain `isolapaul.hu`, path empty;
  - Service: type **HTTP**, URL `spoton:3000`.
- DNS: the CNAME for `spoton.isolapaul.hu` is created automatically.
- Zone recommendations (Cloudflare dashboard → `isolapaul.hu`):
  - SSL/TLS → Edge Certificates: **Always Use HTTPS** on, minimum TLS version 1.2.
  - Speed / Scrape Shield: **Rocket Loader off**, **Email Address Obfuscation off**; Web Analytics (Browser Insights) auto-inject off for this hostname; no Zaraz. Anything that injects scripts into the HTML breaks the Content-Security-Policy (T15).
  - Security → WAF → rate limiting rule (optional):
    `http.request.uri.path eq "/api/feedback" and http.request.method eq "POST"`, counted per IP, action Block.
    On the Free plan the period is 10 s, so use e.g. 3 requests / 10 s. The app's own limit (T14) stays authoritative.
  - Bot Fight Mode: **off**. It injects Cloudflare's JavaScript Detections script into the HTML, which the nonce CSP (T32) blocks unless Cloudflare adds the page's nonce. If you turn it on, load `/`, sign in with Google and register push with DevTools open: the console must show no CSP errors.
  - Caching: leave the default. `/_next/static` is immutable; the API sends `no-store`.
    Do **not** add *Cache Everything* or any cache rule that caches HTML on this hostname: cached pages would serve a stale CSP now, and would break the nonce-based CSP after T32.
  - Nonce-based CSP (T32): pages are now dynamically rendered, with a fresh script nonce per request (`Cache-Control: private, no-cache, no-store`). Container sizing is unchanged: there is a single page route.
    Anything that injects scripts into the HTML (Rocket Loader, Zaraz, Web Analytics auto-inject, Bot Fight Mode / JavaScript Detections) must stay off, or be re-tested for CSP errors in the console: under `'strict-dynamic'` an injected script without the nonce is blocked.
    Check: `curl -sI https://spoton.isolapaul.hu/` twice → two different `'nonce-…'` values, and `cf-cache-status` is not `HIT`.

## 10. Firebase and Google Cloud consoles

One-time settings for the domain (already done for `spoton.isolapaul.hu`; repeat them for any new domain).

- Firebase console → Authentication → Settings → **Authorized domains** → add `spoton.isolapaul.hu`.
- Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs → *Web client (auto created by Google Service)*:
  - **Authorized JavaScript origins** += `https://spoton.isolapaul.hu`;
  - **Authorized redirect URIs** += `https://spoton.isolapaul.hu/__/auth/handler`.
- Google Cloud console → APIs & Services → Credentials → the Browser API key: if it has HTTP-referrer restrictions, add `https://spoton.isolapaul.hu/*`.
- Cloud Functions: `APP_URL=https://spoton.isolapaul.hu` (the notification click link; saved in the git-ignored `functions/.env.<PROJECT_ID>` at the first deploy).

The `/__/auth/*` proxy to Firebase (T15) is built into the image; `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spoton.isolapaul.hu` (§3) makes the client use it.

## 11. Rollback

```bash
cd /srv/docker/spoton && ls docker-compose.yml.*.bak
cp docker-compose.yml.<timestamp>.bak docker-compose.yml && docker compose up -d
```

The newest `.bak` (written by the failed/bad update) holds the previous `tag@digest`; check with `grep -H image: docker-compose.yml.*.bak`.
The previous digest is still in GHCR, because releases never overwrite tags, and it was already verified when it was first deployed.
If the newest `.bak` still holds the `v0.0.0` placeholder (the very first install), there is no previous release: stop the container with `docker compose down` instead.

## 12. Backups

The app is stateless: all data is in Firebase. Back up only `/srv/docker/spoton/{docker-compose.yml,.env}`.
`.env` holds the SMTP password, so store the backup encrypted.

## 13. Post-deploy checklist

- [ ] `healthy` status (§8); `curl -sI https://spoton.isolapaul.hu/ | grep -i content-security-policy`.
- [ ] `curl -s https://spoton.isolapaul.hu/__/auth/handler | grep -qi firebase && echo OK || echo FAIL` (the auth proxy works).
- [ ] Google sign-in: desktop popup; iOS Safari redirect; iOS home-screen PWA.
- [ ] Map tiles in all 5 themes.
- [ ] Add a spot with an image (as a test user); the image shows.
- [ ] Push: enable notifications and trigger one (e.g. approve a test spot); the notification arrives, and clicking it opens the app.
- [ ] Feedback: send one with an image; the email arrives with subject `SpotOn_feedback`.
- [ ] `/account-deletion` opens without the install screen; `/.well-known/assetlinks.json` returns JSON (§17.3).
- [ ] DevTools console: no CSP errors on the flows above.
- [ ] `docker inspect spoton --format '{{json .HostConfig.PortBindings}}'` → `{}` (no published ports).

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| Status `unhealthy` | `docker logs --tail 100 spoton` |
| 502 / Bad gateway in the browser | The tunnel hostname's service must be `HTTP` → `spoton:3000`, and the container must be on the `edge` network (`docker network inspect edge`). |
| Sign-in fails with `auth/unauthorized-domain` | §10 (authorized domain, OAuth origin and redirect URI). |
| `EROFS` (read-only file system) in the logs | Something writes outside the tmpfs paths (`/tmp`, `/app/.next/cache`). Do not make the root filesystem writable; report it as a bug. |

## 15. Leaving Vercel (T19)

The old address `https://spot-on-rho.vercel.app` is retired in three stages. Each browser origin keeps its own
sign-in, favourites cache, install and push subscription, so users have to open the new address once themselves.

### Stage A: move banner

Only after the post-deploy checklist (§13) is green on `spoton.isolapaul.hu`.

1. Vercel → Project → Settings → Environment Variables → add `NEXT_PUBLIC_MOVED_TO` = `https://spoton.isolapaul.hu`
   (**Production** only).
2. Deployments → Redeploy the latest production deployment. It is a build-time variable: setting it without a
   redeploy does nothing.
3. Keep Vercel's `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` on `<project>.firebaseapp.com` (the `/__/auth` proxy is unused there).

The Vercel build then shows one slim banner below the top buttons ("SpotOn has a new address: spoton.isolapaul.hu",
Open and Hide). Hide hides it for good on that device. On the old domain the install overlay and the notification
prompt are switched off (owner decision). The Docker image cannot get the variable (`check-public-env.mjs --production`
rejects it), so the banner never appears on the new domain.

Check: open `https://spot-on-rho.vercel.app` → one banner and no install overlay.

Rollback: remove the variable and redeploy, or `git revert`.

### Stage B: permanent redirect (about 30 days after Stage A)

```bash
cp deploy/vercel-stage-b.json vercel.json
git add vercel.json && git commit -m "Redirect the Vercel domain to spoton.isolapaul.hu"
git push   # the branch Vercel deploys
```

Check:

```bash
curl -sI 'https://spot-on-rho.vercel.app/some/path?x=1'
# HTTP/2 308
# location: https://spoton.isolapaul.hu/some/path?x=1
```

- `vercel.json` is read only by Vercel. It has no effect on the Docker image (`.dockerignore` excludes it).
- Browsers cache a 308, so treat it as irreversible. Deleting `vercel.json` and redeploying stops new redirects,
  but browsers that cached the 308 keep redirecting; that is why Stage A runs for 30 days first.
- Old installed PWAs follow the redirect on launch.
- Push tokens for the old origin keep working until they are pruned; clicking such a notification opens the old
  URL, which redirects.

### Stage C: delete the Vercel project (about 90 days after Stage B)

Delete the Vercel project. Then, in a cleanup task, remove `vercel.json`, `deploy/vercel-stage-b.json`,
`src/components/MovedBanner.tsx`, `src/lib/movedTo.ts` (+ test), the guards in `InstallGate` and
`NotificationPrompt`, the `movedBanner*` translation keys, the `NEXT_PUBLIC_MOVED_TO` entry in `next.config.mjs`
and `e2e/moved-banner.spec.ts`.

## 16. Firebase deploys (functions, rules, indexes)

Cloud Functions, Firestore/Storage rules and indexes are deployed by hand from a checkout of the release tag, never by an agent or CI.
`<PROJECT_ID>` is the Firebase project id (Console → Project settings).

```bash
git checkout vX.Y.Z
npm --prefix functions ci && npm --prefix functions run build
npx firebase deploy --only functions --project <PROJECT_ID>            # or functions:<name> for one function
npx firebase deploy --only firestore:indexes --project <PROJECT_ID>    # wait until they show "Enabled"
npx firebase deploy --only firestore:rules,storage --project <PROJECT_ID>
```

Order, when a release needs several of them:

1. **Functions and indexes first.** A new client that calls a missing callable or runs a query without its index fails.
2. **Rules before the client when the rules only allow more** (for example a new user field such as `termsVersion`): the old client is unaffected, and the new client needs them.
3. **Rules after the client when they allow less.** Rules do not filter queries, so an old client whose query the new rules no longer allow breaks for everyone; release the client that stops making it first.
4. Never rename or drop an exported function: the old name is deleted on deploy and clients that still call it break.

Keep a copy of the rules currently in production (Console → Firestore → Rules) before replacing them, so a bad deploy can be reverted by pasting them back.


## 17. Android app (Trusted Web Activity)

The Play app is a Trusted Web Activity: a thin Android shell that opens https://spoton.isolapaul.hu full screen in Chrome. It is built with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) on the laptop from the live web manifest; the web app itself is unchanged. Listing, Data safety and content rating: [`play-store.md`](play-store.md).

Package name: **`hu.isolapaul.spoton`** (permanent; Play never allows it to change).

**Order:** the release with the Play changes (manifest `id`, maskable icons, `/.well-known/assetlinks.json`, `/account-deletion`) must be live before `bubblewrap init`, because Bubblewrap reads the live manifest.

### 17.1 One-time setup (💻 laptop, Git Bash)

```bash
npm i -g @bubblewrap/cli                 # changes the laptop: installs the CLI (never with sudo)
mkdir -p ~/spoton-android && cd ~/spoton-android
bubblewrap init --manifest=https://spoton.isolapaul.hu/manifest.json
```

The first run offers to download a JDK and the Android command-line tools: answer yes (they go into `~/.bubblewrap`). Then answer the questions:

| Question | Answer |
|---|---|
| Domain | `spoton.isolapaul.hu` |
| URL path | `/` |
| Application name | `SpotOn` |
| Short name (launcher) | `SpotOn` |
| Application ID | `hu.isolapaul.spoton` |
| Starting version code | `1` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar colour | `#0E1013` |
| Splash screen colour | `#0E1013` |
| Icon URL | `https://spoton.isolapaul.hu/icon-512x512.png` |
| Maskable icon URL | `https://spoton.isolapaul.hu/icon-maskable-512x512.png` |
| Monochrome icon URL | leave empty |
| Shortcuts | No |
| Play Billing | No |
| Geolocation delegation | No (Chrome asks for the location permission itself, as on the web) |
| Key store location | the default (`./android.keystore`) |
| Key name | `android` |
| Create a new key | Yes: your name, organisational unit and organisation (`SpotOn` for both is fine), country `HU`, then two passwords |

The **upload key** (`android.keystore` and its two passwords) signs every build you upload. Keep it outside the repository, back it up (for example in your password manager), and never commit it. If it is lost, the upload key can be reset through Play support, because Google keeps the real app signing key (Play App Signing).

### 17.2 Build and upload (💻 laptop)

```bash
cd ~/spoton-android
bubblewrap build        # changes local files: asks for the two key passwords, writes app-release-bundle.aab and app-release-signed.apk
```

Upload `app-release-bundle.aab` in Play Console → Test and release → Testing → Internal testing (or Closed testing) → Create new release. Accept **Play App Signing** when asked.

For every later version: `bubblewrap update` (raises the version code; add `--appVersionName=2.1.1` to set the visible version), then `bubblewrap build` and upload the new `.aab`. A web-only release needs no new Android build: the app always shows the live site.

### 17.3 Digital Asset Links (🌐 Play Console, then 🖥️ server)

Without asset links the app still opens, but as a Custom Tab with a URL bar. The server publishes them from the runtime setting `ANDROID_CERT_SHA256`, so no new image is needed.

1. 🌐 Play Console → your app → Test and release → App integrity → App signing: copy the **SHA-256 certificate fingerprint** of the *App signing key certificate* (`AB:CD:…`, 32 pairs). To also allow the APK you sideload from `bubblewrap build`, copy the *Upload key certificate* fingerprint as well.
2. 🖥️ Add it to `/srv/docker/spoton/.env` (changes the server config; comma-separated when there are two):

   ```bash
   cd /srv/docker/spoton
   nano .env                     # add: ANDROID_CERT_SHA256=AB:CD:...:EF   (or two, separated by a comma)
   docker compose up -d --wait   # recreates the container with the new setting; same image
   ```
3. Check (only reads):

   ```bash
   curl -s https://spoton.isolapaul.hu/.well-known/assetlinks.json
   ```

   It must show `hu.isolapaul.spoton` and your fingerprint(s). An empty `[]` means the setting is missing or malformed. Google's own check: 🌐 `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://spoton.isolapaul.hu&relation=delegate_permission/common.handle_all_urls`.

### 17.4 Check on a phone (📱 Android, after installing from the internal or closed test)

- [ ] The app opens full screen, without a URL bar (asset links work).
- [ ] Google sign-in works (through the `/__/auth` proxy) and you return to the app signed in; e-mail sign-in works.
- [ ] Turn on notifications in Settings; approve a test spot from another account: the push arrives, and tapping it opens the app.
- [ ] Location: "my location" asks for the permission once and centres the map.
- [ ] The Android back gesture behaves as expected.
- [ ] https://spoton.isolapaul.hu/account-deletion opens in a normal browser without the install screen.
