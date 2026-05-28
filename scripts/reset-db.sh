#!/usr/bin/env bash
# reset-db.sh — reset local Supabase and re-apply migrations
# Usage: ./scripts/reset-db.sh [--seed]
set -euo pipefail
cd "$(dirname "$0")/.."

SEED=false
[[ "${1:-}" == "--seed" ]] && SEED=true

echo "Resetting local Supabase database..."
read -r -p "This will DROP all local data. Continue? [y/N] " confirm
[[ "${confirm,,}" != "y" ]] && { echo "Aborted."; exit 0; }

npx supabase db reset

if $SEED; then
  echo "Running seed..."
  npx supabase db seed 2>/dev/null || echo "(no seed file found — skipping)"
fi

echo "Done. Run 'npx supabase status' to verify."
