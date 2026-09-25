# T16 — Standalone build and hardened Dockerfile

**Phase:** 3 · **Depends on:** T14, T15 (and T02 for `.github/dependabot.yml`) · **Risk:** med · **Decisions:** D1, D14, D16, D17
**Audit refs:** SEC-21, SEC-07 (image optimizer surface)

## Goal
Build the Next.js app into a small, shell-less, non-root image that runs with a read-only root filesystem and no capabilities. It has a dependency-free health endpoint, and `NEXT_PUBLIC_*` config is baked in as build args. The build fails loudly if public config is missing.

## Context
- `next.config.mjs` has no `output`. `images.unoptimized` is `true` in production (:4), so the Next image optimizer is never used by the app.
  - **Keep it that way.** The optimizer (sharp/libvips, AVIF) was the source of the Next CRITICAL in SEC-07, so we also keep sharp out of the image.
- `NEXT_PUBLIC_*` values are inlined at build time: client bundles, server bundles (`/api/feedback` projectId, the SW route) and `next.config.mjs` `headers()`/`rewrites()`, which T15 froze into `routes-manifest.json`. The runtime stage therefore needs **no** `NEXT_PUBLIC_*` env.
- Required public vars:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Forbidden in the container build: `NEXT_PUBLIC_USE_EMULATORS` (tests only), `NEXT_PUBLIC_MOVED_TO` (Vercel only, T19) and `NEXT_PUBLIC_ADMIN_EMAIL` (removed by T11a).
- **Base images.** Verified on 2026-09-25 against the registries:
  - `gcr.io/distroless/nodejs22-debian12:nonroot` exists (index `sha256:13593b75…`).
  - **`gcr.io/distroless/nodejs22-debian13:nonroot` also exists** (index `sha256:5ef534d3db0ac0c43bee379af4ae49cfbfc0ef38a46c94c52d87c68f32f34d8a`). Its config is `Entrypoint ["/nodejs/bin/node"]`, `User 65532`, `WorkingDir /home/nonroot`, Node **v22.23.3**, `/etc/debian_version` 13.x. It runs fine with `--read-only -u 1000:1000`; this was tested in the sandbox.
  - Docker Hub has `node:22-trixie-slim` = `node:22.23-trixie-slim` (index `sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4`) and `node:22-bookworm-slim` (`sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`).
  - **Decision in this spec:** build on `node:22-trixie-slim`, run on `gcr.io/distroless/nodejs22-debian13:nonroot`. The Debian release (glibc) matches between the stages and the host OS (Debian 13), and it is newer.
  - This refines D17, which named bookworm/debian12. The orchestrator must update the D17 row in `docs/ROADMAP.md`. If Paul prefers debian12, swap both FROM lines to the bookworm/debian12 pair. Never mix them.
  - Re-resolve both digests at implementation time:
    - `docker buildx imagetools inspect node:22-trixie-slim`
    - `docker buildx imagetools inspect gcr.io/distroless/nodejs22-debian13:nonroot`
- Install scripts in the lockfile (checked `hasInstallScript`): `sharp` (optional; prebuilt `@img/*` binaries come in as optional dependencies, so no script is needed), `protobufjs` (a postinstall version notice only) and `fsevents` (macOS only). Next's SWC binary comes through optional dependencies, with no script.
  - **Decision:** `npm ci --ignore-scripts`, so no third-party install code runs in the build.
- User and ownership:
  - Distroless nonroot is uid 65532. The server runs containers as `1000:1000` (compose `user:`).
  - Nothing under `/app` is written at runtime except `.next/cache` (tmpfs) and `/tmp` (tmpfs). So the files stay **root-owned and world-readable** (no `--chown`), and are immutable for either runtime uid.
  - The image default is `USER 65532:65532`; compose overrides it to `1000:1000`.
- Docker `HEALTHCHECK` exec form works without a shell: `CMD ["/nodejs/bin/node", "/app/healthcheck.mjs"]`. Distroless has no `curl` or `wget`. The healthcheck does not go through the image `ENTRYPOINT`.
- Docker **does** run in this sandbox. A private daemon was verified working (pull, run, user networks, port publish):
  ```bash
  (nohup dockerd --host=unix:///tmp/dockerd.sock --data-root=/tmp/docker-data --exec-root=/tmp/docker-exec \
     --pidfile=/tmp/dockerd.pid > /tmp/dockerd.log 2>&1 &)
  export DOCKER_HOST=unix:///tmp/dockerd.sock; for i in $(seq 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  ```
  Docker Hub may answer **429** on anonymous pulls from the sandbox; `gcr.io` pulls were fine. If `node:*` cannot be pulled, run the acceptance in CI (T18) and say so in the report.

