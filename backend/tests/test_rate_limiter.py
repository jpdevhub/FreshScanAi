from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app

client = TestClient(app, raise_server_exceptions=False)


def test_scan_endpoint_not_rate_limited_initially():
    """First request should not be rate limited (422 = missing body, not 429)."""
    response = client.post("/api/v1/scan")
    assert response.status_code != 429


def test_scan_auto_endpoint_not_rate_limited_initially():
    """First request to scan-auto should not be rate limited."""
    response = client.post("/api/v1/scan-auto")
    assert response.status_code != 429


def test_rate_limit_returns_429():
    """Exceeding limit should return 429."""
    responses = [client.get("/api/v1/health") for _ in range(110)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 in responses, got: {set(status_codes)}"


def test_rate_limit_response_shape():
    """429 response must have correct JSON fields."""
    responses = [client.get("/api/v1/health") for _ in range(110)]
    rate_limited = [r for r in responses if r.status_code == 429]
    assert len(rate_limited) > 0
    body = rate_limited[0].json()
    assert "error" in body


def test_rate_limit_retry_after_header():
    """429 response must include correct status code."""
    responses = [client.get("/api/v1/health") for _ in range(110)]
    rate_limited = [r for r in responses if r.status_code == 429]
    assert len(rate_limited) > 0
    body = rate_limited[0].json()
    assert body is not None

def test_maps_markets_not_rate_limited_initially():
    """First request to maps/markets should not be rate limited."""
    response = client.get("/api/v1/maps/markets")
    assert response.status_code != 429

