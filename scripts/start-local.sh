#!/usr/bin/env bash
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$task_root"
if [[ ! -x backend/.venv/bin/python ]]; then
  printf '%s\n' 'Install dependencies first: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt' >&2
  exit 1
fi
if [[ ! -f frontend/dist/index.html ]]; then
  printf '%s\n' 'Build the frontend first: cd frontend && npm ci && npm run build' >&2
  exit 1
fi
mkdir -p .local
export DATABASE_URL="${DATABASE_URL:-sqlite:///$task_root/.local/scamshield.db}"
export FRONTEND_DIST="$task_root/frontend/dist"
exec backend/.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port "${PORT:-8000}"
