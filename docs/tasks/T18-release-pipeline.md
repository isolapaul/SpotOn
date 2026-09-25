# T18 — Release pipeline (Trivy, SBOM, cosign, GHCR)

**Phase:** 3 · **Depends on:** T16, T02 · **Risk:** med · **Decisions:** D3, D11, D13, D16
**Audit refs:** SEC-21, SEC-07

## Goal
Pushing a tag `vX.Y.Z` builds the image once, as an OCI layout. The pipeline then scans that exact artifact with Trivy (gate: HIGH/CRITICAL, fixed only), produces a CycloneDX SBOM, smoke-tests the container with the production hardening flags, and pushes the **same digest** to private GHCR. It signs the digest keylessly with cosign and attests the SBOM. A weekly job re-scans the latest release, so new CVEs are noticed without code changes.

## Context
- The image is built from `Dockerfile` (T16). The build args are the 7 `NEXT_PUBLIC_FIREBASE_*` from **repository variables** (`vars.*`, D16), plus `VERSION` and `VCS_REF`. `scripts/check-public-env.mjs --production` fails the build if any is missing.
- **Scan what you push.** Trivy's documented `--input` targets are docker-save tarballs and **OCI layout directories**. Its docs show `trivy image --input /path/to/oci-dir`; an OCI *tar* is not documented. Syft accepts `oci-dir:<path>`. `skopeo copy --preserve-digests` refuses to push if the digest would change.
  - **Decision:** buildx `outputs: type=oci,dest=oci-image,tar=false` → Trivy `input: oci-image` → Syft `oci-dir:oci-image` → `skopeo copy --preserve-digests oci:oci-image docker://…`.
  - The manifest digest is read from `oci-image/index.json` and compared with skopeo's `--digestfile`.
  - `provenance: false` and `sbom: false` on buildx keep a single manifest. We attest the SBOM ourselves.
  - skopeo is preinstalled on `ubuntu-24.04` runners. The workflow still prints `skopeo --version`, and installs it with apt if it is missing.
- The image name must be lowercase: `ghcr.io/isolapaul/spoton`. The repo is `isolapaul/SpotOn`.
- The cosign keyless identity is `https://github.com/isolapaul/SpotOn/.github/workflows/release.yml@refs/tags/<tag>`, with issuer `https://token.actions.githubusercontent.com`. T17's runbook uses exactly this.
- Action versions and commit SHAs, resolved with `git ls-remote` on 2026-09-25. Annotated tags were dereferenced with `^{}`. Re-verify at implementation time.

  | Action | Tag | Commit SHA |
  |---|---|---|
  | actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
  | docker/setup-buildx-action | v4.4.1 | `f87e5991a6d7451dcb8d9637bfbc97413f497069` |
  | docker/build-push-action | v7.4.0 | `c3c9e263c25d99ce0380d002d59b67737d91b0dc` |
  | docker/login-action | v4.6.0 | `dbcb813823bdd20940b903addbd779551569679f` |
  | aquasecurity/trivy-action | v0.36.0 | `ed142fd0673e97e23eac54620cfb913e5ce36c25` (tag object `a9c7b0f…`; pin the **commit**) |
  | anchore/sbom-action | v0.24.2 | `3ad7283483fc7af8ff2b4ea19663c2d5ca935e26` (tag object `006b7ce…`; pin the commit) |
  | sigstore/cosign-installer | v4.1.2 | `6f9f17788090df1f26f669e9d70d6ae9567deba6` (default `cosign-release: v3.0.6`) |
  | actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` (same pin as T02's `ci.yml`) |
  | actions/upload-artifact | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (lightweight tag) |
  | actions/download-artifact | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` (lightweight tag) |

- Trivy binary: the latest is `v0.74.0`. trivy-action v0.36.0 defaults to v0.70.0, so set `version: v0.74.0` explicitly. trivy-action inputs used: `scan-type`, `input`, `image-ref`, `severity`, `ignore-unfixed`, `exit-code`, `scanners`, `trivyignores`, `version`. Scanner actions have been targets of tag-repointing attacks, which is why everything is pinned by full commit SHA.
- Both scanner actions receive `github.token` by default (trivy-action's `token-setup-trivy` input, sbom-action's `github-token` input; checked in their `action.yml` at the pinned commits). They therefore run only in a job whose token is `contents: read`. The write-scoped job (`packages: write`, `id-token: write`) contains no third-party scanner code.
- `.trivyignore` supports `CVE-XXXX-YYYY exp:YYYY-MM-DD` (verified in the Trivy docs, `guide/configuration/filtering.md`). An expired entry stops being ignored, and the gate fails again. That is intended (D11).
- Tag filter: GitHub `on.push.tags` patterns support `[0-9]+`. Tags are **never overwritten**: rollback relies on old digests, and the workflow refuses to push an existing tag.

