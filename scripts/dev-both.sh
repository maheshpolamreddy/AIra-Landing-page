#!/usr/bin/env bash
# Start Landing (:3000) + Tutor (:5173) for local / cloud development.
# Open http://localhost:3000 — landing proxies /student /teacher /admin /dev to the tutor.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TUTOR_DIR="${AIRA_TUTOR_DIR:-$HOME/AIra-AI-tutor}"

if [[ ! -d "$TUTOR_DIR" ]]; then
  echo "Tutor repo missing at $TUTOR_DIR. Run: bash $ROOT/scripts/cloud-agent-install.sh" >&2
  exit 1
fi

SESSION="${AIRA_DEV_TMUX_SESSION:-aira-dev}"
TMUX_CFG="/exec-daemon/tmux.portal.conf"
TMUX=(tmux)
if [[ -f "$TMUX_CFG" ]]; then
  TMUX=(tmux -f "$TMUX_CFG")
fi

if "${TMUX[@]}" has-session -t "=$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists. Attach with: ${TMUX[*]} attach -t $SESSION"
  exit 0
fi

"${TMUX[@]}" new-session -d -s "$SESSION" -c "$ROOT" -- "${SHELL:-bash}" -l
"${TMUX[@]}" send-keys -t "$SESSION:0.0" "cd '$ROOT' && pnpm dev" C-m
"${TMUX[@]}" split-window -t "$SESSION:0" -h -c "$TUTOR_DIR" -- "${SHELL:-bash}" -l
"${TMUX[@]}" send-keys -t "$SESSION:0.1" "cd '$TUTOR_DIR' && npm run dev" C-m

echo "Started tmux session '$SESSION'"
echo "  Landing → http://localhost:3000"
echo "  Tutor   → http://127.0.0.1:5173 (also via landing proxy)"
echo "  Attach  → ${TMUX[*]} attach -t $SESSION"