## Files
- Create:
  - `Dockerfile`
  - `.dockerignore`
  - `docker/healthcheck.mjs`
  - `src/app/api/health/route.ts`
  - `scripts/check-public-env.mjs`
- Modify:
  - `next.config.mjs` (`output`, `outputFileTracingExcludes`)
  - `.github/dependabot.yml` (add a docker entry)

## Steps
1. **`next.config.mjs`:**
   - add `output: 'standalone'`;
   - add `outputFileTracingExcludes: { '*': ['node_modules/sharp/**', 'node_modules/@img/**'] }`, with a comment: *images are unoptimized; keep libvips out of the image (SEC-07)*.
   - Leave `images` unchanged.
2. **`src/app/api/health/route.ts`:**
   ```ts
   export const dynamic = 'force-dynamic';
   export function GET() {
     return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
   }
   ```
   No imports of Firebase or SMTP.
3. **`scripts/check-public-env.mjs`** (Node ESM, no dependencies):
   - Loop over the 7 required names. Each must be set, non-empty, have no surrounding whitespace, and contain no quote characters.
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` must match `^[a-z0-9.-]+(:[0-9]+)?$`, so no scheme and no path.
   - With `--production`, it additionally fails if `NEXT_PUBLIC_USE_EMULATORS` is `1` (T04 always defines it as `'1'` or `'0'` in `next.config`, so only `1` is forbidden), or if `NEXT_PUBLIC_MOVED_TO` or `NEXT_PUBLIC_ADMIN_EMAIL` is set.
   - It prints the **names** of missing or invalid vars (never values) and exits 1; on success it prints `public env OK (7 vars)`.
   - It is **not** a `prebuild` hook, because local and CI emulator builds use demo values; the Dockerfile calls it explicitly.
4. **`docker/healthcheck.mjs`:**
   ```js
   const port = process.env.PORT || '3000';
   try {
     const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) });
     process.exit(r.ok ? 0 : 1);
   } catch { process.exit(1); }
   ```
5. **`Dockerfile`.** Write the FROM lines literally, not through `ARG`, so Dependabot can update them. Fill in the digests re-resolved at implementation time:
   ```dockerfile
   # syntax=docker/dockerfile:1
   FROM node:22-trixie-slim@sha256:<digest> AS deps
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci --ignore-scripts --no-audit --no-fund

   FROM node:22-trixie-slim@sha256:<digest> AS builder
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   ARG NEXT_PUBLIC_FIREBASE_API_KEY
   ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
   ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   ARG NEXT_PUBLIC_FIREBASE_APP_ID
   ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY
   ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
       NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
       NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
       NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
       NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
       NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
       NEXT_PUBLIC_FIREBASE_VAPID_KEY=$NEXT_PUBLIC_FIREBASE_VAPID_KEY
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN node scripts/check-public-env.mjs --production && npx next build

   FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:<digest> AS runtime
   ARG VERSION=dev
   ARG VCS_REF=unknown
   LABEL org.opencontainers.image.source="https://github.com/isolapaul/SpotOn" \
         org.opencontainers.image.title="spoton" \
         org.opencontainers.image.description="SpotOn PWA (Next.js standalone)" \
         org.opencontainers.image.licenses="MIT" \
         org.opencontainers.image.version="$VERSION" \
         org.opencontainers.image.revision="$VCS_REF"
   WORKDIR /app
   ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static
   COPY --from=builder /app/public ./public
   COPY docker/healthcheck.mjs ./healthcheck.mjs
   USER 65532:65532
   EXPOSE 3000
   HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
     CMD ["/nodejs/bin/node", "/app/healthcheck.mjs"]
   CMD ["server.js"]
   ```
   Build with `npx next build` rather than `npm run build`, in case T01 made `build` a composite script (lint, test). If T01 kept `build` = `next build`, either form is fine.
   - `org.opencontainers.image.source` links the GHCR package to the repo, which T18's weekly rescan needs.
6. **`.dockerignore`:**
   ```
   **/node_modules
   .next
   out
   coverage
   playwright-report
   test-results
   .git
   .github
   .vscode
   .idea
   **/.env*
   functions
   docs
   deploy
   e2e
   tests
   **/*.md
   !public/patch-notes.md
   Dockerfile
   .dockerignore
   firebase.json
   .firebaserc
   firestore.*
   storage.rules
   vercel.json
   **/*.log
   ```
   `public/patch-notes.md` is fetched by FeedbackPanel. Keep `scripts/`, because the build calls `check-public-env.mjs`.
7. **`.github/dependabot.yml`.** Add one entry and keep T02's entries:
   ```yaml
   - package-ecosystem: docker
     directory: /
     schedule: { interval: weekly }
     groups: { base-images: { patterns: ["*"] } }
   ```

## Must NOT change
- App behaviour and all routes. `npm run dev` and `npm run build && npm start` still work locally. `next start` with `output: 'standalone'` prints a warning but works; the e2e harness may keep using it.
- `images` config.
- No secrets or `SMTP_*` in the image, in build args or in labels.

## Acceptance
```bash
npm run verify
node scripts/check-public-env.mjs; test $? -eq 1                       # nothing set → fails, lists names
# start the private daemon as in Context, then:
export DOCKER_HOST=unix:///tmp/dockerd.sock
BA="--build-arg NEXT_PUBLIC_FIREBASE_API_KEY=demo-key --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=spoton.isolapaul.hu \
 --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-spoton.appspot.com \
 --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0 --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=1:0:web:0 \
 --build-arg NEXT_PUBLIC_FIREBASE_VAPID_KEY=demo"
