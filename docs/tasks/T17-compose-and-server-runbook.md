# T17 — Compose file, `.env.example`, server runbook

**Phase:** 3 · **Depends on:** T16 (T18 for the signing identity used in the runbook) · **Risk:** low · **Decisions:** D1, D3, D6, D13, D16
**Audit refs:** SEC-21

## Goal
Give Paul a copy-paste-safe way to run the signed image on his server behind the existing Cloudflare Tunnel, and to update or roll it back. That means a hardened `docker-compose.yml`, an env template with no real values, and a complete runbook (`docs/deploy.md`) that also covers the Firebase, Google and Cloudflare console steps.

## Context
Server facts (Paul):
- Debian 13, Docker 29.7, Compose v5. User `brvpaul` (uid/gid 1000) is in the `docker` group.
- Per-service compose lives in `/srv/docker/<service>/docker-compose.yml`. `/srv/docker` is root-owned, so creating a directory needs `sudo`.
- The `cloudflared` container runs on the external docker network `edge`. The tunnel is dashboard-managed (token), and public hostnames are added in the Cloudflare Zero Trust dashboard. Other services on `edge` bind 127.0.0.1 or publish no ports.
- Watchtower runs daily at 04:00 with label opt-in. We label `com.centurylinklabs.watchtower.enable=false` explicitly (D13).
- TZ is `Europe/Budapest`. The target is `https://spoton.isolapaul.hu`.

Image facts (T16):
- distroless, `/nodejs/bin/node` entrypoint, `CMD ["server.js"]`, `/app/healthcheck.mjs`, port 3000.
- Writes go only to `/tmp` and `/app/.next/cache`.

Other facts:
- Runtime secrets are read only by `/api/feedback` (T14): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FEEDBACK_RECIPIENT`. `NEXT_PUBLIC_*` are build-time only (D16) and do nothing in `.env`.
- Signing (T18): keyless cosign from `.github/workflows/release.yml` on tag pushes. The certificate identity is `https://github.com/isolapaul/SpotOn/.github/workflows/release.yml@refs/tags/vX.Y.Z`, and the issuer is `https://token.actions.githubusercontent.com`.
- The following was verified in the spec author's sandbox with Compose v5.1.1:
  - `docker compose config` works **without a daemon**;
  - the long `env_file: [{path, required}]` syntax validates;
  - tmpfs options `size=…,uid=1000,gid=1000,mode=…` work with `--read-only -u 1000:1000` on distroless.
