import os
import uuid
from fastapi import HTTPException, Header
from fastapi.responses import RedirectResponse
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# ── Dev bypass auth ───────────────────────────────────────────────────────────
# Set DEV_BYPASS_AUTH=true in backend/.env for local testing.
# NEVER set this in production / HF Space secrets.
DEV_BYPASS_AUTH  = os.environ.get("DEV_BYPASS_AUTH", "false").lower() == "true"
DEV_BYPASS_TOKEN = os.environ.get("DEV_BYPASS_TOKEN", "dev-local-bypass-token")

_DEV_USER_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "dev-test-user"))


class _DevUser:
    """Minimal object that mimics a Supabase User for local dev."""
    def __init__(self):
        self.id    = _DEV_USER_ID
        self.email = "dev@freshscan.local"
        self.user_metadata = {
            "full_name":  "Dev Tester",
            "avatar_url": None,
        }

_auth_client: Client = None

def get_auth_client() -> Client:
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _auth_client

async def get_current_user(authorization: str = Header(...)):
    """
    FastAPI dependency. Validates 'Authorization: Bearer <token>'.

    In local dev (DEV_BYPASS_AUTH=true): accepts a special bypass token and
    returns a fake _DevUser without touching Supabase — no OAuth needed.
    In production: validates against Supabase as normal.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format.")

    token = authorization.split("Bearer ")[1].strip()

    # ── Dev bypass path ───────────────────────────────────────────────────────
    if DEV_BYPASS_AUTH and token == DEV_BYPASS_TOKEN:
        return _DevUser()

    # ── Normal Supabase path ──────────────────────────────────────────────────
    try:
        client = get_auth_client()
        response = client.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return response.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def get_google_oauth_url(redirect_to: str) -> str:
    """Generates the Supabase Google OAuth sign-in URL."""
    client = get_auth_client()
    response = client.auth.sign_in_with_oauth({
        "provider": "google",
        "options": {
            "redirect_to": redirect_to
        }
    })
    return response.url

def exchange_code_for_session(code: str):
    """Exchanges the PKCE auth code (from callback) for a session."""
    client = get_auth_client()
    response = client.auth.exchange_code_for_session({"auth_code": code})
    return response.session
