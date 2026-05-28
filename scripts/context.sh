#!/usr/bin/env bash
# context.sh — print current project state for Claude context injection
# Usage: ./scripts/context.sh
# Output: structured snapshot of branch, recent commits, open issues, dirty files
set -euo pipefail
cd "$(dirname "$0")/.."

printf '=== diet-tracker context ===\n'
printf 'time:    %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
printf 'branch:  %s\n' "$(git branch --show-current 2>/dev/null)"
printf 'head:    %s\n' "$(git log -1 --format='%h %s' 2>/dev/null)"

printf '\n-- recent commits --\n'
git log --oneline -8 2>/dev/null

printf '\n-- dirty files --\n'
git status --short 2>/dev/null | head -20

printf '\n-- open TODOs --\n'
grep -rn 'TODO\|FIXME\|HACK\|XXX' \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir='.next' \
  . 2>/dev/null | head -15 || echo "(none)"

printf '\n-- security risks (OPEN) --\n'
grep -h '| OPEN' docs/security/HARDENING_CHECKLIST.md 2>/dev/null | \
  grep -v '^|---' | head -10 || echo "(checklist not found)"
