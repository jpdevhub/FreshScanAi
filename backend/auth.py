import os
from fastapi import HTTPException, Header
from fastapi.responses import RedirectResponse
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mjklfhjnebidbsizulgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

_auth_client: Client = None

def get_auth_client() -> Client:
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _auth_client

async def get_current_user(authorization: str = Header(...)):
    """
    FastAPI dependency. Reads 'Authorization: Bearer <token>' header,
    validates with Supabase, returns the user object. Raises 401 if invalid.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format.")
    
    token = authorization.split("Bearer ")[1].strip()
    
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
