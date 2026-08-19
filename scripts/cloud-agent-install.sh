#!/usr/bin/env bash
# Idempotent install for Cursor Cloud Agents + local collaborator machines.
# Landing lives in the workspace; Tutor is cloned beside it under $HOME.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TUTOR_DIR="${AIRA_TUTOR_DIR:-$HOME/AIra-AI-tutor}"
TUTOR_REPO_URL="${AIRA_TUTOR_REPO_URL:-https://github.com/maheshpolamreddy/AIra---AI-tutor.git}"

echo "==> Installing AIra Landing Page deps (pnpm)…"
cd "$ROOT"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  corepack enable >/dev/null 2>&1 || true
  npm install -g pnpm@10 >/dev/null 2>&1 || true
  pnpm install
fi

if [[ ! -f "$ROOT/.env.local" && -f "$ROOT/.env.example" ]]; then
  echo "==> Creating .env.local from .env.example (Firebase defaults are in lib/firebase/config.ts)"
  cp "$ROOT/.env.example" "$ROOT/.env.local"
fi

echo "==> Ensuring AIra AI Tutor checkout at $TUTOR_DIR…"
if [[ -d "$TUTOR_DIR/.git" ]]; then
  git -C "$TUTOR_DIR" fetch --quiet origin || true
  # Stay on the current branch; only fast-forward when clean and tracking main
  if [[ -z "$(git -C "$TUTOR_DIR" status --porcelain)" ]]; then
    current="$(git -C "$TUTOR_DIR" rev-parse --abbrev-ref HEAD)"
    if [[ "$current" == "main" ]]; then
      git -C "$TUTOR_DIR" pull --ff-only origin main || true
    fi
  fi
else
  git clone "$TUTOR_REPO_URL" "$TUTOR_DIR"
fi

echo "==> Installing AIra AI Tutor deps (npm)…"
cd "$TUTOR_DIR"
npm install

if [[ ! -f "$TUTOR_DIR/.env" && -f "$TUTOR_DIR/.env.example" ]]; then
  echo "==> Creating tutor .env from .env.example"
  cp "$TUTOR_DIR/.env.example" "$TUTOR_DIR/.env"
fi

echo "==> Install complete."
echo "    Landing: $ROOT"
echo "    Tutor:   $TUTOR_DIR"
echo "    Run both: bash $ROOT/scripts/dev-both.sh"
