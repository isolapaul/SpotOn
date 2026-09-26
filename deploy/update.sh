#!/usr/bin/env bash
# /srv/docker/spoton/update.sh — verify, pin and roll out a SpotOn release. Usage: ./update.sh v2.1.0
set -euo pipefail
cd "$(dirname "$0")"
TAG=${1:?usage: ./update.sh vX.Y.Z}
[[ $TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "final release tags only (vX.Y.Z)" >&2; exit 1; }
IMAGE=ghcr.io/isolapaul/spoton
ID="https://github.com/isolapaul/SpotOn/.github/workflows/release.yml@refs/tags/$TAG"
ISSUER=https://token.actions.githubusercontent.com
OUT=$(docker buildx imagetools inspect "$IMAGE:$TAG")
DIGEST=$(awk '/^Digest:/{print $2; exit}' <<<"$OUT")
[[ $DIGEST =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "could not resolve a digest for $TAG" >&2; exit 1; }
echo "$TAG -> $DIGEST (must equal the digest in the release job summary)"
cosign verify "$IMAGE@$DIGEST" --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > /dev/null
echo "signature OK"
cosign verify-attestation --type cyclonedx "$IMAGE@$DIGEST" --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > /dev/null
echo "SBOM attestation OK"
cp docker-compose.yml "docker-compose.yml.$(date +%F-%H%M%S).bak"
sed -i -E "s#^(\s*image: ghcr\.io/isolapaul/spoton):[^@]+@sha256:[0-9a-f]{64}#\1:$TAG@$DIGEST#" docker-compose.yml
grep -qF "image: $IMAGE:$TAG@$DIGEST" docker-compose.yml || { echo "image line not updated" >&2; exit 1; }
docker compose pull
docker compose up -d --wait --wait-timeout 120
