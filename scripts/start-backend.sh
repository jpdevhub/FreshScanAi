#!/bin/sh
# Starts the FastAPI backend using the project venv (includes PyTorch).
# Called by npm run dev via concurrently.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../backend" && "$SCRIPT_DIR/../.venv/bin/python3" -m uvicorn main:app --reload --port 8000