## Files
- Create:
  - `.github/workflows/release.yml`
  - `.github/workflows/image-rescan.yml`
  - `.trivyignore`
- Modify: none. `.github/dependabot.yml`'s `github-actions` ecosystem from T02 already covers the new workflows.

## Steps
1. **`.trivyignore`:**
   ```
   # Trivy ignore list for the SpotOn image (D11). Every entry MUST have an expiry and a reason.
   # Format: <ID> exp:YYYY-MM-DD   # reason, link, who accepted
   # Example (do not uncomment): CVE-2099-00000 exp:2099-01-31  # no fix upstream; not reachable (no shell in distroless)
   ```
2. **`.github/workflows/release.yml`.** Two jobs, so that no third-party scanner action ever runs with a write-scoped token:
   - `build` (`contents: read` only): build the OCI layout, read the digest, `npm audit`, Trivy, SBOM, smoke test; upload `oci-image/` and `sbom.cdx.json` as a workflow artifact; output the digest.
   - `publish` (`needs: build`, tag pushes only; `packages: write`, `id-token: write`): download the artifact, re-check the digest, push with skopeo, sign with cosign. **No scanner action runs in `publish`.**
   ```yaml
   name: release
   on:
     push:
       tags: ['v[0-9]+.[0-9]+.[0-9]+', 'v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+']
     workflow_dispatch: {}          # dry run: build + scan + SBOM + smoke, no push/sign
   permissions: {}
   concurrency:                     # block style: an unquoted ${{ }} inside a {…} flow mapping is invalid YAML
     group: release-${{ github.ref }}
     cancel-in-progress: false
   env:
     IMAGE: ghcr.io/isolapaul/spoton
   jobs:
     build:
       runs-on: ubuntu-24.04
       timeout-minutes: 40
       permissions:
         contents: read
       outputs:
         digest: ${{ steps.img.outputs.digest }}
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with: { persist-credentials: false }
         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with: { node-version-file: .nvmrc }
         - name: npm audit (production deps; not bypassable)
           run: npm ci --ignore-scripts && npm audit --omit=dev --audit-level=high
         - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
           with:
             # Pinned BuildKit; resolve at implementation time, bump manually (Dependabot does not track it).
             driver-opts: image=moby/buildkit:v<x.y.z>@sha256:<digest>
         - name: Build OCI layout (not pushed)
           uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
           with:
             context: .
             platforms: linux/amd64
             push: false
             provenance: false
             sbom: false
             outputs: type=oci,dest=oci-image,tar=false
             build-args: |
               NEXT_PUBLIC_FIREBASE_API_KEY=${{ vars.NEXT_PUBLIC_FIREBASE_API_KEY }}
               NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${{ vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
               NEXT_PUBLIC_FIREBASE_PROJECT_ID=${{ vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
               NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${{ vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
               NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${{ vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
               NEXT_PUBLIC_FIREBASE_APP_ID=${{ vars.NEXT_PUBLIC_FIREBASE_APP_ID }}
               NEXT_PUBLIC_FIREBASE_VAPID_KEY=${{ vars.NEXT_PUBLIC_FIREBASE_VAPID_KEY }}
               VERSION=${{ github.ref_name }}
               VCS_REF=${{ github.sha }}
         - name: Read manifest digest
           id: img
           run: |
             test "$(jq '.manifests | length' oci-image/index.json)" = 1
             echo "digest=$(jq -r '.manifests[0].digest' oci-image/index.json)" >> "$GITHUB_OUTPUT"
         - name: Trivy gate (HIGH/CRITICAL, fixed only)
           uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
           with:
             scan-type: image
             input: oci-image
             version: v0.74.0
             severity: HIGH,CRITICAL
             ignore-unfixed: true
             exit-code: '1'
             scanners: vuln,secret
             trivyignores: .trivyignore
         - name: SBOM (CycloneDX)
           uses: anchore/sbom-action@3ad7283483fc7af8ff2b4ea19663c2d5ca935e26 # v0.24.2
           with:
             image: oci-dir:oci-image
             format: cyclonedx-json
             output-file: sbom.cdx.json
             upload-artifact: false       # uploaded below together with the OCI layout
             dependency-snapshot: false
         - name: Container smoke test (production flags)
           run: |
             skopeo --version || { sudo apt-get update && sudo apt-get install -y skopeo; }
             skopeo copy oci:oci-image docker-daemon:spoton:ci
             docker run -d --name spoton-ci --read-only \
               --tmpfs /tmp:size=64m,uid=1000,gid=1000,mode=1777 \
               --tmpfs /app/.next/cache:size=128m,uid=1000,gid=1000,mode=0755 \
               -u 1000:1000 --cap-drop ALL --security-opt no-new-privileges --init \
               -p 127.0.0.1:3000:3000 spoton:ci
             for i in $(seq 60); do curl -fsS http://127.0.0.1:3000/api/health && break; sleep 1; done
             curl -fsS http://127.0.0.1:3000/api/health | grep -q '"status":"ok"'
             curl -sI http://127.0.0.1:3000/ | grep -qi '^content-security-policy:'
             sleep 35; test "$(docker inspect -f '{{.State.Health.Status}}' spoton-ci)" = healthy
             if docker logs spoton-ci 2>&1 | grep -qiE 'EROFS|EACCES'; then docker logs spoton-ci; exit 1; fi
             docker rm -f spoton-ci
         - name: Upload image and SBOM for publish
           uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
           with:
             name: release-image
             path: |
               oci-image/
               sbom.cdx.json
             if-no-files-found: error
             retention-days: 1
         - name: Dry-run summary
           if: github.event_name != 'push'
           run: echo "Dry run OK — digest ${{ steps.img.outputs.digest }} (not pushed)" >> "$GITHUB_STEP_SUMMARY"
     publish:
       needs: build
       if: github.event_name == 'push'
       runs-on: ubuntu-24.04
       timeout-minutes: 20
       permissions:
         contents: read
         packages: write
         id-token: write
       env:
         DIGEST: ${{ needs.build.outputs.digest }}
       steps:
         - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
           with: { name: release-image, path: . }
         - name: Re-check digest of the downloaded layout
           run: test "$(jq -r '.manifests[0].digest' oci-image/index.json)" = "$DIGEST"
         - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
           with:
             registry: ghcr.io
             username: ${{ github.actor }}
             password: ${{ secrets.GITHUB_TOKEN }}
         - name: Push same digest (never overwrite a tag)
           run: |
             skopeo --version || { sudo apt-get update && sudo apt-get install -y skopeo; }
             AUTH="$HOME/.docker/config.json"
             if skopeo inspect --raw --authfile "$AUTH" "docker://$IMAGE:$GITHUB_REF_NAME" >/dev/null 2>&1; then
               echo "::error::$IMAGE:$GITHUB_REF_NAME already exists"; exit 1; fi
             skopeo copy --preserve-digests --digestfile pushed.digest --authfile "$AUTH" \
               oci:oci-image "docker://$IMAGE:$GITHUB_REF_NAME"
             test "$(cat pushed.digest)" = "$DIGEST"
             SHA_TAG="sha-${GITHUB_SHA::7}"
             if skopeo inspect --raw --authfile "$AUTH" "docker://$IMAGE:$SHA_TAG" >/dev/null 2>&1; then
               echo "::notice::$SHA_TAG already exists (commit tagged before); left unchanged"
             else
               skopeo copy --preserve-digests --digestfile pushed.digest --authfile "$AUTH" \
                 oci:oci-image "docker://$IMAGE:$SHA_TAG"
               test "$(cat pushed.digest)" = "$DIGEST"
             fi
         - uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # v4.1.2
           with: { cosign-release: 'v3.0.6' }   # bump deliberately; keep docs/deploy.md §5 in sync
         - name: Sign, attest, self-verify
           run: |
             cosign sign --yes "$IMAGE@$DIGEST"
             cosign attest --yes --type cyclonedx --predicate sbom.cdx.json "$IMAGE@$DIGEST"
             ID="^https://github\\.com/isolapaul/SpotOn/\\.github/workflows/release\\.yml@refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+(-rc\\.[0-9]+)?$"
             cosign verify "$IMAGE@$DIGEST" --certificate-identity-regexp "$ID" \
               --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null
             cosign verify-attestation --type cyclonedx "$IMAGE@$DIGEST" --certificate-identity-regexp "$ID" \
               --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null
         - name: Job summary
           run: |
             {
               echo "### SpotOn ${GITHUB_REF_NAME}"
               echo "- Image: \`$IMAGE:$GITHUB_REF_NAME@$DIGEST\`"
               echo "- Also tagged: \`sha-${GITHUB_SHA::7}\` (only if that tag did not exist yet)"
               echo "- npm audit (prod, high) = 0 · Trivy: HIGH/CRITICAL (fixed) = 0 · SBOM: CycloneDX attested · Signed: keyless cosign"
               echo "- Deploy: see docs/deploy.md §Update"
             } >> "$GITHUB_STEP_SUMMARY"
   ```
   The `\\.` escapes above belong to YAML-in-shell. Make sure the resulting regexp string is `^https://github\.com/isolapaul/SpotOn/…`, and test it.
   - **BuildKit pin.** Resolve `v<x.y.z>` (latest `moby/buildkit` release tag was v0.33.0 on 2026-09-25; use the newest) and its digest with `docker buildx imagetools inspect moby/buildkit:v<x.y.z>` at implementation time. Dependabot does not update `driver-opts`, so bump it manually, together with the other action pins.
   - **`npm audit` gate.** The standalone output keeps `nodemailer` and `jose` as real packages (T16 `serverExternalPackages`), but other server code is still bundled into chunks that Trivy and Syft cannot attribute. The audit of the lockfile covers those. It has no `continue-on-error` and no `if`, so it cannot be skipped. If it fails on an advisory without a fix, stop and ask Paul (see below); do not weaken the level.
   - **Partial push.** If `publish` fails after the version tag was pushed (e.g. at signing), a re-run is blocked by "already exists" by design. Do not delete or overwrite the tag in GHCR: cut a new tag (e.g. the next patch or `-rc` number) instead. An unsigned digest can never be deployed, because `update.sh` (T17) verifies the signature.
   - **Recommendation for Paul:** a GitHub tag ruleset (Settings → Rules → Rulesets → New tag ruleset, target `v*`) that restricts tag creation, update and deletion to Paul, because a `v*` tag push is what triggers a signed release.
