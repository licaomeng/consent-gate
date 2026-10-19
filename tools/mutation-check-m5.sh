#!/bin/bash
# M5 mutation checks. A mutation that leaves tests green is a gap.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

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

mutate_and_check () {
  local name="$1" file="$2" anchor="$3" replacement="$4" grep="$5" tag="$6"
  cp "$file" "$BACKUP_ROOT/$tag.bak"
  python3 - "$file" "$anchor" "$replacement" <<'PY'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p).read()
if old not in s:
    print("NOT-EXERCISED: anchor missing")
    sys.exit(2)
open(p, "w").write(s.replace(old, new, 1))
PY
  anchor_rc=$?
  if [ "$anchor_rc" -ne 0 ]; then
    echo "$name: NOT-EXERCISED (anchor missing)"
    fail=1
    cp "$BACKUP_ROOT/$tag.bak" "$file"
    return
  fi
  npm run build >"$BACKUP_ROOT/$tag-build.out" 2>&1
  local build_rc=$?
  if [ "$build_rc" -ne 0 ]; then
    echo "$name: build failed"
    tail -5 "$BACKUP_ROOT/$tag-build.out"
    fail=1
  else
    ./node_modules/.bin/playwright test -g "$grep" >"$BACKUP_ROOT/$tag.out" 2>&1
    check_red "$name" "$?" "$BACKUP_ROOT/$tag.out"
  fi
  cp "$BACKUP_ROOT/$tag.bak" "$file"
}

# A. Escape must dismiss the tooltip.
mutate_and_check "A Escape dismissal removed" \
  src/components/HelpTip.tsx \
  'if (event.key === "Escape")' \
  'if (event.key === "Never")' \
  "explains key controls" "cg5-a"

# B. The visible status badge must not be a second live region.
mutate_and_check "B duplicate live region restored" \
  src/components/ConsentGatePage.tsx \
  '                  className={`status status-${request.status}`}
                  data-testid="request-status"' \
  '                  className={`status status-${request.status}`}
                  data-testid="request-status"
                  role="status"
                  aria-live="polite"' \
  "runs the full consent loop" "cg5-b"

# C. Subject ids must be shortened for display only.
mutate_and_check "C full subject id displayed" \
  src/components/ConsentGatePage.tsx \
  '  if (uuid) return `${uuid[1]}${uuid[2]}`;' \
  '  if (uuid) return id;' \
  "creates a new synthetic subject" "cg5-c"

cmp -s "$BACKUP_ROOT/cg5-a.bak" src/components/HelpTip.tsx || { echo "RESTORE FAILED: HelpTip.tsx"; fail=1; }
cmp -s "$BACKUP_ROOT/cg5-b.bak" src/components/ConsentGatePage.tsx || { echo "RESTORE FAILED: ConsentGatePage.tsx (B)"; fail=1; }
cmp -s "$BACKUP_ROOT/cg5-c.bak" src/components/ConsentGatePage.tsx || { echo "RESTORE FAILED: ConsentGatePage.tsx (C)"; fail=1; }
npm run build >"$BACKUP_ROOT/cg5-restore-build.out" 2>&1 || { echo "restore build failed"; tail -5 "$BACKUP_ROOT/cg5-restore-build.out"; fail=1; }

if [ "$fail" -eq 0 ]; then
  echo "M5 MUTATION CHECK: PASS (all three mutations turned tests red; sources restored)"
else
  echo "M5 MUTATION CHECK: FAIL"
fi
exit "$fail"