- GHCR authentication: GitHub Packages documents support for **classic** personal access tokens only. Use a classic PAT with the single scope `read:packages`. Fine-grained PATs did not support the container registry as of the author's knowledge; re-check this (see Stop and ask).
- Google sign-in on the new domain needs (ROADMAP trap 4):
  - Firebase authorized domain;
  - OAuth client redirect URI `https://spoton.isolapaul.hu/__/auth/handler` and JS origin;
  - the T15 proxy;
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spoton.isolapaul.hu` at build time.
- Cloudflare features that inject scripts into HTML break the CSP (T15): Rocket Loader, Email Address Obfuscation, Web Analytics / Browser Insights auto-injection, and Zaraz.

## Files
- Create: `deploy/docker-compose.yml`, `deploy/.env.example`, `docs/deploy.md`
- Modify: `.github/dependabot.yml` (add a docker-compose entry)

## Steps
1. **`deploy/docker-compose.yml`**, exactly this content. The header comment explains the digest placeholder.
   ```yaml
   # SpotOn — /srv/docker/spoton/docker-compose.yml. Runbook: docs/deploy.md
   # Pin BOTH tag and digest; update only after `cosign verify` (docs/deploy.md §Update).
   name: spoton
   services:
     spoton:
       image: ghcr.io/isolapaul/spoton:v0.0.0@sha256:0000000000000000000000000000000000000000000000000000000000000000
       container_name: spoton
       restart: unless-stopped
       env_file:
         - path: .env
           required: true
       environment:
         TZ: Europe/Budapest
         HOSTNAME: 0.0.0.0
         PORT: "3000"
         NODE_OPTIONS: --max-old-space-size=384
       user: "1000:1000"
       read_only: true
       tmpfs:
         - /tmp:size=64m,uid=1000,gid=1000,mode=1777
         - /app/.next/cache:size=128m,uid=1000,gid=1000,mode=0755
       cap_drop: [ALL]
       security_opt:
         - no-new-privileges:true
       init: true
       mem_limit: 512m
       cpus: 1.0
       pids_limit: 256
       healthcheck:
         test: ["CMD", "/nodejs/bin/node", "/app/healthcheck.mjs"]
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 30s
       logging:
         driver: json-file
         options:
           max-size: 10m
           max-file: "3"
       labels:
         com.centurylinklabs.watchtower.enable: "false"
       networks: [edge]
       # NO ports: — reachable only by cloudflared on the "edge" network
   networks:
     edge:
       external: true
   ```
2. **`deploy/.env.example`.** Only comments and empty or example values:
   ```dotenv
   # /srv/docker/spoton/.env — runtime secrets for /api/feedback. chmod 600, owner brvpaul. Never commit.
   # NEXT_PUBLIC_* do NOT belong here: they are baked into the image at build time (GitHub repo variables).
   # SMTP server used to send feedback emails (e.g. smtp.gmail.com with an app password).
   SMTP_HOST=
   # 465 = implicit TLS; 587 = STARTTLS.
   SMTP_PORT=465
   SMTP_USER=
   # App password / SMTP password. Keep this file chmod 600.
   SMTP_PASS=
   # Where feedback is delivered. Required: without it /api/feedback answers 503.
   FEEDBACK_RECIPIENT=
   ```
3. **`.github/dependabot.yml`.** Add this and keep the existing entries:
   ```yaml
   - package-ecosystem: docker-compose
     directory: /deploy
     schedule: { interval: weekly }
     registries: [ghcr]
   ```
   Add a top-level `registries.ghcr: { type: docker-registry, url: ghcr.io, username: isolapaul, password: "${{secrets.DEPENDABOT_GHCR_TOKEN}}" }`. Document the Dependabot secret `DEPENDABOT_GHCR_TOKEN` (a classic PAT, `read:packages`) in `docs/deploy.md`.
   - Dependabot PRs only propose a new tag and digest. Paul still verifies the signature before deploying.
4. **`docs/deploy.md`.** Write these sections, in this order, with the commands verbatim. Adapt the prose, not the commands.
   1. **Overview.** A text diagram: `Browser → Cloudflare edge (TLS) → tunnel → cloudflared (docker net "edge") → http://spoton:3000 → Firebase (Auth/Firestore/Storage/FCM/Functions)`. The container is stateless.
   2. **Prerequisites.** Docker ≥ 29 and Compose v5; the `edge` network exists (`docker network inspect edge`); cosign v3 (§5); Paul's GitHub account with access to the private package.
   3. **GitHub repository variables** (Settings → Secrets and variables → Actions → *Variables*; not secrets, because they are public config compiled into the bundle):
      - `NEXT_PUBLIC_FIREBASE_API_KEY`
      - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `spoton.isolapaul.hu`
      - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
      - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
      - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
      - `NEXT_PUBLIC_FIREBASE_APP_ID`
      - `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

      Any change requires a new tag or release (ROADMAP trap 5). Also add the Dependabot secret `DEPENDABOT_GHCR_TOKEN`. Check that the package is **Private**: Profile → Packages → `spoton` → Package settings.
   4. **GHCR login on the server** (as `brvpaul`):
      - Create a classic PAT: GitHub → Settings → Developer settings → Tokens (classic), scope **only** `read:packages`, expiry 1 year, with a calendar reminder.
      - Log in and lock down the credential file:
        ```bash
        read -rs GHCR_PAT && echo "$GHCR_PAT" | docker login ghcr.io -u isolapaul --password-stdin && unset GHCR_PAT
        chmod 600 ~/.docker/config.json
        ```
      - Note: the token is stored base64 (not encrypted) in `~/.docker/config.json`. It is read-only for packages; revoke it on GitHub if the server is compromised.
   5. **Install cosign** (v3.x; the version must be ≥ the `cosign-release` pinned in `release.yml`):
      ```bash
      COSIGN_VERSION=v3.0.6   # = cosign-release pinned in .github/workflows/release.yml (T18); newer v3.x also fine
      cd /tmp && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
        && curl -fsSLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign_checksums.txt" \
        && grep ' cosign-linux-amd64$' cosign_checksums.txt | sha256sum -c - \
        && sudo install -m 0755 cosign-linux-amd64 /usr/local/bin/cosign && cosign version
      ```
   6. **First install:**
      ```bash
      sudo mkdir -p /srv/docker/spoton && sudo chown brvpaul:brvpaul /srv/docker/spoton && chmod 750 /srv/docker/spoton
      # from a local checkout of the release tag:
      scp deploy/docker-compose.yml brvpaul@<server>:/srv/docker/spoton/docker-compose.yml
      scp deploy/.env.example      brvpaul@<server>:/srv/docker/spoton/.env
      ssh brvpaul@<server> 'chmod 600 /srv/docker/spoton/.env && ${EDITOR:-nano} /srv/docker/spoton/.env'
      ```
      Then **§Update**, steps 1–4.
   7. **Update (every release):**
      ```bash
      cd /srv/docker/spoton
      TAG=v2.1.0                                   # from the release / Dependabot PR
      DIGEST=$(docker buildx imagetools inspect ghcr.io/isolapaul/spoton:$TAG | awk '/^Digest:/{print $2; exit}')
      echo "$DIGEST"                               # must equal the digest in the release job summary
      cosign verify "ghcr.io/isolapaul/spoton@$DIGEST" \
        --certificate-identity-regexp '^https://github\.com/isolapaul/SpotOn/\.github/workflows/release\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$' \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null && echo "signature OK"
      cosign verify-attestation --type cyclonedx "ghcr.io/isolapaul/spoton@$DIGEST" \
        --certificate-identity-regexp '^https://github\.com/isolapaul/SpotOn/\.github/workflows/release\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$' \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null && echo "SBOM attestation OK"
      cp docker-compose.yml "docker-compose.yml.$(date +%F-%H%M).bak"
      sed -i -E "s#^(\s*image: ghcr\.io/isolapaul/spoton):[^@]+@sha256:[0-9a-f]{64}#\1:$TAG@$DIGEST#" docker-compose.yml
      grep 'image:' docker-compose.yml
      docker compose pull && docker compose up -d
      ```
      **Never** deploy if either cosign command fails. The regexp above accepts final tags only; `-rc` images are for testing.
   8. **Health and logs:**
      ```bash
      docker inspect --format '{{.State.Health.Status}}' spoton      # healthy (within ~60 s)
      docker logs --tail 100 spoton
      docker run --rm --network edge curlimages/curl -fsS http://spoton:3000/api/health   # optional in-network probe
      ```
   9. **Cloudflare Zero Trust:**
      - Networks → Tunnels → your tunnel → **Public hostnames** (newer dashboards: *Published application routes*) → Add. Subdomain `spoton`, domain `isolapaul.hu`, path empty, service **HTTP** `spoton:3000`.
      - DNS: the CNAME is created automatically.
      - Zone recommendations:
        - SSL/TLS → Edge Certificates: **Always Use HTTPS** on, minimum TLS 1.2.
        - Speed/Scrape Shield: **Rocket Loader off**, **Email Address Obfuscation off**; Web Analytics auto-inject off for this hostname (it would break the CSP).
        - Security → WAF → rate limiting rule (optional): `http.request.uri.path eq "/api/feedback" and http.request.method eq "POST"`, per IP, block. On the Free plan the period is 10 s, so use e.g. 3 requests / 10 s. The app's own limit (T14) stays authoritative.
        - Bot Fight Mode: optional. If enabled, re-test sign-in, feedback and push registration.
        - Caching: default. `/_next/static` is immutable; the API sends `no-store`.
   10. **Firebase and Google Cloud consoles** (one-time, before switching users):
       - Firebase console → Authentication → Settings → **Authorized domains** → add `spoton.isolapaul.hu`.
       - Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs → *Web client (auto created by Google Service)*:
         - **Authorized JavaScript origins** += `https://spoton.isolapaul.hu`;
         - **Authorized redirect URIs** += `https://spoton.isolapaul.hu/__/auth/handler`.
       - Google Cloud console → Credentials → the Browser API key: if it has HTTP-referrer restrictions, add `https://spoton.isolapaul.hu/*`.
       - Cloud Functions: deploy with `APP_URL=https://spoton.isolapaul.hu` (T08 parameter; see `docs/security-rollout.md`).
   11. **Rollback:**
       ```bash
       cd /srv/docker/spoton && ls docker-compose.yml.*.bak
       cp docker-compose.yml.<timestamp>.bak docker-compose.yml && docker compose up -d
       ```
       The previous digest is still in GHCR, because releases never overwrite tags.
   12. **Backups.** The app is stateless: all data is in Firebase. Back up only `/srv/docker/spoton/{docker-compose.yml,.env}`. `.env` holds the SMTP password, so store it encrypted.
   13. **Post-deploy checklist:**
       - [ ] `healthy` status; `curl -sI https://spoton.isolapaul.hu/ | grep -i content-security-policy`.
       - [ ] `curl -s https://spoton.isolapaul.hu/__/auth/handler | grep -qi firebase` (the auth proxy works).
       - [ ] Google sign-in: desktop popup; iOS Safari redirect; iOS home-screen PWA.
       - [ ] Map tiles in all 5 themes.
       - [ ] Add a spot with an image (as a test user); the image shows.
       - [ ] Push: enable notifications and trigger one (e.g. approve a test spot); the notification arrives, and clicking it opens the app.
       - [ ] Feedback: send one with an image; the email arrives with subject `SpotOn_feedback`.
       - [ ] DevTools console: no CSP errors on the flows above.
       - [ ] `docker inspect spoton --format '{{json .HostConfig.PortBindings}}'` → `{}` (no published ports).
   14. **Troubleshooting** (short): `unhealthy` → `docker logs`; 502 in the browser → hostname service must be `spoton:3000` and the container must be on `edge`; sign-in `auth/unauthorized-domain` → §10; `EROFS` in logs → report (tmpfs paths).

