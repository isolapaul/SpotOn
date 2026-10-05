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

The container build refuses to run without the last three (`scripts/check-public-env.mjs --production`).

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
./update.sh v2.1.0                           # tag from the release / Dependabot PR
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
- [ ] `/account-deletion` opens without the first-run tour; `/.well-known/assetlinks.json` returns JSON (§17.3).
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
Open and Hide). Hide hides it for good on that device. On the old domain the first-run tour has no install step and the
notification prompt is switched off (owner decision). The Docker image cannot get the variable (`check-public-env.mjs --production`
rejects it), so the banner never appears on the new domain.

Check: open `https://spot-on-rho.vercel.app` → the tour has no install step; after it, one banner.

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
`src/components/MovedBanner.tsx`, `src/lib/movedTo.ts` (+ test), the old-domain guards in `components/onboarding/OnboardingFlow` (install step) and
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

### 16.1 Release v2.1.0 (one time, in this order)

v2.1.0 needs a new build variable, new indexes, new and removed functions, a one-time data migration and new rules.
Do the steps one after another, without a long pause between 4 and 7: until the migration runs, levels are not stored, and until the rules are deployed, the new app cannot save push registrations, bios or lists.

1. **Before tagging:** create the repository variable `NEXT_PUBLIC_MAPBOX_TOKEN` (§3). The release build refuses to start without it.
2. **Terms (A1):** the new terms version (`TERMS_VERSION` 2026-09-30) asks everyone to accept again. Terms §8 promises an e-mail announcement 15 days before changes take effect: send it before the release.
3. Push the tag `v2.1.0` and wait for the release workflow (§7).
4. Indexes, then functions, from a checkout of the tag (§16):
   ```bash
   npx firebase deploy --only firestore:indexes --project <PROJECT_ID>   # wait until all show "Enabled"
   npx firebase deploy --only functions --project <PROJECT_ID>
   ```
   The CLI asks whether to delete `onSpotApproved` and `onReviewAdded`: answer **yes**. They are merged into `onSpotUpdated`; left running, they would send every approval and review notification twice.
5. XP migration (item 5), right after the functions deploy. It needs Application Default Credentials for the project (`gcloud auth application-default login`). Dry run first, read the plan (look for users whose level floor is unexpectedly high), then apply:
   ```bash
   npm ci
   npx tsx scripts/migrate-xp.ts --project <PROJECT_ID>            # dry run: prints the plan
   npx tsx scripts/migrate-xp.ts --project <PROJECT_ID> --apply    # writes it
   ```
   Running it again later only fixes differences.
6. Server: `./update.sh v2.1.0` (§7).
7. Rules, right after the client is live (they allow less for the old client):
   ```bash
   npx firebase deploy --only firestore:rules --project <PROJECT_ID>
   ```
   `storage.rules` did not change in this release.
8. Post-deploy checks (§13). In addition: the map shows the Mapbox styles in all five themes; an admin approves a test spot (the owner gets the inbox note and one push); a follow, a reply and a list save work.


## 17. Android and iOS apps (Capacitor)