3. **`.github/workflows/image-rescan.yml`:**
   ```yaml
   name: image-rescan
   on:
     schedule: [{ cron: '17 5 * * 1' }]   # Mondays 05:17 UTC
     workflow_dispatch: {}
   permissions: {}
   jobs:
     rescan:
       runs-on: ubuntu-24.04
       timeout-minutes: 20
       permissions: { contents: read, packages: read, issues: write }
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with: { fetch-depth: 0, persist-credentials: false }
         - id: tag
           run: |
             T=$(git tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
             test -n "$T" || { echo "no release tag yet"; exit 0; }
             echo "tag=$T" >> "$GITHUB_OUTPUT"
         - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
           if: steps.tag.outputs.tag != ''
           with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
         - name: Trivy re-scan of latest release
           id: trivy
           if: steps.tag.outputs.tag != ''
           uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
           with:
             scan-type: image
             image-ref: ghcr.io/isolapaul/spoton:${{ steps.tag.outputs.tag }}
             version: v0.74.0
             severity: HIGH,CRITICAL
             ignore-unfixed: true
             exit-code: '1'
             scanners: vuln
             trivyignores: .trivyignore
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           if: ${{ !cancelled() && steps.tag.outputs.tag != '' }}
           with: { ref: "refs/tags/${{ steps.tag.outputs.tag }}", path: release-src, persist-credentials: false }
         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           if: ${{ !cancelled() && steps.tag.outputs.tag != '' }}
           with: { node-version-file: release-src/.nvmrc }
         - name: npm audit of the release tag (production deps)
           id: audit
           if: ${{ !cancelled() && steps.tag.outputs.tag != '' }}
           working-directory: release-src
           run: npm ci --ignore-scripts && npm audit --omit=dev --audit-level=high
         - name: Open or update issue
           if: ${{ !cancelled() && (steps.trivy.outcome == 'failure' || steps.audit.outcome == 'failure') }}
           env: { GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}", TAG: "${{ steps.tag.outputs.tag }}", TRIVY: "${{ steps.trivy.outcome }}", AUDIT: "${{ steps.audit.outcome }}" }
           run: |
             gh label create image-cve --color B60205 --force
             N=$(gh issue list --label image-cve --state open --json number -q '.[0].number')
             BODY="Weekly re-scan of ghcr.io/isolapaul/spoton:$TAG found fixable HIGH/CRITICAL vulnerabilities (Trivy: $TRIVY, npm audit: $AUDIT). Run: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID — fix via dependency/base-image bump + new release, or add a dated .trivyignore entry with reason."
             if [ -n "$N" ]; then gh issue comment "$N" --body "$BODY"; else gh issue create --title "Re-scan: fixable HIGH/CRITICAL in $TAG" --label image-cve --body "$BODY"; fi
   ```
   The issue step runs on the outcome of either scan (`steps.<id>.outcome`), not on `failure()` of an unrelated step, and the `!cancelled()` guards make the audit run even when Trivy failed. `.trivyignore` is read from the default branch; the audit uses the release tag's lockfile. The job stays failed, so GitHub also notifies Paul by email. The image must be readable by this repo's `GITHUB_TOKEN`: the `org.opencontainers.image.source` label from T16 links the package to the repo.
