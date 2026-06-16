"""
Real-world fish market locations via OpenStreetMap Overpass API.
Endpoint: GET /api/v1/maps/markets/live?lat=...&lng=...&radius=5000
"""
import httpx
import math
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v1/maps/markets", tags=["markets"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

OVERPASS_QUERY_TEMPLATE = """
[out:json][timeout:25];
(
  node["shop"="seafood"]({south},{west},{north},{east});
  node["shop"="fish"]({south},{west},{north},{east});
  node["amenity"="marketplace"]["name"~"fish|seafood|market",i]({south},{west},{north},{east});
  node["landuse"="retail"]["name"~"fish|seafood",i]({south},{west},{north},{east});
);
out body;
"""


def _lat_lng_to_bbox(lat: float, lng: float, radius_m: float):
    """Convert center + radius to bounding box (south, west, north, east)."""
    delta_lat = radius_m / 111320
    delta_lng = radius_m / (111320 * abs(math.cos(math.radians(lat))) + 1e-9)
    return {
        "south": lat - delta_lat,
        "west": lng - delta_lng,
        "north": lat + delta_lat,
        "east": lng + delta_lng,
    }


def _parse_overpass(elements: list, fallback_score: int = 70) -> list:
    """Normalize Overpass API elements into the MarketMapPage format."""
    markets = []
    for i, el in enumerate(elements):
        tags = el.get("tags", {})
        name = (
            tags.get("name")
            or tags.get("name:en")
            or tags.get("shop")
            or "Fish Market"
        )
        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            continue
        markets.append({
            "id": el.get("id", i + 1),
            "name": name,
            "score": fallback_score,
            "lat": float(lat),
            "lng": float(lon),
            "vendors": 1,
            "source": "openstreetmap",
            "address": tags.get("addr:full") or tags.get("addr:street") or "",
        })
    return markets


@router.get("/live")
async def get_live_markets(
    lat: float = Query(..., description="Latitude of user location"),
    lng: float = Query(..., description="Longitude of user location"),
    radius: int = Query(default=5000, ge=500, le=50000, description="Search radius in meters"),
):
    """
    Fetch real-world fish markets near a location using OpenStreetMap Overpass API.
    Falls back to empty list if Overpass is unavailable.
    """
    bbox = _lat_lng_to_bbox(lat, lng, radius)
    query = OVERPASS_QUERY_TEMPLATE.format(**bbox)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "FreshScanAI/1.0 (https://github.com/jpdevhub/FreshScanAi)",
                },
            )
            response.raise_for_status()
            data = response.json()
            elements = data.get("elements", [])
            markets = _parse_overpass(elements)
            return {
                "success": True,
                "source": "openstreetmap",
                "count": len(markets),
                "lat": lat,
                "lng": lng,
                "radius_m": radius,
                "markets": markets,
            }
    except httpx.TimeoutException:
        return {
            "success": False,
            "source": "openstreetmap",
            "error": "Overpass API timed out. Try again or reduce radius.",
            "markets": [],
        }
    except Exception as exc:
        return {
            "success": False,
            "source": "openstreetmap",
            "error": str(exc),
            "markets": [],
        }
