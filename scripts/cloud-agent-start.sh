#!/usr/bin/env bash
# Lightweight start hook for Cursor Cloud Agents.
# Long-running apps are started via environment.json terminals / scripts/dev-both.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TUTOR_DIR="${AIRA_TUTOR_DIR:-$HOME/AIra-AI-tutor}"

echo "AIra environment ready."
echo "  Landing workspace: $ROOT"
echo "  Tutor checkout:    $TUTOR_DIR"
echo "  Start both apps:   bash $ROOT/scripts/dev-both.sh"
echo "  Or open terminals: pnpm dev  (landing) + npm run dev (tutor)"
