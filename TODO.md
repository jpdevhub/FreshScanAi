# FreshScanAi - Backend error resolution

## Plan (approved)
- Fix build-time errors and likely import/module conflicts in `backend/main.py`.
- Ensure `backend/main.py` correctly imports local modules when run as a package.
- Make DB insert failures visible (no silent success) for scan endpoints.

## Steps
1. Update `backend/main.py` to use package-relative imports (`from .auth ...`, `from .turnstile ...`, `from .rate_limiter ...`, etc.).
2. Fix vendor router registration import to use relative imports.
3. Update scan endpoints (`/api/v1/scan` and `/api/v1/scan-auto`) so DB write failures raise HTTP 500 (instead of printing and continuing success).
4. Run backend import check (e.g., `python -c "from backend.main import app"`) and run unit tests if available.

