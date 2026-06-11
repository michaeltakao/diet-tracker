#!/usr/bin/env bash
# check.sh — run tsc + lint in one shot, exit non-zero if either fails
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0

run() {
  local label="$1"; shift
  printf '── %s ──\n' "$label"
  if "$@"; then
    printf '✓ %s\n\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '✗ %s\n\n' "$label"
    FAIL=$((FAIL + 1))
  fi
}

run "TypeScript" npx tsc --noEmit
run "ESLint"    npm run lint -- --max-warnings=0

printf '═══════════════════\n'
printf 'passed: %s  failed: %s\n' "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]]
