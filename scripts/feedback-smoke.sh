#!/usr/bin/env bash
# Curl smoke matrix for POST /api/feedback (T14). Needs a running `next start` with SMTP pointing at
# scripts/smtp-sink.mjs and FEEDBACK_RECIPIENT set, and a fresh (empty) sink file.
#
# Budget: the server's global bucket holds 20 tokens. This matrix sends 18 POSTs that pass the
# per-IP check (every case below except the 6th request of case 11). Do not add POSTs, and keep
# requests sequential (the in-flight cap is 2). Each case uses its own cf-connecting-ip.
set -euo pipefail

BASE=${BASE:-http://127.0.0.1:3000}
SINK=${SINK:-/tmp/spoton-smtp-sink.eml}
URL="$BASE/api/feedback"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0
pass() { echo "ok   - $*"; }
fail() { echo "FAIL - $*"; failures=$((failures + 1)); }

# post <name> <ip-suffix> <datafile> [extra curl args...] → prints the HTTP status
post() {
  local name=$1 ip=$2 data=$3
  shift 3
  curl -s -o "$TMP/$name.body" -D "$TMP/$name.headers" -w '%{http_code}' -X POST \
    -H "cf-connecting-ip: 203.0.113.$ip" "$@" --data-binary "@$data" "$URL" || true
}
post_json() {
  local name=$1 ip=$2 data=$3
  shift 3
  post "$name" "$ip" "$data" -H 'content-type: application/json' "$@"
}
expect() { # <case> <expected> <actual>
  if [ "$3" = "$2" ]; then pass "$1 → $3"; else fail "$1 → expected $2, got $3"; fi
}
# Nth message (1-based) in the sink file
sink_msg() { awk -v n="$1" 'BEGIN{i=1} /^----- END -----$/{i++; next} i==n' "$SINK"; }

# ---- test data --------------------------------------------------------------
PNG_B64=$(base64 -w0 "$ROOT/public/icon-192x192.png")
TEXT_B64=$(printf 'this is plain text, not an image' | base64 -w0)
BIG_B64=$({ printf '\x89PNG\r\n\x1a\n'; head -c 1600000 /dev/urandom; } | base64 -w0)
LONG_MSG=$(head -c 5001 /dev/zero | tr '\0' 'x')

printf '{"message":"smoke 1 text only"}' > "$TMP/valid.json"
printf '{"message":"smoke 2 with png","senderEmail":"evil@example.com","senderName":"Admin","attachments":[{"filename":"../../icon.png","mime":"text/html","dataUrl":"data:image/png;base64,%s"}]}' \
  "$PNG_B64" > "$TMP/png.json"
printf '{"message":""}' > "$TMP/empty.json"
printf '{"message":"   "}' > "$TMP/spaces.json"
printf '{"message":"%s"}' "$LONG_MSG" > "$TMP/long.json"
printf '{"attachments":[]}' > "$TMP/missing.json"
A="{\"dataUrl\":\"data:image/png;base64,$PNG_B64\"}"
printf '{"message":"four","attachments":[%s,%s,%s,%s]}' "$A" "$A" "$A" "$A" > "$TMP/four.json"
printf '{"message":"text as png","attachments":[{"dataUrl":"data:image/png;base64,%s"}]}' "$TEXT_B64" > "$TMP/textpng.json"
printf '{"message":"oversized","attachments":[{"dataUrl":"data:image/png;base64,%s"}]}' "$BIG_B64" > "$TMP/big.json"
head -c 7000000 /dev/zero | tr '\0' 'a' > "$TMP/7mb.bin"

ERROR_CASES=()

# ---- 1: valid text-only, anonymous -----------------------------------------
expect "1 valid text-only" 200 "$(post_json c1 1 "$TMP/valid.json")"
M1=$(sink_msg 1)
grep -q '^Subject: SpotOn_feedback' <<<"$M1" && pass "1 sink: Subject" || fail "1 sink: Subject missing"
grep -q '^Sender: anonymous' <<<"$M1" && pass "1 sink: Sender anonymous" || fail "1 sink: Sender anonymous missing"
grep -qi '^Reply-To:' <<<"$M1" && fail "1 sink: unexpected Reply-To" || pass "1 sink: no Reply-To"

# ---- 2: valid + PNG + spoofed sender fields -----------------------------------
expect "2 valid + png + spoofed sender" 200 "$(post_json c2 2 "$TMP/png.json")"
M2=$(sink_msg 2)
grep -Eq 'filename="?[A-Za-z0-9._-]+\.png"?' <<<"$M2" && pass "2 sink: .png attachment" || fail "2 sink: no .png attachment"
grep -q '^Sender: anonymous' <<<"$M2" && pass "2 sink: Sender anonymous" || fail "2 sink: Sender anonymous missing"
grep -Fq 'evil@example.com' "$SINK" && fail "2 sink: contains evil@example.com" || pass "2 sink: no evil@example.com"
grep -Fq 'Admin' "$SINK" && fail "2 sink: contains Admin" || pass "2 sink: no Admin"

# ---- 3: message validation -----------------------------------------------------
for c in empty spaces long missing; do
  expect "3 message $c" 400 "$(post_json "c3-$c" 3 "$TMP/$c.json")"
  ERROR_CASES+=("c3-$c")
done

# ---- 4..10 ------------------------------------------------------------------------
expect "4 four attachments" 400 "$(post_json c4 4 "$TMP/four.json")"
expect "5 text bytes labelled image/png" 400 "$(post_json c5 5 "$TMP/textpng.json")"
expect "6 1.6 MB PNG-magic attachment" 413 "$(post_json c6 6 "$TMP/big.json")"
expect "7 7 MB body with Content-Length" 413 "$(post_json c7 7 "$TMP/7mb.bin")"
expect "8 7 MB body chunked" 413 "$(post_json c8 8 "$TMP/7mb.bin" -H 'Transfer-Encoding: chunked')"
expect "9 content-type text/plain" 415 "$(post "c9" 9 "$TMP/valid.json" -H 'content-type: text/plain')"
expect "10 bogus bearer token" 401 "$(post_json c10 10 "$TMP/valid.json" -H 'Authorization: Bearer abc.def.ghi')"
ERROR_CASES+=(c4 c5 c6 c7 c8 c9 c10)

# ---- 11: per-IP rate limit (invalid bodies, so no mail is sent) --------------------
for i in 1 2 3 4 5; do
  expect "11 request $i" 400 "$(post_json "c11-$i" 11 "$TMP/empty.json")"
done
expect "11 request 6" 429 "$(post_json c11-6 11 "$TMP/empty.json")"
grep -Eqi '^retry-after: [0-9]+' "$TMP/c11-6.headers" && pass "11 Retry-After header" || fail "11 Retry-After header missing"
ERROR_CASES+=(c11-1 c11-6)

# ---- 12: other methods ----------------------------------------------------------------
expect "12 GET" 405 "$(curl -s -o "$TMP/c12.body" -w '%{http_code}' -H 'cf-connecting-ip: 203.0.113.12' "$URL" || true)"

# ---- 13: error bodies are generic -----------------------------------------------------
for c in "${ERROR_CASES[@]}"; do
  body=$(cat "$TMP/$c.body")
  if [[ "$body" =~ ^\{\"error\":\"[a-z_]+\"\}$ ]]; then pass "13 $c body $body"; else fail "13 $c body: $body"; fi
done
if grep -Eqi 'smtp|stack|    at |node_modules' "$TMP"/c*.body; then fail "13 bodies leak details"; else pass "13 no stack traces or config hints"; fi

# The two success cases must be the only mails.
count=$(grep -c '^----- END -----$' "$SINK" || true)
expect "sink message count" 2 "$count"

if [ "$failures" -gt 0 ]; then
  echo "feedback smoke: $failures failure(s)"
  exit 1
fi
echo "feedback smoke: all passed"