4. If Trivy DB downloads hit rate limits (`TOOMANYREQUESTS`), add `env: TRIVY_DB_REPOSITORY: public.ecr.aws/aquasecurity/trivy-db,ghcr.io/aquasecurity/trivy-db` to the Trivy steps, and note why in a comment.

## Must NOT change
- The Dockerfile and app code. If the pipeline needs a Dockerfile change, it belongs to T16: report it.
- The existing CI workflow from T02.
- No workflow gets `permissions` broader than listed: no `contents: write`, and no `attestations`.
- No `latest` tag, and no `pull_request_target`.

## Acceptance
```bash
# Lint (download pinned actionlint)
bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/v1.7.12/scripts/download-actionlint.bash) 1.7.12 /tmp
/tmp/actionlint -color .github/workflows/release.yml .github/workflows/image-rescan.yml
grep -nE "uses: [^ ]+@(v[0-9]|main|master)" .github/workflows/*.yml && exit 1 || true    # all actions pinned by SHA
grep -n "permissions: {}" .github/workflows/release.yml .github/workflows/image-rescan.yml
grep -nE "^[A-Z0-9-]+ exp:[0-9]{4}-[0-9]{2}-[0-9]{2}" .trivyignore || echo "no active ignores (ok)"
grep -c "npm audit --omit=dev --audit-level=high" .github/workflows/release.yml .github/workflows/image-rescan.yml   # 1 each
awk '/^  publish:/{p=1} p' .github/workflows/release.yml | grep -nE 'trivy-action|sbom-action' && exit 1 || true  # no scanner in publish
awk '/^  build:/{b=1} /^  publish:/{b=0} b' .github/workflows/release.yml | grep -nE 'packages: write|id-token: write' && exit 1 || true
grep -q 'driver-opts: image=moby/buildkit:v[0-9.]*@sha256:[0-9a-f]\{64\}' .github/workflows/release.yml
grep -n '# syntax=' Dockerfile && exit 1 || true
```
Then the end-to-end run, done by the orchestrator **after Paul has set the 7 repository variables** (see `docs/deploy.md` §3):
```bash
gh workflow run release.yml --ref <branch>                       # dry run: must be green, summary shows digest
git tag v0.0.0-rc.1 && git push origin v0.0.0-rc.1               # real run
gh run watch "$(gh run list --workflow release.yml -L1 --json databaseId -q '.[0].databaseId')"
D=$(docker buildx imagetools inspect ghcr.io/isolapaul/spoton:v0.0.0-rc.1 | awk '/^Digest:/{print $2; exit}')
ID='^https://github\.com/isolapaul/SpotOn/\.github/workflows/release\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$'
cosign verify ghcr.io/isolapaul/spoton@$D --certificate-identity-regexp "$ID" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
cosign verify-attestation --type cyclonedx ghcr.io/isolapaul/spoton@$D --certificate-identity-regexp "$ID" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com | jq -r '.payload' | base64 -d | jq '.predicateType'
test "$D" = "$(docker buildx imagetools inspect ghcr.io/isolapaul/spoton:sha-$(git rev-parse --short=7 v0.0.0-rc.1) | awk '/^Digest:/{print $2; exit}')"
gh run rerun "$(gh run list --workflow release.yml -L1 --json databaseId -q '.[0].databaseId')"   # re-run on same tag: publish must FAIL at "already exists"
gh workflow run image-rescan.yml && gh run watch                  # green, or an issue labelled image-cve is opened
```
Check that the GHCR package `spoton` is **Private**.

## Rollback
- `git revert` the workflows.
- Pushed test images can be deleted in GHCR (package → versions). Delete the `v0.0.0-rc.1` tag: `git push origin :refs/tags/v0.0.0-rc.1`.
- Signatures in the public Rekor log remain; they are harmless.

## Stop and ask Paul if…
- The repository variables are not set yet. Do not push a tag, and do not put real values anywhere else.
- `npm audit --omit=dev --audit-level=high` fails on an advisory that a dependency bump cannot resolve. Do not lower the level or add `continue-on-error`.
- Trivy fails on a HIGH/CRITICAL finding with a fix available that T16's base images or dependency bumps cannot resolve. Do not add `.trivyignore` entries without Paul's OK; every entry needs an expiry and a reason.
- GHCR rejects the cosign v3 signature or attestation storage (the referrers API). Pinning `cosign-release` to the last v2.x is the fallback, and the server's cosign must then match.
- The server is not amd64 (`platforms:` would change).
