from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta, timezone
from auth import get_current_user
from fastapi_cache import FastAPICache

router = APIRouter(prefix="/api/v1/vendors", tags=["vendors"])

ACHIEVEMENTS = {
    "fresh_streak_50": {
        "title": "50x Grade A Streak",
        "description": "Awarded for 50 consecutive Grade A scans.",
        "icon": "bolt",
        "tier": "legendary",
    },
    "consistent_30d": {
        "title": "30 Days Consistently Fresh",
        "description": "Awarded after Grade A scans across 30 clean scan days.",
        "icon": "calendar",
        "tier": "neon",
    },
    "top_1_percent": {
        "title": "Top 1% Freshness",
        "description": "Awarded to the highest freshness performers on the vendor leaderboard.",
        "icon": "crown",
        "tier": "elite",
    },
    "trusted_volume_100": {
        "title": "100 Verified Scans",
        "description": "Awarded after 100 recorded freshness scans.",
        "icon": "shield",
        "tier": "trusted",
    },
}


def _compute_badge(avg_score: float, total_scans: int) -> str:
    if total_scans < 5:
        return "unranked"
    if avg_score >= 80:
        return "gold"
    if avg_score >= 60:
        return "silver"
    if avg_score >= 40:
        return "bronze"
    return "unranked"


def _compute_trend(db, vendor_id: str) -> str:
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()

    recent = (
        db.table("scans")
        .select("freshness_index")
        .eq("vendor_id", vendor_id)
        .gte("timestamp", week_ago)
        .execute()
    )

    prior = (
        db.table("scans")
        .select("freshness_index")
        .eq("vendor_id", vendor_id)
        .gte("timestamp", two_weeks_ago)
        .lt("timestamp", week_ago)
        .execute()
    )

    def avg(rows):
        # freshness_index=0 is valid, use 'is not None'
        vals = [r["freshness_index"] for r in rows if r.get("freshness_index") is not None]
        return sum(vals) / len(vals) if vals else None

    r_avg = avg(recent.data or [])
    p_avg = avg(prior.data or [])

    if r_avg is None or p_avg is None:
        return "stable"
    if r_avg > p_avg + 3:
        return "up"
    if r_avg < p_avg - 3:
        return "down"
    return "stable"


def _grade_a(row: dict) -> bool:
    return row.get("final_grade") == "A" or (row.get("freshness_index") or 0) >= 75


def _longest_recent_grade_a_streak(rows: list[dict]) -> int:
    streak = 0
    for row in rows:
        if _grade_a(row):
            streak += 1
        else:
            break
    return streak


def _clean_grade_a_days(rows: list[dict]) -> int:
    days: dict[str, bool] = {}
    for row in rows:
        ts = row.get("timestamp") or ""
        day = ts[:10]
        if not day:
            continue
        days[day] = days.get(day, True) and _grade_a(row)
    return sum(1 for clean in days.values() if clean)


def _top_percent_vendor_ids(db) -> set[str]:
    vendors = (
        db.table("vendors")
        .select("id, avg_freshness_score, total_scans")
        .order("avg_freshness_score", desc=True)
        .execute()
    )
    rows = [v for v in (vendors.data or []) if (v.get("total_scans") or 0) >= 5]
    if not rows:
        return set()
    cutoff = max(1, int(len(rows) * 0.01))
    return {str(v["id"]) for v in rows[:cutoff]}


def _upsert_vendor_achievement(db, vendor_id: str, code: str, metadata: dict | None = None):
    achievement = ACHIEVEMENTS[code]
    db.table("vendor_achievements").upsert(
        {
            "vendor_id": vendor_id,
            "code": code,
            "title": achievement["title"],
            "description": achievement["description"],
            "icon": achievement["icon"],
            "tier": achievement["tier"],
            "metadata": metadata or {},
        },
        on_conflict="vendor_id,code",
    ).execute()


