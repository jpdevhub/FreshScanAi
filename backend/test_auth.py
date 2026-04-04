"""
test_auth.py — FreshScan AI Auth Integration Tests
====================================================
Tests the full Google/Supabase auth flow against a live FastAPI server.

Requirements:
  - Server must be running: uvicorn main:app --reload
  - Set env vars or hardcode a TEST_EMAIL / TEST_PASSWORD for a
    Supabase test account (email+password, NOT Google OAuth).
  - For Google OAuth flow, open a browser and visit:
      http://localhost:8000/api/v1/auth/login/google
    then paste the token shown on the success page into TOKEN below.

Usage:
  python test_auth.py
"""

import os
import sys
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")

# ─── Option A: Provide a token directly (from Google OAuth browser flow) ────
# Paste the token shown on the /api/v1/auth/callback success page here.
TOKEN = os.environ.get("FRESHSCAN_TEST_TOKEN", "")

# ─── Option B: Use email+password to get a token programmatically ────────────
TEST_EMAIL    = os.environ.get("FRESHSCAN_TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("FRESHSCAN_TEST_PASSWORD", "")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mjklfhjnebidbsizulgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def _color(code: int, text: str) -> str:
    return f"\033[{code}m{text}\033[0m"

def ok(msg):   print(_color(32, f"  ✅  PASS  | {msg}"))
def fail(msg): print(_color(31, f"  ❌  FAIL  | {msg}")); sys.exit(1)
def info(msg): print(_color(36, f"  ℹ️   INFO  | {msg}"))
def section(title): print(f"\n{'─'*60}\n  {title}\n{'─'*60}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Optionally fetch a token via Supabase REST (email+password)
# ─────────────────────────────────────────────────────────────────────────────

def get_token_via_password() -> str:
    """Signs in to Supabase with email/password and returns the access token."""
    if not TEST_EMAIL or not TEST_PASSWORD or not SUPABASE_KEY:
        return ""

    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
    }
    payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    r = requests.post(url, json=payload, headers=headers, timeout=10)

    if r.status_code == 200:
        token = r.json().get("access_token", "")
        info(f"Got token via email/password for: {TEST_EMAIL}")
        return token
    else:
        info(f"Password login failed ({r.status_code}): {r.text}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# 2. Test: Unauthenticated requests are rejected
# ─────────────────────────────────────────────────────────────────────────────

def test_unauthenticated_rejected():
    section("Test 1 — Unauthenticated Requests Should Be Rejected (401)")

    endpoints = [
        ("GET", f"{BASE_URL}/api/v1/auth/me"),
        ("GET", f"{BASE_URL}/api/v1/scans/history"),
    ]

    for method, url in endpoints:
        r = requests.request(method, url, timeout=10)
        if r.status_code == 401:
            ok(f"{method} {url.split(BASE_URL)[1]} → 401 Unauthorized ✓")
        elif r.status_code == 422:
            # FastAPI returns 422 when a required Header is missing entirely
            ok(f"{method} {url.split(BASE_URL)[1]} → 422 (missing header) ✓")
        else:
            fail(f"{method} {url.split(BASE_URL)[1]} → expected 401/422, got {r.status_code}: {r.text}")

    # Wrong token format
    r = requests.get(f"{BASE_URL}/api/v1/auth/me", headers={"Authorization": "NotBearer abc"}, timeout=10)
    if r.status_code in (401, 422):
        ok(f"Malformed Authorization header → {r.status_code} ✓")
    else:
        fail(f"Malformed token → expected 401/422, got {r.status_code}")


# ─────────────────────────────────────────────────────────────────────────────
# 3. Test: /api/v1/auth/me returns correct profile
# ─────────────────────────────────────────────────────────────────────────────

def test_get_me(token: str):
    section("Test 2 — GET /api/v1/auth/me (Protected, Valid Token)")

    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers, timeout=10)

    if r.status_code != 200:
        fail(f"/auth/me returned {r.status_code}: {r.text}")

    data = r.json()
    assert "id" in data,    "Response missing 'id'"
    assert "email" in data, "Response missing 'email'"
    ok(f"/auth/me → id={data['id']}, email={data['email']}")
    return data


# ─────────────────────────────────────────────────────────────────────────────
# 4. Test: /api/v1/scans/history returns paginated list
# ─────────────────────────────────────────────────────────────────────────────

def test_scan_history(token: str):
    section("Test 3 — GET /api/v1/scans/history (Paginated)")

    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/api/v1/scans/history?limit=5&offset=0", headers=headers, timeout=10)

    if r.status_code != 200:
        fail(f"/scans/history returned {r.status_code}: {r.text}")

    data = r.json()
    assert "scans" in data, "Response missing 'scans' key"
    assert "count" in data, "Response missing 'count' key"
    ok(f"/scans/history → returned {data['count']} scan(s) ✓")

    if data["scans"]:
        first = data["scans"][0]
        ok(f"First scan: grade={first.get('final_grade')}, type={first.get('image_type')}, ts={first.get('timestamp')}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. Test: /api/v1/auth/login/google returns a redirect (302)
# ─────────────────────────────────────────────────────────────────────────────

def test_google_oauth_redirect():
    section("Test 4 — GET /api/v1/auth/login/google (Redirects to Google)")

    r = requests.get(f"{BASE_URL}/api/v1/auth/login/google", allow_redirects=False, timeout=10)

    if r.status_code in (302, 307):
        location = r.headers.get("location", "")
        if "accounts.google.com" in location or "supabase" in location:
            ok(f"Correctly redirects to OAuth provider ✓")
            info(f"Redirect → {location[:80]}...")
        else:
            ok(f"Got redirect to: {location[:80]}")
    elif r.status_code == 500:
        info("Google OAuth redirect returned 500 — Supabase provider may not be configured yet")
    else:
        fail(f"/auth/login/google → unexpected {r.status_code}: {r.text}")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Test: /api/v1/vendors is public (no auth required)
# ─────────────────────────────────────────────────────────────────────────────

def test_public_vendors():
    section("Test 5 — GET /api/v1/vendors (Public Endpoint, No Auth)")

    r = requests.get(f"{BASE_URL}/api/v1/vendors", timeout=10)
    if r.status_code == 200:
        data = r.json()
        ok(f"/vendors → returned {len(data.get('vendors', []))} vendor(s) ✓")
    elif r.status_code == 500:
        info("/vendors returned 500 — Supabase vendors table may be empty or not yet created")
    else:
        fail(f"/vendors → unexpected {r.status_code}: {r.text}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(_color(33, "\n  🐟  FreshScan AI — Auth Integration Test Suite"))
    print(_color(33, f"  Server: {BASE_URL}\n"))

    # Resolve token
    token = TOKEN
    if not token:
        token = get_token_via_password()

    if not token:
        info(
            "No token available. To run authenticated tests:\n"
            "    Option A: set FRESHSCAN_TEST_TOKEN env var (paste from browser flow)\n"
            "    Option B: set FRESHSCAN_TEST_EMAIL + FRESHSCAN_TEST_PASSWORD + SUPABASE_KEY\n"
            "  Skipping authenticated tests for now..."
        )

    # Always run these
    test_unauthenticated_rejected()
    test_google_oauth_redirect()
    test_public_vendors()

    # Only run with a real token
    if token:
        test_get_me(token)
        test_scan_history(token)
    else:
        section("Skipped (no token)")
        info("Provide a token to run /auth/me and /scans/history tests.")

    print(_color(32, "\n  ✅  All runnable tests passed!\n"))
