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

**Where this fits:** ROADMAP §4 step 4 (after the Cloud Functions deploy and the backfill, before the rules deploy).

## 2. Prerequisites

- Docker ≥ 29 and Compose v5 (`docker version`, `docker compose version`).
- Docker Buildx (`docker buildx version`): `update.sh` resolves the release digest with `docker buildx imagetools inspect`.
- The `edge` network exists (it is created and used by `cloudflared`):
  ```bash
  docker network inspect edge
  ```
- cosign v3 installed on the server (§5).
- Paul's GitHub account (`isolapaul`) has access to the private package `ghcr.io/isolapaul/spoton`.
- Server architecture is amd64 (ROADMAP Q8). On any other architecture, stop: the cosign binary name and the image platform change.

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

Any change to these requires a new tag and release (ROADMAP trap 5). Setting them in the server's `.env` does nothing.

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

### Optional, later: Dependabot for the compose file (ROADMAP Q4)

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
  - The GitHub Container Registry still requires a **classic** PAT; fine-grained tokens are not supported for it (ROADMAP Q3; sources: <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry>, <https://github.com/orgs/community/discussions/38467>). Re-check this if GitHub adds fine-grained support, and switch to a read-only fine-grained token then.
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
  - Bot Fight Mode: optional. If you enable it, re-test sign-in, feedback and push registration.
  - Caching: leave the default. `/_next/static` is immutable; the API sends `no-store`.
    Do **not** add *Cache Everything* or any cache rule that caches HTML on this hostname: cached pages would serve a stale CSP now, and would break the nonce-based CSP after T32.

## 10. Firebase and Google Cloud consoles

One-time, before switching users to the new domain (ROADMAP trap 4).

- Firebase console → Authentication → Settings → **Authorized domains** → add `spoton.isolapaul.hu`.
- Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs → *Web client (auto created by Google Service)*:
  - **Authorized JavaScript origins** += `https://spoton.isolapaul.hu`;
  - **Authorized redirect URIs** += `https://spoton.isolapaul.hu/__/auth/handler`.
- Google Cloud console → APIs & Services → Credentials → the Browser API key: if it has HTTP-referrer restrictions, add `https://spoton.isolapaul.hu/*`.
- Cloud Functions: deploy with `APP_URL=https://spoton.isolapaul.hu` (T08 parameter; see `docs/security-rollout.md`).

The `/__/auth/*` proxy to Firebase (T15) is built into the image; `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spoton.isolapaul.hu` (§3) makes the client use it.

## 11. Rollback

```bash
cd /srv/docker/spoton && ls docker-compose.yml.*.bak
cp docker-compose.yml.<timestamp>.bak docker-compose.yml && docker compose up -d
```

The newest `.bak` (written by the failed/bad update) holds the previous `tag@digest`; check with `grep -H image: docker-compose.yml.*.bak`.
The previous digest is still in GHCR, because releases never overwrite tags, and it was already verified when it was first deployed.

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
- [ ] DevTools console: no CSP errors on the flows above.
- [ ] `docker inspect spoton --format '{{json .HostConfig.PortBindings}}'` → `{}` (no published ports).

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| Status `unhealthy` | `docker logs --tail 100 spoton` |
| 502 / Bad gateway in the browser | The tunnel hostname's service must be `HTTP` → `spoton:3000`, and the container must be on the `edge` network (`docker network inspect edge`). |
| Sign-in fails with `auth/unauthorized-domain` | §10 (authorized domain, OAuth origin and redirect URI). |
| `EROFS` (read-only file system) in the logs | Something writes outside the tmpfs paths (`/tmp`, `/app/.next/cache`). Do not make the root filesystem writable; report it as a bug. |