def recalculate_vendor_metrics_and_achievements(db, vendor_id: str) -> dict:
    """Update vendor trust metrics and award achievements from scan history."""
    scans = (
        db.table("scans")
        .select("freshness_index, final_grade, timestamp")
        .eq("vendor_id", vendor_id)
        .order("timestamp", desc=True)
        .execute()
    )
    rows = [r for r in (scans.data or []) if r.get("freshness_index") is not None]
    if not rows:
        return {"total_scans": 0, "achievements": []}

    scores = [r["freshness_index"] for r in rows]
    total = len(scores)
    avg = round(sum(scores) / total, 2)
    badge = _compute_badge(avg, total)
    trend = _compute_trend(db, vendor_id)

    db.table("vendors").update(
        {
            "avg_freshness_score": avg,
            "trust_score": avg,
            "total_scans": total,
            "trust_badge": badge,
            "trend": trend,
        }
    ).eq("id", vendor_id).execute()

    awarded = []
    recent_streak = _longest_recent_grade_a_streak(rows)
    clean_days = _clean_grade_a_days(rows)

    candidates = []
    if recent_streak >= 50:
        candidates.append(("fresh_streak_50", {"streak": recent_streak}))
    if clean_days >= 30:
        candidates.append(("consistent_30d", {"clean_days": clean_days}))
    if total >= 100:
        candidates.append(("trusted_volume_100", {"total_scans": total}))
    if vendor_id in _top_percent_vendor_ids(db):
        candidates.append(("top_1_percent", {"avg_freshness_score": avg}))

    for code, metadata in candidates:
        try:
            _upsert_vendor_achievement(db, vendor_id, code, metadata)
            awarded.append(code)
        except Exception as exc:
            print(f"Achievement award failed for {vendor_id}/{code}: {exc}")

    return {
        "avg_score": avg,
        "total_scans": total,
        "trust_badge": badge,
        "trend": trend,
        "achievements": awarded,
    }


def get_vendor_achievements(db, vendor_ids: list[str]) -> dict[str, list[dict]]:
    if not vendor_ids:
        return {}
    try:
        resp = (
            db.table("vendor_achievements")
            .select("vendor_id, code, title, description, icon, tier, awarded_at")
            .in_("vendor_id", vendor_ids)
            .order("awarded_at", desc=True)
            .execute()
        )
    except Exception as exc:
        print(f"Achievement lookup skipped: {exc}")
        return {}

    grouped: dict[str, list[dict]] = {vendor_id: [] for vendor_id in vendor_ids}
    for row in resp.data or []:
        vendor_id = str(row.pop("vendor_id"))
        grouped.setdefault(vendor_id, []).append(row)
    return grouped


def register_routes(router: APIRouter, db_getter):
    @router.get("/leaderboard")
    async def get_leaderboard(limit: int = Query(default=20, ge=1, le=100)):
        """Public leaderboard — no auth required."""
        try:
            resp = (
                db_getter()
                .table("vendors")
                .select("id, name, address, avg_freshness_score, total_scans, trust_badge, trend")
                .order("avg_freshness_score", desc=True)
                .limit(limit)
                .execute()
            )
            rows = resp.data or []
            achievements = get_vendor_achievements(db_getter(), [str(v["id"]) for v in rows])
            for vendor in rows:
                vendor["achievements"] = achievements.get(str(vendor["id"]), [])
            return {"success": True, "leaderboard": rows}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    @router.get("/{vendor_id}/trust-score")
    async def get_vendor_trust_score(vendor_id: str):
        """Trust score for a single vendor — no auth required."""
        try:
            resp = (
                db_getter()
                .table("vendors")
                .select("id, name, address, avg_freshness_score, total_scans, trust_badge, trend")
                .eq("id", vendor_id)
                .limit(1)
                .execute()
            )
            if not resp.data:
                raise HTTPException(status_code=404, detail="Vendor not found.")
            vendor = resp.data[0]
            vendor["trend"] = _compute_trend(db_getter(), vendor_id)
            vendor["achievements"] = get_vendor_achievements(db_getter(), [vendor_id]).get(vendor_id, [])
            return {"success": True, "vendor": vendor}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    @router.post("/{vendor_id}/recalculate")
    async def recalculate_trust_score(
        vendor_id: str,
        current_user=Depends(get_current_user),
    ):
        """Recompute trust score from scans. Requires authentication."""
        try:
            result = recalculate_vendor_metrics_and_achievements(db_getter(), vendor_id)
            if not result.get("total_scans"):
                raise HTTPException(status_code=404, detail="No scans found for this vendor.")

            await FastAPICache.clear(namespace="markets")

            return {
                "success": True,
                "vendor_id": vendor_id,
                **result,
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))
