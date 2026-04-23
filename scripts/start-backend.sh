#!/bin/sh
# Starts the FastAPI backend (called by `npm run dev` via concurrently).
#
# Python resolution order:
#   1. .venv/bin/python3 at the repo root   (recommended — has PyTorch)
#   2. System python3                        (demo mode, no ML models)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
VENV_PYTHON="$REPO_ROOT/.venv/bin/python3"

if [ -x "$VENV_PYTHON" ]; then
  PYTHON="$VENV_PYTHON"
else
  echo ""
  echo " WARNING: .venv not found at $REPO_ROOT/.venv"
  echo "   Falling back to system python3 (demo mode — ML models disabled)."
  echo "   Run 'python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt'"
  echo "   to enable full inference."
  echo ""
  PYTHON="python3"
fi

cd "$REPO_ROOT/backend" && "$PYTHON" -m uvicorn main:app --reload --port 8000
