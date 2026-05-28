#!/usr/bin/env bash
# watch.sh — start development watchers in tmux server window
# Usage: ./scripts/watch.sh [--no-attach]
# Requires: dev-session already running (server window must exist)
set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="diet-tracker"
ATTACH=true
[[ "${1:-}" == "--no-attach" ]] && ATTACH=false

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' not running. Start it first:"
  echo "  dev-session $(pwd)"
  exit 1
fi

echo "Starting watchers in $SESSION:server..."

# Left pane: dev server
tmux send-keys -t "$SESSION:server.devserver" "" ""  # ensure focused
tmux send-keys -t "$SESSION:server.devserver" "npm run dev" Enter

# Right pane: tsc watch (errors only)
tmux send-keys -t "$SESSION:server.tsc" \
  "npx tsc --noEmit --watch 2>&1 | grep --line-buffered -E 'error TS|Found [0-9]+ error|Watching'" Enter

echo "Watchers started:"
echo "  devserver — npm run dev"
echo "  tsc       — tsc --noEmit --watch (errors only)"

if $ATTACH; then
  tmux select-window -t "$SESSION:server"
  tmux attach -t "$SESSION"
fi
