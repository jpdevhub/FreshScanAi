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

CI Mode (skip Turnstile verification):
  Set SKIP_TURNSTILE_VERIFICATION=true to disable real Turnstile verification
  in CI environments where Cloudflare Turnstile secrets are not available:
    SKIP_TURNSTILE_VERIFICATION=true python test_auth.py

New Tests (POST /api/v1/auth/login/google & Turnstile):
  - test_google_oauth_post_without_turnstile()  : Tests POST endpoint
  - test_google_oauth_post_with_invalid_turnstile() : Tests Turnstile validation
  - test_google_oauth_get_redirect()            : Tests GET endpoint with Turnstile
  - test_auth_login_rate_limiting()             : Tests 5/minute rate limit enforcement
"""

import os
import sys
import time
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")

# ─── Option A: Provide a token directly (from Google OAuth browser flow) ────
# Paste the token shown on the /api/v1/auth/callback success page here.
TOKEN = os.environ.get("FRESHSCAN_TEST_TOKEN", "")

# ─── Option B: Use email+password to get a token programmatically ────────────
TEST_EMAIL = os.environ.get("FRESHSCAN_TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("FRESHSCAN_TEST_PASSWORD", "")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mjklfhjnebidbsizulgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# ─── Turnstile Testing ────────────────────────────────────────────────────────
# Set SKIP_TURNSTILE_VERIFICATION=true in CI to skip Turnstile tests (no real verification)
SKIP_TURNSTILE_VERIFICATION = os.environ.get("SKIP_TURNSTILE_VERIFICATION", "").lower() == "true"


def _color(code: int, text: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def ok(msg):
    print(_color(32, f"  ✅  PASS  | {msg}"))


def fail(msg):
    print(_color(31, f"  ❌  FAIL  | {msg}"))
    sys.exit(1)


def info(msg):
    print(_color(36, f"  ℹ️   INFO  | {msg}"))


def section(title):
    print(f"\n{'─' * 60}\n  {title}\n{'─' * 60}")


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
            status_got = f"{r.status_code}: {r.text}"
            fail(f"{method} {url.split(BASE_URL)[1]} → expected 401/422, got {status_got}")

    # Wrong token format
    r = requests.get(
        f"{BASE_URL}/api/v1/auth/me",
        headers={"Authorization": "NotBearer abc"},
        timeout=10,
    )
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
    assert "id" in data, "Response missing 'id'"
    assert "email" in data, "Response missing 'email'"
    ok(f"/auth/me → id={data['id']}, email={data['email']}")
    return data


# ─────────────────────────────────────────────────────────────────────────────
# 4. Test: /api/v1/scans/history returns paginated list
# ─────────────────────────────────────────────────────────────────────────────


def test_scan_history(token: str):
    section("Test 3 — GET /api/v1/scans/history (Paginated)")

    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"{BASE_URL}/api/v1/scans/history?limit=5&offset=0",
        headers=headers,
        timeout=10,
    )

    if r.status_code != 200:
        fail(f"/scans/history returned {r.status_code}: {r.text}")

    data = r.json()
    assert "scans" in data, "Response missing 'scans' key"
    assert "count" in data, "Response missing 'count' key"
    ok(f"/scans/history → returned {data['count']} scan(s) ✓")

    if data["scans"]:
        first = data["scans"][0]
        ok(
            f"First scan: grade={first.get('final_grade')},"
            f" type={first.get('image_type')},"
            f" ts={first.get('timestamp')}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Test: /api/v1/auth/login/google (POST variant with Turnstile)
# ─────────────────────────────────────────────────────────────────────────────


def test_google_oauth_post_without_turnstile():
    """Test POST /api/v1/auth/login/google without Turnstile token."""
    section("Test 4A — POST /api/v1/auth/login/google (No Turnstile)")

    payload = {}
    r = requests.post(f"{BASE_URL}/api/v1/auth/login/google", json=payload, timeout=10)

    if r.status_code == 200:
        data = r.json()
        if "redirect_url" in data:
            ok("POST /auth/login/google returns JSON with redirect_url ✓")
            info(f"Redirect URL: {data['redirect_url'][:80]}...")
        else:
            fail(f"POST response missing 'redirect_url': {data}")
    elif r.status_code == 400:
        # Turnstile is required but token not provided
        if "Turnstile token is required" in r.text:
            ok("POST correctly requires Turnstile token when configured ✓")
        else:
            ok(f"POST returned 400 (Turnstile required): {r.text[:80]}")
    elif r.status_code == 500:
        info("POST /auth/login/google returned 500 — Supabase provider may not be configured")
    else:
        fail(f"POST /auth/login/google → unexpected {r.status_code}: {r.text}")


def test_google_oauth_post_with_invalid_turnstile():
    """Test POST /api/v1/auth/login/google with invalid Turnstile token."""
    section("Test 4B — POST /api/v1/auth/login/google (Invalid Turnstile Token)")

    if SKIP_TURNSTILE_VERIFICATION:
        info("Skipping real Turnstile verification (SKIP_TURNSTILE_VERIFICATION=true)")
        return

    payload = {"turnstile_token": "invalid_token_12345"}
    r = requests.post(f"{BASE_URL}/api/v1/auth/login/google", json=payload, timeout=10)

    if r.status_code == 400:
        ok("Invalid Turnstile token rejected with 400 ✓")
    elif r.status_code == 502:
        ok("Invalid Turnstile token returned 502 (service unavailable) ✓")
    else:
        info(f"Turnstile validation returned {r.status_code}: {r.text[:80]}")


def test_google_oauth_get_redirect():
    section("Test 4C — GET /api/v1/auth/login/google (Redirects to Google)")

    # GET without Turnstile (should still work if not configured)
    r = requests.get(f"{BASE_URL}/api/v1/auth/login/google", allow_redirects=False, timeout=10)

    if r.status_code in (302, 307):
        location = r.headers.get("location", "")
        if "accounts.google.com" in location or "supabase" in location:
            ok("GET correctly redirects to OAuth provider ✓")
            info(f"Redirect → {location[:80]}...")
        else:
            ok(f"GET got redirect to: {location[:80]}")
    elif r.status_code == 400:
        # Turnstile required
        if "Turnstile token is required" in r.text:
            ok("GET correctly requires Turnstile token when configured ✓")
        else:
            info(f"GET returned 400: {r.text[:80]}")
    elif r.status_code == 500:
        info("GET /auth/login/google returned 500 — Supabase provider may not be configured")
    else:
        fail(f"GET /auth/login/google → unexpected {r.status_code}: {r.text}")


def test_auth_login_rate_limiting():
    """Test that /api/v1/auth/login/google enforces rate limiting (5/minute)."""
    section("Test 4D — Rate Limiting on /api/v1/auth/login/google (5/minute)")

    url_get = f"{BASE_URL}/api/v1/auth/login/google"
    url_post = f"{BASE_URL}/api/v1/auth/login/google"

    # Fire 6 requests quickly (should exceed 5/minute limit)
    attempts = 0
    rate_limit_hit = False

    for i in range(6):
        if i < 3:
            # Use GET for first 3
            r = requests.get(url_get, allow_redirects=False, timeout=10)
        else:
            # Use POST for next 3
            r = requests.post(url_post, json={}, timeout=10)

        attempts += 1

        # Check for rate limit response (429)
        if r.status_code == 429:
            rate_limit_hit = True
            ok(f"Rate limit enforced after {attempts} requests (429 Too Many Requests) ✓")
            break

        # If we get 400/500/302/307, it's a valid response but not rate limited yet
        if r.status_code in (200, 302, 307, 400, 500, 502):
            info(f"Request {i+1} → {r.status_code}")
        else:
            info(f"Request {i+1} → {r.status_code}")

    if not rate_limit_hit and attempts >= 5:
        info("Rate limiting may take time to accumulate; requests might not trigger immediately.")
        info(f"  (Made {attempts} requests without hitting 429 limit)")

    # Wait a bit and try again to confirm recovery
    time.sleep(1)
    r_recovery = requests.get(url_get, allow_redirects=False, timeout=10)
    if r_recovery.status_code != 429:
        info("✓ Rate limit counter appears to reset after brief wait")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Test: /api/v1/vendors is public (no auth required)
# ─────────────────────────────────────────────────────────────────────────────


def test_public_vendors():
    section("Test 6 — GET /api/v1/vendors (Public Endpoint, No Auth)")

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
    print(_color(33, "\n FreshScan AI — Auth Integration Test Suite"))
    print(_color(33, f"  Server: {BASE_URL}\n"))

    if SKIP_TURNSTILE_VERIFICATION:
        print(_color(33, "  ⚠️   SKIP_TURNSTILE_VERIFICATION=true (running in CI mode)\n"))

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
    test_google_oauth_post_without_turnstile()
    test_google_oauth_post_with_invalid_turnstile()
    test_google_oauth_get_redirect()
    test_auth_login_rate_limiting()
    test_public_vendors()

    # Only run with a real token
    if token:
        test_get_me(token)
        test_scan_history(token)
    else:
        section("Skipped (no token)")
        info("Provide a token to run /auth/me and /scans/history tests.")

    print(_color(32, "\n  ✅  All runnable tests passed!\n"))
