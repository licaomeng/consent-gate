#!/bin/bash
# Mutation checks for M1 safety rules. A mutation that leaves tests green is a gap.
cd "$(dirname "$0")/.." || exit 1
set -u
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

# A. Hard block must never be overridden by consent.
cp src/domain/decision.ts $BACKUP_ROOT/cg-a.bak
python3 - <<'PY'
p = "src/domain/decision.ts"
s = open(p).read()
old = '''  // A hard block is never overridden by consent, including an old approval.
  if (rule.ifUnder === "blocked") {
    return { ...base, decision: "blocked", reason: "under_minimum_age" };
  }
'''
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "", 1))
PY
./node_modules/.bin/vitest run tests/domain/decision.test.ts >$BACKUP_ROOT/cg-a.out 2>&1
a=$?
cp $BACKUP_ROOT/cg-a.bak src/domain/decision.ts
check_red "A hard-block guard removed" "$a" $BACKUP_ROOT/cg-a.out

# B. Client jurisdiction normalization (lowercase must not fall to wildcard).
cp src/domain/policy.ts $BACKUP_ROOT/cg-b.bak
python3 - <<'PY'
p = "src/domain/policy.ts"
s = open(p).read()
old = "const normalized = value.trim().toUpperCase();"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "const normalized = value.trim();", 1))
PY
./node_modules/.bin/vitest run tests/domain/scenario.test.ts >$BACKUP_ROOT/cg-b.out 2>&1
b=$?
cp $BACKUP_ROOT/cg-b.bak src/domain/policy.ts
check_red "jurisdiction uppercase removed" "$b" $BACKUP_ROOT/cg-b.out

# C. Unknown request keys (client-supplied evaluationDate) must be rejected.
cp src/domain/scenario.ts $BACKUP_ROOT/cg-c.bak
python3 - <<'PY'
p = "src/domain/scenario.ts"
s = open(p).read()
old = "const scenarioSchema = z.strictObject({"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, "const scenarioSchema = z.object({", 1))
PY
./node_modules/.bin/vitest run tests/domain/scenario.test.ts >$BACKUP_ROOT/cg-c.out 2>&1
c=$?
cp $BACKUP_ROOT/cg-c.bak src/domain/scenario.ts
check_red "strict request shape relaxed" "$c" $BACKUP_ROOT/cg-c.out

# D. resolveRule must normalize/validate its own boundary (raw lowercase input).
cp src/domain/policy.ts $BACKUP_ROOT/cg-d.bak
python3 - <<'PY'
p = "src/domain/policy.ts"
s = open(p).read()
old = """  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);
  const candidates = buildLookupPath(normalizedJurisdiction);"""
assert old in s, "anchor missing"
new = """  const normalizedJurisdiction = jurisdiction;
  const candidates = buildLookupPath(normalizedJurisdiction);"""
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/domain/policy.test.ts tests/domain/decision.test.ts >$BACKUP_ROOT/cg-d.out 2>&1
d=$?
cp $BACKUP_ROOT/cg-d.bak src/domain/policy.ts
check_red "resolveRule boundary normalization removed" "$d" $BACKUP_ROOT/cg-d.out

# Confirm every file was restored byte-for-byte.
cmp -s $BACKUP_ROOT/cg-a.bak src/domain/decision.ts || { echo "RESTORE FAILED: decision.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg-b.bak src/domain/policy.ts || { echo "RESTORE FAILED: policy.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg-c.bak src/domain/scenario.ts || { echo "RESTORE FAILED: scenario.ts"; fail=1; }
cmp -s $BACKUP_ROOT/cg-d.bak src/domain/policy.ts || { echo "RESTORE FAILED: policy.ts (D)"; fail=1; }
rm -f $BACKUP_ROOT/cg-a.bak $BACKUP_ROOT/cg-b.bak $BACKUP_ROOT/cg-c.bak $BACKUP_ROOT/cg-d.bak $BACKUP_ROOT/cg-a.out $BACKUP_ROOT/cg-b.out $BACKUP_ROOT/cg-c.out $BACKUP_ROOT/cg-d.out

if [ "$fail" -eq 0 ]; then
  echo "MUTATION CHECK: PASS (all four mutations turned tests red; sources restored)"
else
  echo "MUTATION CHECK: FAIL"
fi
exit "$fail"
