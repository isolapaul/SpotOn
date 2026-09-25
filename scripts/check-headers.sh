#!/usr/bin/env bash
# Security-header assertions for a running production build (T15).
# Usage: bash scripts/check-headers.sh BASE        e.g. http://127.0.0.1:3000
# EXPECTED_CSP defaults to the production (`next build`, emulators off) policy; override it only to check
# another build flavour. The routes-manifest check reads $NEXT_DIST_DIR (default .next) in the repo root.
set -euo pipefail

BASE=${1:?usage: check-headers.sh BASE}
BASE=${BASE%/}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
MANIFEST="$ROOT/${NEXT_DIST_DIR:-.next}/routes-manifest.json"

EXPECTED_CSP=${EXPECTED_CSP:-"default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://firebasestorage.googleapis.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://apis.google.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0
pass() { echo "ok   - $*"; }
fail() { echo "FAIL - $*"; failures=$((failures + 1)); }

# fetch <name> <path>: HEAD request, headers saved with lower-cased names and no CR.
fetch() {
  curl -sI --max-time 30 "$BASE$2" | tr -d '\r' \
    | awk 'BEGIN{FS=": "} /^[A-Za-z0-9-]+: /{name=tolower($1); sub(/^[^:]+: /, ""); print name ": " $0; next} {print}' \
    > "$TMP/$1" || true
}
# header <name> <header>: prints the header value(s)
header() { grep -i "^$2: " "$TMP/$1" | sed "s/^[^:]*: //" || true; }

expect_header() {
  local name=$1 key=$2 want=$3 got
  got=$(header "$name" "$key")
  if [ "$got" = "$want" ]; then pass "$name: $key"; else fail "$name: $key = '$got' (want '$want')"; fi
}
expect_absent() {
  local name=$1 key=$2
  if grep -qi "^$key: " "$TMP/$name"; then fail "$name: unexpected $key: $(header "$name" "$key")"; else pass "$name: no $key"; fi
}

for target in root:/ sw:/api/firebase-messaging-sw; do
  name=${target%%:*}
  path=${target#*:}
  fetch "$name" "$path"
  if ! head -n1 "$TMP/$name" | grep -q '^HTTP/[0-9.]* 200'; then
    fail "$name ($path): status '$(head -n1 "$TMP/$name")' (want 200)"
  fi
  expect_header "$name" content-security-policy "$EXPECTED_CSP"
  expect_header "$name" x-content-type-options 'nosniff'
  expect_header "$name" x-frame-options 'DENY'
  expect_header "$name" x-xss-protection '0'
  expect_header "$name" referrer-policy 'strict-origin-when-cross-origin'
  expect_header "$name" strict-transport-security 'max-age=63072000; includeSubDomains; preload'
  expect_header "$name" permissions-policy 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()'
  expect_header "$name" cross-origin-opener-policy 'same-origin-allow-popups'
  expect_absent "$name" x-powered-by
done

# The proxied Firebase auth handler must not carry our page policy (the upstream may be unreachable
# here; only the absence of our headers is checked, and nothing from headers() is expected on /__/*).
fetch handler /__/auth/handler
expect_absent handler content-security-policy
expect_absent handler x-frame-options
expect_absent handler x-powered-by

# Both auth-proxy rewrites are in the built routes manifest.
if [ -f "$MANIFEST" ]; then
  if node -e '
    const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const r = m.rewrites;
    const all = Array.isArray(r) ? r : [...(r.beforeFiles || []), ...(r.afterFiles || []), ...(r.fallback || [])];
    const has = (src, dst) => all.some((x) => x.source === src && dst.test(x.destination));
    const ok = has("/__/auth/:path*", /^https:\/\/[a-z0-9-]+\.firebaseapp\.com\/__\/auth\/:path\*$/)
      && has("/__/firebase/init.json", /^https:\/\/[a-z0-9-]+\.firebaseapp\.com\/__\/firebase\/init\.json$/);
    process.exit(ok ? 0 : 1);
  ' "$MANIFEST"; then
    pass "routes-manifest: /__/auth/:path* and /__/firebase/init.json rewrites"
  else
    fail "routes-manifest: auth-proxy rewrites missing in $MANIFEST"
  fi
else
  fail "routes-manifest: $MANIFEST not found"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all header checks passed"
