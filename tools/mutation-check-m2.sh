#!/bin/bash
# M2 mutation checks. A mutation that leaves tests green is a gap.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

# These checks mutate real source files. Snapshot src/ and restore it on EXIT,
# INT, or TERM so an interrupted run can never leave a broken safety rule in
# the working tree (the next `git add -A` boundary would capture it).
BACKUP_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf src
  cp -R "$BACKUP_ROOT/src" src
  rm -rf "$BACKUP_ROOT"
}
trap cleanup EXIT INT TERM
cp -R src "$BACKUP_ROOT/src"

check_red () {
  local name="$1" rc="$2" log="$3"
  if [ "$rc" -ne 0 ]; then
    echo "$name: RED as expected"
  else
    echo "$name: STILL GREEN — no test guards this rule"
    tail -5 "$log"
    fail=1
  fi
}

# A. checkAccess must stay read-only.
cp src/services/decision-service.ts $BACKUP_ROOT/cg2-a.bak
python3 - <<'PY'
p = "src/services/decision-service.ts"
s = open(p).read()
old = """    const scenario = parseScenario(input, this.policy);
    const current = this.repository.getByScope(scenario);"""
new = """    const scenario = parseScenario(input, this.policy);
    this.repository.create(scenario);
    const current = this.repository.getByScope(scenario);"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/services/decision-service.test.ts >$BACKUP_ROOT/cg2-a.out 2>&1
a=$?
cp $BACKUP_ROOT/cg2-a.bak src/services/decision-service.ts
check_red "A checkAccess creates state" "$a" $BACKUP_ROOT/cg2-a.out

# B. Existing-scope lookup must precede new-request eligibility.
cp src/services/consent-service.ts $BACKUP_ROOT/cg2-b.bak
python3 - <<'PY'
p = "src/services/consent-service.ts"
s = open(p).read()
old = "    if (existing) {"
new = "    if (false && existing) {"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/services/consent-service.test.ts >$BACKUP_ROOT/cg2-b.out 2>&1
b=$?
cp $BACKUP_ROOT/cg2-b.bak src/services/consent-service.ts
check_red "B existing lookup bypassed" "$b" $BACKUP_ROOT/cg2-b.out

# C. A hard block must never create a consent request.
cp src/services/consent-service.ts $BACKUP_ROOT/cg2-c.bak
python3 - <<'PY'
p = "src/services/consent-service.ts"
s = open(p).read()
old = """    if (
      eligibility.decision !== "parental_consent" ||
      eligibility.reason !== "parental_consent_required"
    ) {"""
new = "    if (false) {"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/services/consent-service.test.ts tests/api/routes.test.ts >$BACKUP_ROOT/cg2-c.out 2>&1
c=$?
cp $BACKUP_ROOT/cg2-c.bak src/services/consent-service.ts
check_red "C hard block can create" "$c" $BACKUP_ROOT/cg2-c.out

# D. Error-code to HTTP-status mapping.
cp src/http/responses.ts $BACKUP_ROOT/cg2-d.bak
python3 - <<'PY'
p = "src/http/responses.ts"
s = open(p).read()
old = """  request_not_found: 404,
  consent_not_required: 409,"""
new = """  request_not_found: 409,
  consent_not_required: 404,"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/api/routes.test.ts tests/http/responses.test.ts >$BACKUP_ROOT/cg2-d.out 2>&1
d=$?
cp $BACKUP_ROOT/cg2-d.bak src/http/responses.ts
check_red "D error statuses swapped" "$d" $BACKUP_ROOT/cg2-d.out

# E. GET must require subjectId.
cp src/services/consent-service.ts $BACKUP_ROOT/cg2-e.bak
python3 - <<'PY'
p = "src/services/consent-service.ts"
s = open(p).read()
old = """    if (!normalized) {
      throw validationError("subjectId query parameter is required");
    }
"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/api/routes.test.ts tests/services/consent-service.test.ts >$BACKUP_ROOT/cg2-e.out 2>&1
e=$?
cp $BACKUP_ROOT/cg2-e.bak src/services/consent-service.ts
check_red "E subjectId validation removed" "$e" $BACKUP_ROOT/cg2-e.out

# F. `created` must come from the write result, not the pre-write lookup.
cp src/services/consent-service.ts $BACKUP_ROOT/cg2-f.bak
python3 - <<'PY'
p = "src/services/consent-service.ts"
s = open(p).read()
old = "      created: write.created,"
new = "      created: true,"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/services/consent-service.test.ts >$BACKUP_ROOT/cg2-f.out 2>&1
f=$?
cp $BACKUP_ROOT/cg2-f.bak src/services/consent-service.ts
check_red "F created flag ignores the write result" "$f" $BACKUP_ROOT/cg2-f.out

# G. Startup must validate the server clock.
cp src/server/container.ts $BACKUP_ROOT/cg2-g.bak
python3 - <<'PY'
p = "src/server/container.ts"
s = open(p).read()
old = "  getEvaluationDate();\n"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/server/container.test.ts >$BACKUP_ROOT/cg2-g.out 2>&1
g=$?
cp $BACKUP_ROOT/cg2-g.bak src/server/container.ts
check_red "G startup clock validation removed" "$g" $BACKUP_ROOT/cg2-g.out

# H. A blank test-clock override must be treated as unset.
cp src/server/clock.ts $BACKUP_ROOT/cg2-h.bak
python3 - <<'PY'
p = "src/server/clock.ts"
s = open(p).read()
old = "  return value || null;"
new = "  return value;"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/server/clock.test.ts >$BACKUP_ROOT/cg2-h.out 2>&1
h=$?
cp $BACKUP_ROOT/cg2-h.bak src/server/clock.ts
check_red "H blank override returned as a date" "$h" $BACKUP_ROOT/cg2-h.out

# I. The environment override must require the explicit test flag.
cp src/server/clock.ts $BACKUP_ROOT/cg2-i.bak
python3 - <<'PY'
p = "src/server/clock.ts"
s = open(p).read()
old = """  if (process.env[ALLOW_TEST_CLOCK_ENV] !== "1") {
    return null;
  }
"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/server/clock.test.ts >$BACKUP_ROOT/cg2-i.out 2>&1
i=$?
cp $BACKUP_ROOT/cg2-i.bak src/server/clock.ts
check_red "I test-clock gate removed" "$i" $BACKUP_ROOT/cg2-i.out

# J. Storage failures must be logged.
cp src/http/responses.ts $BACKUP_ROOT/cg2-j.bak
python3 - <<'PY'
p = "src/http/responses.ts"
s = open(p).read()
old = '    console.error("[consent-gate] storage failure", error);\n'
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/http/responses.test.ts >$BACKUP_ROOT/cg2-j.out 2>&1
j=$?
cp $BACKUP_ROOT/cg2-j.bak src/http/responses.ts
check_red "J storage failure log removed" "$j" $BACKUP_ROOT/cg2-j.out

# K. Unexpected errors must be logged.
cp src/http/responses.ts $BACKUP_ROOT/cg2-k.bak
python3 - <<'PY'
p = "src/http/responses.ts"
s = open(p).read()
old = '  console.error("[consent-gate] unexpected error", error);\n'
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/http/responses.test.ts >$BACKUP_ROOT/cg2-k.out 2>&1
k=$?
cp $BACKUP_ROOT/cg2-k.bak src/http/responses.ts
check_red "K unexpected error log removed" "$k" $BACKUP_ROOT/cg2-k.out

# L. The container must remain a stable singleton.
cp src/server/container.ts $BACKUP_ROOT/cg2-l.bak
python3 - <<'PY'
p = "src/server/container.ts"
s = open(p).read()
old = "  return globalStore.__consentGateContainer as Container;"
new = "  return createContainer();"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/server/container.test.ts >$BACKUP_ROOT/cg2-l.out 2>&1
l=$?
cp $BACKUP_ROOT/cg2-l.bak src/server/container.ts
check_red "L container singleton replaced per call" "$l" $BACKUP_ROOT/cg2-l.out

# M. Error classification must not depend on class identity across bundles.
cp src/http/responses.ts $BACKUP_ROOT/cg2-m.bak
python3 - <<'PY'
p = "src/http/responses.ts"
s = open(p).read()
old = '    candidate.name === "DomainError" &&'
new = '    candidate.name === "NeverADomainError" &&'
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/http/responses.test.ts >$BACKUP_ROOT/cg2-m.out 2>&1
m=$?
cp $BACKUP_ROOT/cg2-m.bak src/http/responses.ts
check_red "M class-identity error classification" "$m" $BACKUP_ROOT/cg2-m.out

# Restore check.
cmp -s $BACKUP_ROOT/cg2-a.bak src/services/decision-service.ts || { echo "RESTORE FAILED: decision-service.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-b.bak src/services/consent-service.ts || { echo "RESTORE FAILED: consent-service.ts (B)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-c.bak src/services/consent-service.ts || { echo "RESTORE FAILED: consent-service.ts (C)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-d.bak src/http/responses.ts || { echo "RESTORE FAILED: responses.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-e.bak src/services/consent-service.ts || { echo "RESTORE FAILED: consent-service.ts (E)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-f.bak src/services/consent-service.ts || { echo "RESTORE FAILED: consent-service.ts (F)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-g.bak src/server/container.ts || { echo "RESTORE FAILED: container.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-h.bak src/server/clock.ts || { echo "RESTORE FAILED: clock.ts (H)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-i.bak src/server/clock.ts || { echo "RESTORE FAILED: clock.ts (I)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-j.bak src/http/responses.ts || { echo "RESTORE FAILED: responses.ts (J)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-k.bak src/http/responses.ts || { echo "RESTORE FAILED: responses.ts (K)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-l.bak src/server/container.ts || { echo "RESTORE FAILED: container.ts (L)"; fail=1; }
cmp -s $BACKUP_ROOT/cg2-m.bak src/http/responses.ts || { echo "RESTORE FAILED: responses.ts (M)"; fail=1; }
rm -f $BACKUP_ROOT/cg2-*.bak $BACKUP_ROOT/cg2-*.out

if [ "$fail" -eq 0 ]; then
  echo "M2 MUTATION CHECK: PASS (all thirteen mutations turned tests red; sources restored)"
else
  echo "M2 MUTATION CHECK: FAIL"
fi
exit "$fail"
