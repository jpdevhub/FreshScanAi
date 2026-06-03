from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta, timezone
from auth import get_current_user

router = APIRouter(prefix="/api/v1/vendors", tags=["vendors"])


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
            return {"success": True, "leaderboard": resp.data or []}
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
            scans = (
                db_getter()
                .table("scans")
                .select("freshness_index")
                .eq("vendor_id", vendor_id)
                .execute()
            )
            rows = [r for r in (scans.data or []) if r.get("freshness_index") is not None]
            if not rows:
                raise HTTPException(status_code=404, detail="No scans found for this vendor.")

            scores = [r["freshness_index"] for r in rows]
            total = len(scores)
            avg = round(sum(scores) / total, 2)
            badge = _compute_badge(avg, total)
            trend = _compute_trend(db_getter(), vendor_id)

            db_getter().table("vendors").update(
                {
                    "avg_freshness_score": avg,
                    "total_scans": total,
                    "trust_badge": badge,
                    "trend": trend,
                }
            ).eq("id", vendor_id).execute()

            return {
                "success": True,
                "vendor_id": vendor_id,
                "avg_score": avg,
                "total_scans": total,
                "trust_badge": badge,
                "trend": trend,
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))
