#!/bin/bash
# Real HTTP smoke for the four M2 operations, against `next start` (not handlers).
set -u
cd "$(dirname "$0")/.." || exit 1
PORT=3200
export CONSENT_GATE_ALLOW_TEST_CLOCK=1
export CONSENT_GATE_EVALUATION_DATE=2026-10-19
./node_modules/.bin/next start -p "$PORT" >/tmp/cg-http-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null' EXIT

BASE="http://127.0.0.1:$PORT"
READY=0
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$BASE/"; then READY=1; break; fi
  sleep 0.5
done
if [ "$READY" -ne 1 ]; then
  echo "HTTP SMOKE: server did not start"
  tail -20 /tmp/cg-http-server.log
  exit 1
fi

fail=0
check_code () {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "$name: HTTP $actual"
  else
    echo "$name: expected HTTP $expected, got $actual"
    fail=1
  fi
}
check_json () {
  local name="$1" expr="$2" body="$3"
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert $expr" 2>/dev/null; then
    echo "  $name: ok"
  else
    echo "  $name: WRONG — $body"
    fail=1
  fi
}

SCENARIO='{"subjectId":"http-child","dateOfBirth":"2015-03-01","jurisdiction":"DE","feature":"chat"}'

# 1. Evaluate
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/decisions" -H 'content-type: application/json' -d "$SCENARIO")
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST /api/v1/decisions" 200 "$code"
check_json "decision requires consent" 'd["decision"]=="parental_consent" and d["reason"]=="parental_consent_required"' "$body"

# 2. Create consent request
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/consent-requests" -H 'content-type: application/json' -d "$SCENARIO")
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST /api/v1/consent-requests" 201 "$code"
check_json "created pending" 'd["created"] is True and d["request"]["status"]=="pending"' "$body"
ID=$(echo "$body" | python3 -c 'import sys,json; print(json.load(sys.stdin)["request"]["id"])')

# 3. Duplicate create reuses
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/consent-requests" -H 'content-type: application/json' -d "$SCENARIO")
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST /api/v1/consent-requests (retry)" 200 "$code"
check_json "reused, not recreated" 'd["created"] is False' "$body"

# 4. Parent approves
resp=$(curl -s -w '\n%{http_code}' -X PATCH "$BASE/api/v1/consent-requests/$ID" -H 'content-type: application/json' -d '{"status":"approved"}')
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "PATCH /api/v1/consent-requests/:id" 200 "$code"
check_json "approved" 'd["status"]=="approved"' "$body"

# 5. Fresh decision reflects the approval
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/decisions" -H 'content-type: application/json' -d "$SCENARIO")
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST /api/v1/decisions (after approval)" 200 "$code"
check_json "allowed after approval" 'd["decision"]=="allowed" and d["reason"]=="parental_consent_approved"' "$body"

# 6. List by subject
resp=$(curl -s -w '\n%{http_code}' "$BASE/api/v1/consent-requests?subjectId=http-child")
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "GET /api/v1/consent-requests" 200 "$code"
check_json "one request" 'len(d["requests"])==1' "$body"

# 7. Hard block cannot create a request
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/consent-requests" -H 'content-type: application/json' -d '{"subjectId":"http-gb","dateOfBirth":"2015-03-01","jurisdiction":"GB","feature":"chat"}')
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST hard-block request" 409 "$code"
check_json "consent_not_required" 'd["error"]["code"]=="consent_not_required"' "$body"

# 8. Client evaluation date is rejected
resp=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/v1/decisions" -H 'content-type: application/json' -d '{"subjectId":"http-child","dateOfBirth":"2015-03-01","jurisdiction":"DE","feature":"chat","evaluationDate":"2040-01-01"}')
body=$(echo "$resp" | sed '$d'); code=$(echo "$resp" | tail -n1)
check_code "POST client evaluationDate" 400 "$code"
check_json "validation_error" 'd["error"]["code"]=="validation_error"' "$body"

if [ "$fail" -eq 0 ]; then
  echo "HTTP SMOKE: PASS"
else
  echo "HTTP SMOKE: FAIL"
  tail -30 /tmp/cg-http-server.log
fi
exit "$fail"