docker build $BA --build-arg VERSION=test --build-arg VCS_REF=$(git rev-parse --short HEAD) -t spoton:test .
docker build --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=x -t spoton:bad . ; test $? -ne 0   # missing args → build fails
docker run -d --name spoton-test --read-only --tmpfs /tmp:size=64m,uid=1000,gid=1000,mode=1777 \
  --tmpfs /app/.next/cache:size=128m,uid=1000,gid=1000,mode=0755 -u 1000:1000 --cap-drop ALL \
  --security-opt no-new-privileges --init -p 127.0.0.1:3000:3000 spoton:test
for i in $(seq 30); do curl -fsS http://127.0.0.1:3000/api/health && break; sleep 1; done   # → {"status":"ok"}
curl -sI http://127.0.0.1:3000/ | grep -i "content-security-policy"
sleep 40; test "$(docker inspect --format '{{.State.Health.Status}}' spoton-test)" = healthy
docker logs spoton-test 2>&1 | grep -iE "EROFS|EACCES|error" && exit 1 || true
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' 'http://127.0.0.1:3000/_next/image?url=%2Ficon-192x192.png&w=64&q=75'
#   → must NOT be "200 image/avif" or "200 image/webp"; record the actual result in the report
docker image inspect spoton:test --format '{{.Config.User}} {{json .Config.Env}} {{json .Config.Labels}}'
#   → 65532:65532; Env has no SMTP_/NEXT_PUBLIC_; labels present
docker image inspect spoton:test --format '{{json .Config.Env}}' | grep -E "SMTP|NEXT_PUBLIC" && exit 1 || true
docker history --no-trunc spoton:test | grep -iE "SMTP|PASS|TOKEN" && exit 1 || true
docker create --name x spoton:test && docker export x | tar -t | grep -E "(^|/)(\.env|node_modules/sharp|@img/sharp)" && exit 1 || true; docker rm x
docker image ls spoton:test --format '{{.Size}}'                                      # record; expect < 250MB
docker run --rm -v /tmp/dockerd.sock:/var/run/docker.sock aquasec/trivy:0.74.0 image --severity HIGH,CRITICAL \
  --ignore-unfixed --scanners vuln,secret spoton:test   # if Docker Hub rate-limits, CI (T18) runs this gate
docker rm -f spoton-test
```
If the daemon cannot start, or base images cannot be pulled, report it. The same checks then run in T18's smoke job and are required to pass there.

## Rollback
`git revert`. There is nothing deployed yet. Removing `output: 'standalone'` restores the previous build output.

## Stop and ask Paul if…
- The standalone server needs to write outside `/tmp` and `/app/.next/cache` (EROFS in the logs).
- `npm ci --ignore-scripts` breaks the build: some package really needs its install script.
- `next build` fails inside Docker on files that `.dockerignore` excludes, for example `scripts/*.ts` admin scripts from T08 being type-checked. Fix it via `tsconfig` `exclude` only with the orchestrator's OK.
- Paul prefers debian12/bookworm over the debian13/trixie pair chosen here.
- The server CPU is not x86_64/amd64.
