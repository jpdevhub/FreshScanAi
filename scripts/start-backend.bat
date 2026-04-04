@echo off
:: Starts the FastAPI backend using the project venv (includes PyTorch).
:: Called by npm run dev via concurrently on Windows.
cd /d "%~dp0\..\backend"
"%~dp0\..\.venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