The store apps are [Capacitor](https://capacitorjs.com) shells (`capacitor.config.ts`, `mobile/android`, `mobile/ios`) that load https://spoton.isolapaul.hu full screen. A web-only release needs no new app build: the apps always show the live site. Native code covers what a WebView cannot do on its own:

| Feature | How |
|---|---|
| Google sign-in | The native Google SDK (Google refuses OAuth in WebViews); the web SDK signs in with its ID token (`src/store/nativeAuth.ts`). |
| Push | Native FCM; the device token goes into `users/{uid}.fcmTokens`, which the functions already send to (`src/store/nativePush.ts`). |
| Android back, spot links, sharing | `src/hooks/useNativeShell.ts` (App Links), `useShareSpot` (system share sheet). |
| Offline | `mobile/www/offline.html` when the site cannot be loaded. |

Package name / bundle ID: **`hu.isolapaul.spoton`** (permanent; the stores never allow it to change). Listing, Data safety and content rating: [`play-store.md`](play-store.md).

**A new app build is needed** when `mobile/`, `capacitor.config.ts` or a `@capacitor*` package changes. The live site talks to every installed app version, so never remove a Capacitor plugin from `package.json` (and never ship a web release that calls a plugin method an older app lacks) while those versions are in use.

### 17.1 Firebase (🌐 Firebase console, one time)

1. Project settings → Your apps → **Add app → Android**: package `hu.isolapaul.spoton`. Add the **SHA-1 and SHA-256** fingerprints of the upload key (§17.2, `keytool -list -v -keystore upload.keystore`) and, after the first Play upload, of the *App signing key* (Play Console → App integrity). Google sign-in only works for builds signed with a listed key. Download `google-services.json` to `mobile/android/app/` (git-ignored; never commit it).
2. **Add app → Apple**: bundle ID `hu.isolapaul.spoton`. Download `GoogleService-Info.plist` and install it on the Mac with `bash mobile/scripts/ios-firebase-config.sh ~/Downloads/GoogleService-Info.plist` (copies it into the Xcode project and sets the Google sign-in URL scheme; git-ignored).
3. Project settings → Cloud Messaging → Apple app configuration: upload an **APNs auth key** (.p8, from developer.apple.com → Keys, with "Apple Push Notifications service") with its Key ID and Team ID.
4. Authentication → Settings → Authorized domains: no change (the app runs on `spoton.isolapaul.hu`). The Google provider is already on.

### 17.2 Android build (💻 laptop: Android Studio, which brings its own JDK and SDK)

```bash
npm ci
npx cap sync android        # changes generated files under mobile/android (git-ignored)
```

Upload key, once (the passwords and the file stay outside git; back them up, e.g. in the password manager):

```bash
keytool -genkeypair -v -keystore ~/spoton-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

`mobile/android/keystore.properties` (git-ignored):

```properties
storeFile=/home/<you>/spoton-upload.keystore
storePassword=...
keyAlias=upload
keyPassword=...
```

Build (the visible version is `package.json`'s; raise the version code on every upload):

```bash
cd mobile/android
./gradlew bundleRelease -PversionCode=2     # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleDebug                     # → app/build/outputs/apk/debug/app-debug.apk (adb install …)
```

`npm run cap:android` opens the project in Android Studio instead. Upload the `.aab` in Play Console → Test and release → Testing → Internal testing (or Closed testing) → Create new release, and accept **Play App Signing**.

CI (`.github/workflows/mobile.yml`) builds the same on every change to the native shell and keeps the APK and bundle as the run's artifact `spoton-android`. With these repository secrets the bundle is uploadable as is: `GOOGLE_SERVICES_JSON_BASE64` (`base64 -w0 google-services.json`), `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; its version code is the run number. Without them it uses the demo Firebase config in `mobile/ci` (the app starts, sign-in and push do not work) and the bundle is unsigned.

For a test against a local server: `CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync android` (the Android emulator's address of the laptop); run `npx cap sync android` again before a release build.

### 17.3 Digital Asset Links (🌐 Play Console, then 🖥️ server)

Asset links let spot links (`https://spoton.isolapaul.hu/spot/…`) open in the app (Android App Links). The server publishes them from the runtime setting `ANDROID_CERT_SHA256`, so no new image is needed.

1. 🌐 Play Console → your app → Test and release → App integrity → App signing: copy the **SHA-256 certificate fingerprint** of the *App signing key certificate* (`AB:CD:…`, 32 pairs). To also allow builds you install yourself, copy the *Upload key certificate* fingerprint as well.
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

### 17.4 iOS build (💻 Mac with Xcode 16.3 or later, Apple Developer Program membership)

```bash
npm ci
bash mobile/scripts/ios-firebase-config.sh ~/Downloads/GoogleService-Info.plist   # §17.1, once per checkout
npm run cap:ios             # cap sync ios, then opens Xcode
```

In Xcode: target App → Signing & Capabilities → pick your team (automatic signing). Push Notifications and Background Modes → Remote notifications come from `App/App.entitlements` and `Info.plist`. Set the build number (General → Build) higher than the last upload, then Product → Archive → Distribute App → App Store Connect.

CI builds an unsigned simulator app (artifact `spoton-ios-simulator`) as a compile check; with the secret `GOOGLE_SERVICE_INFO_PLIST_BASE64` it uses the project's Firebase config.

**Before submitting to the App Store, decide:**
- *Guideline 4.8:* an app that offers Google sign-in must also offer *Sign in with Apple* (or an equivalent privacy-focused login). The e-mail sign-in may not count. Sign in with Apple is not built.
- *Guideline 4.2 (minimum functionality):* Apple rejects apps that are only a website in a frame. Native sign-in, push, location and the share sheet help, but a rejection is possible.

### 17.5 Check on a phone (📱 Android, after installing from the internal or closed test; same on iPhone)

- [ ] The app opens full screen with the splash on the dark background; the map runs under the status bar without covering controls.
- [ ] Google sign-in opens the system account picker and you return signed in; e-mail sign-in works; sign-out, then Google sign-in offers the account choice again.
- [ ] Turn on notifications in Settings (the system dialog asks once); approve a test spot from another account: the push arrives with the SpotOn icon, and tapping it opens the app. With the app open, the message lands in the notification centre.
- [ ] Location: "my location" asks for the permission once and centres the map.
- [ ] Add a spot with a photo from the gallery and one taken with the camera.
- [ ] The Android back gesture closes panels step by step and, on the bare map, sends the app to the background.
- [ ] Share a spot: the system share sheet opens. Tap a shared spot link in another app: SpotOn opens on that spot (after §17.3).
- [ ] Airplane mode, then start the app: the offline page shows; "Try again" works once back online.
- [ ] The first-run tour has no install step.
- [ ] https://spoton.isolapaul.hu/account-deletion opens in a normal browser without the first-run tour.