## Must NOT change
- Application code. This task is config and docs only.
- The server conventions above: directory layout, `edge` network, no published ports, and the Watchtower opt-out.

## Acceptance
```bash
cd deploy && cp .env.example .env && docker compose -f docker-compose.yml config -q && echo CONFIG_OK; rm -f .env; cd ..
grep -nE "ports:|privileged|network_mode" deploy/docker-compose.yml && exit 1 || true
grep -nE "SMTP_PASS=.+|FEEDBACK_RECIPIENT=.+@" deploy/.env.example && exit 1 || true   # no real values
git check-ignore -q deploy/.env && echo "deploy/.env ignored"
# If the private daemon from T16 runs (DOCKER_HOST=unix:///tmp/dockerd.sock) and T16's image exists:
docker network create edge 2>/dev/null || true
printf 'services:\n  spoton:\n    image: spoton:test\n' > /tmp/override.yml
(cd deploy && cp .env.example .env && docker compose -f docker-compose.yml -f /tmp/override.yml up -d \
  && sleep 45 && docker inspect --format '{{.State.Health.Status}}' spoton | grep -qx healthy \
  && docker run --rm --network edge gcr.io/distroless/nodejs22-debian13:nonroot \
       -e 'fetch("http://spoton:3000/api/health").then(r=>r.text()).then(console.log)' \
  && docker compose -f docker-compose.yml -f /tmp/override.yml down; rm -f .env)
```
Manual: the reviewer reads `docs/deploy.md` end to end and checks that:
- every command is copy-pasteable;
- no real secret, email or token appears;
- the cosign identity matches T18's workflow path and tag pattern.

## Rollback
`git revert`. There are no server-side effects until Paul follows the runbook.

## Stop and ask Paul if…
- GitHub now supports fine-grained PATs for GHCR pulls. Prefer that and update §4.
- The server is not amd64 (the cosign binary name and the image platform change).
- Paul's Cloudflare plan or dashboard differs from the paths described, e.g. the tunnel is not dashboard-managed.
- Dependabot cannot authenticate to the private package. Drop the docker-compose entry rather than widen the token scope.
