#!/bin/bash
# M3 mutation checks. A mutation that leaves tests green is a gap.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

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

# A. A hard block must never offer Ask a parent.
cp src/application/workflow.ts /tmp/cg3-a.bak
python3 - <<'PY'
p = "src/application/workflow.ts"
s = open(p).read()
old = "    canAskParent: needsConsent && request === null,"
new = "    canAskParent: request === null,"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/application/workflow.test.ts >/tmp/cg3-a.out 2>&1
a=$?
cp /tmp/cg3-a.bak src/application/workflow.ts
check_red "A hard block offers Ask" "$a" /tmp/cg3-a.out

# B. A pending request must not be recreated.
cp src/application/workflow.ts /tmp/cg3-b.bak
python3 - <<'PY'
p = "src/application/workflow.ts"
s = open(p).read()
old = "    canAskParent: needsConsent && request === null,"
new = "    canAskParent: needsConsent || request !== null,"
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/application/workflow.test.ts >/tmp/cg3-b.out 2>&1
b=$?
cp /tmp/cg3-b.bak src/application/workflow.ts
check_red "B pending request can be re-asked" "$b" /tmp/cg3-b.out

# C. Approve/decline must follow the current status.
cp src/application/workflow.ts /tmp/cg3-c.bak
python3 - <<'PY'
p = "src/application/workflow.ts"
s = open(p).read()
old = '    canApprove: request !== null && request.status !== "approved",'
new = '    canApprove: request !== null && request.status !== "declined",'
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/application/workflow.test.ts >/tmp/cg3-c.out 2>&1
c=$?
cp /tmp/cg3-c.bak src/application/workflow.ts
check_red "C approve matrix inverted" "$c" /tmp/cg3-c.out

# D. Requests must be matched by the full scope.
cp src/application/workflow.ts /tmp/cg3-d.bak
python3 - <<'PY'
p = "src/application/workflow.ts"
s = open(p).read()
old = """        request.subjectId === scenario.subjectId &&
        request.jurisdiction === scenario.jurisdiction &&
        request.feature === scenario.feature,"""
new = """        request.subjectId === scenario.subjectId &&
        request.jurisdiction === scenario.jurisdiction,"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/application/workflow.test.ts >/tmp/cg3-d.out 2>&1
d=$?
cp /tmp/cg3-d.bak src/application/workflow.ts
check_red "D feature omitted from scope match" "$d" /tmp/cg3-d.out

# E. Demo expectations must match the real engine.
cp src/demo/scenarios.ts /tmp/cg3-e.bak
python3 - <<'PY'
p = "src/demo/scenarios.ts"
s = open(p).read()
old = """    id: "british-child-chat",
    label: "British child chat",
    ageYears: 11,
    jurisdiction: "GB",
    feature: "chat",
    purpose: "Exact hard block beats the global consent rule.",
    expected: { decision: "blocked", reason: "under_minimum_age" },"""
new = """    id: "british-child-chat",
    label: "British child chat",
    ageYears: 11,
    jurisdiction: "GB",
    feature: "chat",
    purpose: "Exact hard block beats the global consent rule.",
    expected: { decision: "allowed", reason: "under_minimum_age" },"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
./node_modules/.bin/vitest run tests/demo/scenarios.test.ts >/tmp/cg3-e.out 2>&1
e=$?
cp /tmp/cg3-e.bak src/demo/scenarios.ts
check_red "E demo expectation drift" "$e" /tmp/cg3-e.out

# F. Inputs must be locked while a write is in flight.
cp src/components/ConsentGatePage.tsx /tmp/cg3-f.bak
python3 - <<'PY'
p = "src/components/ConsentGatePage.tsx"
s = open(p).read()
old = """            <input
              id="jurisdiction"
              value={draft.jurisdiction}
              disabled={busy}
              onChange={(event) => updateDraft({ jurisdiction: event.target.value })}
            />"""
new = """            <input
              id="jurisdiction"
              value={draft.jurisdiction}
              onChange={(event) => updateDraft({ jurisdiction: event.target.value })}
            />"""
assert old in s, "anchor missing"
open(p, "w").write(s.replace(old, new, 1))
PY
npm run build >/tmp/cg3-f-build1.out 2>&1
build_rc=$?
if [ "$build_rc" -ne 0 ]; then
  echo "F input lock removed: build failed"
  tail -5 /tmp/cg3-f-build1.out
  fail=1
else
  ./node_modules/.bin/playwright test -g "locks the scenario inputs" >/tmp/cg3-f.out 2>&1
  f=$?
  check_red "F input lock removed" "$f" /tmp/cg3-f.out
fi
cp /tmp/cg3-f.bak src/components/ConsentGatePage.tsx
npm run build >/tmp/cg3-f-build2.out 2>&1 || { echo "F restore build failed"; fail=1; }

# Restore check.
cmp -s /tmp/cg3-a.bak src/application/workflow.ts || { echo "RESTORE FAILED: workflow.ts (A)"; fail=1; }
cmp -s /tmp/cg3-b.bak src/application/workflow.ts || { echo "RESTORE FAILED: workflow.ts (B)"; fail=1; }
cmp -s /tmp/cg3-c.bak src/application/workflow.ts || { echo "RESTORE FAILED: workflow.ts (C)"; fail=1; }
cmp -s /tmp/cg3-d.bak src/application/workflow.ts || { echo "RESTORE FAILED: workflow.ts (D)"; fail=1; }
cmp -s /tmp/cg3-e.bak src/demo/scenarios.ts || { echo "RESTORE FAILED: scenarios.ts"; fail=1; }
cmp -s /tmp/cg3-f.bak src/components/ConsentGatePage.tsx || { echo "RESTORE FAILED: ConsentGatePage.tsx"; fail=1; }
rm -f /tmp/cg3-*.bak /tmp/cg3-*.out /tmp/cg3-f-build1.out /tmp/cg3-f-build2.out

if [ "$fail" -eq 0 ]; then
  echo "M3 MUTATION CHECK: PASS (all six mutations turned tests red; sources restored)"
else
  echo "M3 MUTATION CHECK: FAIL"
fi
exit "$fail"
