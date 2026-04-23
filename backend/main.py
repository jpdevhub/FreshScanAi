import os
import io
import uuid
import random
from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

# Load .env file if present (python-dotenv)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from supabase import create_client, Client
from PIL import Image

# Inference/fusion require PyTorch — import lazily so server starts without it
try:
    from inference import load_models, predict_stream_a, predict_stream_b
    from fusion import process_and_fuse
    _torch_available = True
except ModuleNotFoundError:
    _torch_available = False
    print("WARNING: PyTorch not installed. Scan endpoints will return 503.")

from auth import get_current_user, get_google_oauth_url, exchange_code_for_session


# ── Configuration ─────────────────────────────────────────────────────────────
# All secrets MUST come from environment variables — no hardcoded fallbacks.
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY         = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
API_BASE_URL         = os.environ.get("API_BASE_URL", "http://localhost:8000")
FRONTEND_URL         = os.environ.get("FRONTEND_URL", "http://localhost:5173")
# CORS_ALLOW_ALL=true → open (local dev). Unset or false → locked to FRONTEND_URL (production).
CORS_ALLOW_ALL       = os.environ.get("CORS_ALLOW_ALL", "false").lower() == "true"

# Model paths — resolve relative to repo root, fully overridable via env vars
_repo_root    = Path(__file__).parent.parent
MODEL_DIR     = Path(os.environ.get("MODEL_DIR", str(_repo_root / "Models")))
STREAM_A_PATH = os.environ.get("STREAM_A_MODEL", str(MODEL_DIR / "freshscan_stream_a_body.pth"))
STREAM_B_PATH = os.environ.get("STREAM_B_MODEL", str(MODEL_DIR / "stream_b_checkpoint.pth"))


# ── Supabase clients ──────────────────────────────────────────────────────────
supabase: Optional[Client] = (
    create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
)
supabase_service: Optional[Client] = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_SERVICE_KEY else None
)


def _db() -> Client:
    client = supabase_service or supabase
    if client is None:
        raise HTTPException(status_code=503, detail="Database client not configured. Set SUPABASE_KEY.")
    return client


# ── App lifespan ──────────────────────────────────────────────────────────────
_models_loaded = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _models_loaded
    a = Path(STREAM_A_PATH)
    b = Path(STREAM_B_PATH)
    if not _torch_available:
        print("WARNING: PyTorch not installed. Scan endpoints will return 503.")
    elif a.exists() and b.exists():
        print(f"Loading models from {MODEL_DIR} ...")
        load_models(str(a), str(b))
        _models_loaded = True
        print("Models loaded successfully.")
    else:
        print(
            f"WARNING: Model files not found at {MODEL_DIR}. "
            "Scan endpoints will return 503 until models are present."
        )
    yield


app = FastAPI(title="FreshScan AI", version="1.1.0", lifespan=lifespan)

_cors_origins = ["*"] if CORS_ALLOW_ALL else [
    FRONTEND_URL,
    # Always allow Vercel preview deployments
    "https://fresh-scan-ai-sage.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Domain helpers ────────────────────────────────────────────────────────────

def _read_image(upload: UploadFile) -> Image.Image:
    try:
        data = upload.file.read()
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}")


def _generate_display_id() -> str:
    now = datetime.now(timezone.utc)
    seq = random.randint(1000, 9999)
    return f"FS-{now.strftime('%Y%m%d')}-{seq}"


def _status(score: int) -> str:
    return "NOMINAL" if score >= 70 else "CAUTION"


def _gill_detail(s: int) -> str:
    if s >= 85:
        return "Hemoglobin oxidation within healthy range. Bright red coloration detected."
    if s >= 70:
        return "Gill color moderately saturated. Minor oxidation detected at periphery."
    return "Significant hemoglobin oxidation detected. Gill coloration indicates spoilage."


def _eye_detail(s: int) -> str:
    if s >= 85:
        return "Corneal surface clear. Pupil reflex and iris structure intact."
    if s >= 70:
        return "Slight cloudiness at periphery. Core pupil reflex intact."
    return "Significant corneal opacity detected. Pupil reflex diminished."


def _body_detail(s: int) -> str:
    if s >= 85:
        return "Scale adhesion strong. Mucus layer viscosity within normal parameters."
    if s >= 70:
        return "Mild scale lift at dorsal region. Mucus layer acceptable."
    return "Significant scale detachment. Mucus layer degraded."


def _derive_grade(score: float) -> str:
    if score >= 92:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 65:
        return "B"
    if score >= 50:
        return "C"
    return "D"


def _to_db_grade(grade: str) -> str:
    """Maps display grade to the DB enum (A, B, C, Spoiled)."""
    return {"A+": "A", "D": "Spoiled"}.get(grade, grade)


def _build_scan_payload(
    fusion: dict,
    scan_id: str,
    display_id: str,
    photo_url: Optional[str] = None,
) -> dict:
    score = fusion["final_score_percent"]
    reg   = fusion["regional_breakdown"]

    gill_score = int(reg["gill_freshness_score"] * 100)
    eye_score  = int(reg["eye_freshness_score"]  * 100)
    body_score = int(reg["body_freshness_score"] * 100)
    freshness  = int(score)
    grade      = _derive_grade(score)
    is_fresh   = freshness >= 65

    alerts: list[str] = []
    if gill_score < 70:
        alerts.append("GILL_DEGRADED")
    if eye_score < 70:
        alerts.append("CORNEA_OPAQUE")
    if body_score < 70:
        alerts.append("SCALE_DETACHED")

    consume_hours = max(0, int((freshness - 40) * 0.6)) if is_fresh else 0

    return {
        "scan_id":         scan_id,
        "scan_display_id": display_id,
        "freshness_index": freshness,
        "grade":           grade,
        "confidence":      round(fusion["confidence_score"] * 100, 1),
        "classification":  "FRESH" if is_fresh else "SPOILED",
        "is_fresh":        is_fresh,
        "uncertain_flag":  fusion["uncertain_prediction_flag"],
        "species": {
            "common_name":        "Rohu Carp",
            "scientific_name":    "Labeo rohita",
            "habitat":            "Freshwater",
            "tags":               ["ROHU CARP", "LABEO ROHITA", "FRESHWATER"],
            "weight_estimate_kg": 1.2,
            "catch_age_hours":    6,
        },
        "biomarkers": {
            "gill_saturation":  {"score": gill_score, "status": _status(gill_score), "detail": _gill_detail(gill_score)},
            "corneal_clarity":  {"score": eye_score,  "status": _status(eye_score),  "detail": _eye_detail(eye_score)},
            "epidermal_tension":{"score": body_score, "status": _status(body_score), "detail": _body_detail(body_score)},
        },
        "recommendations": {
            "consume_within_hours": consume_hours,
            "storage_temp":         "0-4 C",
            "alert_flags":          alerts,
        },
        "photo_url": photo_url,
    }


def _row_to_payload(row: dict) -> dict:
    freshness = row.get("freshness_index") or 0
    is_fresh  = freshness >= 65
    bm        = row.get("biomarker_json") or {}
    alerts    = row.get("alert_flags") or []
    photos    = row.get("photo_urls") or []

    if not bm:
        bm = {
            "gill_saturation":   {"score": freshness, "status": _status(freshness), "detail": _gill_detail(freshness)},
            "corneal_clarity":   {"score": freshness, "status": _status(freshness), "detail": _eye_detail(freshness)},
            "epidermal_tension": {"score": freshness, "status": _status(freshness), "detail": _body_detail(freshness)},
        }

    return {
        "scan_id":         row["id"],
        "scan_display_id": row.get("scan_display_id") or row["id"][:8].upper(),
        "freshness_index": freshness,
        "grade":           row.get("final_grade") or "C",
        "confidence":      round((row.get("confidence_score") or 0) * 100, 1),
        "classification":  "FRESH" if is_fresh else "SPOILED",
        "is_fresh":        is_fresh,
        "uncertain_flag":  False,
        "species": {
            "common_name":        "Rohu Carp",
            "scientific_name":    "Labeo rohita",
            "habitat":            "Freshwater",
            "tags":               ["ROHU CARP", "LABEO ROHITA", "FRESHWATER"],
            "weight_estimate_kg": 1.2,
            "catch_age_hours":    6,
        },
        "biomarkers": bm,
        "recommendations": {
            "consume_within_hours": row.get("storage_hours") or 0,
            "storage_temp":         "0-4 C",
            "alert_flags":          alerts,
        },
        "photo_url":   photos[0] if photos else None,
        "market_name": row.get("market_name"),
        "timestamp":   row.get("timestamp"),
    }


async def _upload_image(image_bytes: bytes, user_id: str, scan_id: str) -> Optional[str]:
    try:
        client = supabase_service or supabase
        if client is None:
            return None
        path = f"{user_id}/{scan_id}.jpg"
        client.storage.from_("scan-images").upload(
            path, image_bytes, {"content-type": "image/jpeg", "upsert": "true"}
        )
        return client.storage.from_("scan-images").get_public_url(path)
    except Exception as exc:
        print(f"Image upload failed: {exc}")
        return None


# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.get("/api/v1/auth/login/google")
async def login_google():
    callback_url = f"{API_BASE_URL}/api/v1/auth/callback"
    try:
        url = get_google_oauth_url(redirect_to=callback_url)
        return RedirectResponse(url=url)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not generate OAuth URL: {exc}")


@app.get("/api/v1/auth/callback")
async def auth_callback(code: str = Query(...)):
    try:
        session      = exchange_code_for_session(code)
        access_token = session.access_token
        refresh_token = session.refresh_token or ""
        redirect_url  = (
            f"{FRONTEND_URL}/auth"
            f"?access_token={access_token}"
            f"&refresh_token={refresh_token}"
        )
        return RedirectResponse(url=redirect_url)
    except Exception as exc:
        error_url = f"{FRONTEND_URL}/auth?error=auth_failed"
        print(f"Auth callback error: {exc}")
        return RedirectResponse(url=error_url)


@app.get("/api/v1/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id":        current_user.id,
        "email":     current_user.email,
        "full_name": current_user.user_metadata.get("full_name"),
        "avatar_url":current_user.user_metadata.get("avatar_url") or current_user.user_metadata.get("picture"),
    }


# ── SCAN ──────────────────────────────────────────────────────────────────────

@app.post("/api/v1/scan")
async def process_scan(
    body_image:       UploadFile = File(...),
    eye_image:        UploadFile = File(...),
    gill_image:       UploadFile = File(...),
    vendor_id:        str  = Form(...),
    is_target_domain: bool = Form(default=False),
    current_user=Depends(get_current_user),
):
    if not _models_loaded:
        raise HTTPException(status_code=503, detail="ML models not loaded.")

    img_body = _read_image(body_image)
    img_eye  = _read_image(eye_image)
    img_gill = _read_image(gill_image)

    fusion     = process_and_fuse(
        predict_stream_a(img_body),
        predict_stream_b(img_eye),
        predict_stream_b(img_gill),
        temperature=1.5,
    )
    scan_id    = str(uuid.uuid4())
    display_id = _generate_display_id()
    payload    = _build_scan_payload(fusion, scan_id, display_id)

    try:
        _db().table("scans").insert({
            "id":               scan_id,
            "user_id":          str(current_user.id),
            "vendor_id":        vendor_id,
            "final_grade":      _to_db_grade(payload["grade"]),
            "confidence_score": fusion["confidence_score"],
            "image_type":       "full_scan",
            "freshness_index":  payload["freshness_index"],
            "scan_display_id":  display_id,
            "species_detected": "Rohu Carp",
            "biomarker_json":   payload["biomarkers"],
            "storage_hours":    payload["recommendations"]["consume_within_hours"],
            "alert_flags":      payload["recommendations"]["alert_flags"],
            "is_target_domain": is_target_domain,
        }).execute()
    except Exception as exc:
        print(f"DB write failed: {exc}")

    return {"success": True, "scan": payload}


@app.post("/api/v1/scan-auto")
async def scan_auto(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    image_bytes = await image.read()
    scan_id     = str(uuid.uuid4())
    display_id  = _generate_display_id()

    # ── Demo mode: models not loaded (PyTorch not installed) ─────────────────
    if not _models_loaded:
        gill  = random.randint(68, 96)
        eye   = random.randint(65, 94)
        body  = random.randint(67, 95)
        score = round((gill + eye + body) / 3.0, 1)
        conf  = round(random.uniform(0.82, 0.97), 2)

        demo_fusion = {
            "final_score_percent":   score,
            "confidence_score":      conf,
            "uncertain_prediction_flag": False,
            "regional_breakdown": {
                "gill_freshness_score": gill / 100,
                "eye_freshness_score":  eye  / 100,
                "body_freshness_score": body / 100,
            },
        }
        photo_url = await _upload_image(image_bytes, str(current_user.id), scan_id)
        payload   = _build_scan_payload(demo_fusion, scan_id, display_id, photo_url)

        try:
            _db().table("scans").insert({
                "id":               scan_id,
                "user_id":          str(current_user.id),
                "final_grade":      _to_db_grade(payload["grade"]),
                "confidence_score": conf,
                "image_type":       "BODY",
                "freshness_index":  payload["freshness_index"],
                "scan_display_id":  display_id,
                "species_detected": "Rohu Carp",
                "biomarker_json":   payload["biomarkers"],
                "storage_hours":    payload["recommendations"]["consume_within_hours"],
                "alert_flags":      payload["recommendations"]["alert_flags"],
                "photo_urls":       [photo_url] if photo_url else [],
            }).execute()
        except Exception as exc:
            print(f"DB write failed (demo): {exc}")

        return {"success": True, "scan": payload}

    # ── Real inference path ───────────────────────────────────────────────────
    from router import classify_image_type, ImageType

    img        = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_type = classify_image_type(img)

    if image_type == ImageType.NOT_A_FISH:
        raise HTTPException(status_code=422, detail="Uploaded image does not appear to contain a fish.")

    body_logits = predict_stream_a(img)
    eye_logits  = predict_stream_b(img)
    gill_logits = predict_stream_b(img)

    fusion     = process_and_fuse(body_logits, eye_logits, gill_logits, temperature=1.5)
    photo_url  = await _upload_image(image_bytes, str(current_user.id), scan_id)
    payload    = _build_scan_payload(fusion, scan_id, display_id, photo_url)

    try:
        _db().table("scans").insert({
            "id":               scan_id,
            "user_id":          str(current_user.id),
            "final_grade":      _to_db_grade(payload["grade"]),
            "confidence_score": fusion["confidence_score"],
            "image_type":       image_type.value,
            "freshness_index":  payload["freshness_index"],
            "scan_display_id":  display_id,
            "species_detected": "Rohu Carp",
            "biomarker_json":   payload["biomarkers"],
            "storage_hours":    payload["recommendations"]["consume_within_hours"],
            "alert_flags":      payload["recommendations"]["alert_flags"],
            "photo_urls":       [photo_url] if photo_url else [],
        }).execute()
    except Exception as exc:
        print(f"DB write failed: {exc}")

    return {"success": True, "scan": payload}


# ── SCAN RETRIEVAL ────────────────────────────────────────────────────────────

@app.get("/api/v1/scans/latest")
async def get_latest_scan(current_user=Depends(get_current_user)):
    try:
        resp = (
            _db().table("scans")
            .select("*")
            .eq("user_id", str(current_user.id))
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="No scans found.")
        return {"success": True, "scan": _row_to_payload(resp.data[0])}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/scans/history")
async def get_scan_history(
    limit:  int = Query(default=20, le=100),
    offset: int = Query(default=0),
    current_user=Depends(get_current_user),
):
    try:
        resp = (
            _db().table("scans")
            .select(
                "id, scan_display_id, species_detected, freshness_index, "
                "final_grade, market_name, timestamp, photo_urls, "
                "confidence_score, image_type"
            )
            .eq("user_id", str(current_user.id))
            .order("timestamp", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        rows    = resp.data or []
        total   = len(rows)
        avg_idx = int(sum(r.get("freshness_index") or 0 for r in rows) / total) if total else 0
        fresh_n = sum(1 for r in rows if (r.get("freshness_index") or 0) >= 65)

        return {
            "success": True,
            "count":   total,
            "stats": {
                "total_scans":         total,
                "avg_freshness_index": avg_idx,
                "fresh_rate_percent":  round((fresh_n / total) * 100) if total else 0,
            },
            "scans": [
                {
                    "id":               r["id"],
                    "scan_display_id":  r.get("scan_display_id") or r["id"][:8].upper(),
                    "species_detected": r.get("species_detected") or "Rohu Carp",
                    "freshness_index":  r.get("freshness_index") or 0,
                    "grade":            r.get("final_grade") or "C",
                    "is_fresh":         (r.get("freshness_index") or 0) >= 65,
                    "market_name":      r.get("market_name") or "Unknown Market",
                    "timestamp":        r.get("timestamp"),
                    "photo_url":        (r.get("photo_urls") or [""])[0],
                    "confidence_score": r.get("confidence_score"),
                    "image_type":       r.get("image_type"),
                }
                for r in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/scans/{scan_id}")
async def get_scan_by_id(scan_id: str, current_user=Depends(get_current_user)):
    try:
        resp = (
            _db().table("scans")
            .select("*")
            .eq("id", scan_id)
            .eq("user_id", str(current_user.id))
            .limit(1)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Scan not found.")
        return {"success": True, "scan": _row_to_payload(resp.data[0])}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── VENDORS ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/vendors")
async def get_vendors():
    try:
        resp = (
            _db().table("vendors")
            .select("id, name, address, lat, lng, trust_score, total_scans, avg_freshness_score, vendor_count")
            .execute()
        )
        return {"success": True, "vendors": resp.data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── MAP ───────────────────────────────────────────────────────────────────────

@app.get("/api/v1/maps/markets")
async def get_markets():
    try:
        resp = (
            _db().table("vendors")
            .select("id, name, avg_freshness_score, trust_score, lat, lng, vendor_count")
            .execute()
        )
        markets = [
            {
                "id":      i + 1,
                "name":    v["name"],
                "score":   int(v.get("avg_freshness_score") or v.get("trust_score") or 0),
                "lat":     float(v.get("lat") or 0),
                "lng":     float(v.get("lng") or 0),
                "vendors": int(v.get("vendor_count") or 1),
            }
            for i, v in enumerate(resp.data or [])
            if v.get("lat") and v.get("lng")
        ]
        return {"success": True, "markets": markets}
    except Exception:
        # Migration not applied yet — return empty markets, map still renders
        return {"success": True, "markets": [], "warning": "Run SQL migration and seed vendors for map data."}


# ── GRAD-CAM ──────────────────────────────────────────────────────────────────

def _generate_synthetic_heatmap(img: Image.Image) -> str:
    """
    Produce a synthetic 'neon-green on dark' heatmap overlay for demo mode
    when PyTorch / models are not available. Uses PIL only.
    """
    import numpy as np

    width, height = img.size
    # Build a radial-gradient attention mask centred on image
    cx, cy = width / 2, height / 2
    y_idx, x_idx = np.ogrid[:height, :width]
    dist = np.sqrt((x_idx - cx) ** 2 + (y_idx - cy) ** 2)
    max_dist = np.sqrt(cx ** 2 + cy ** 2)
    cam = 1.0 - np.clip(dist / max_dist, 0, 1)
    cam = cam ** 0.6  # soften fall-off

    # Jet-like colormap (blue → green → yellow → red)
    r = np.clip(1.5 - abs(cam * 4.0 - 3.0), 0, 1)
    g = np.clip(1.5 - abs(cam * 4.0 - 2.0), 0, 1)
    b = np.clip(1.5 - abs(cam * 4.0 - 1.0), 0, 1)

    heatmap = np.stack([r, g, b], axis=2)
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    heatmap_img = Image.fromarray(heatmap_uint8, "RGB").resize((width, height), Image.BILINEAR)

    orig_arr = np.array(img.convert("RGB"), dtype=np.float32)
    heat_arr = np.array(heatmap_img, dtype=np.float32)
    blended  = np.clip(0.55 * orig_arr + 0.45 * heat_arr, 0, 255).astype(np.uint8)

    out = Image.fromarray(blended)
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + __import__("base64").b64encode(buf.getvalue()).decode()


@app.post("/api/v1/gradcam")
async def generate_gradcam(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Generate a Grad-CAM activation overlay for the uploaded image.

    • When PyTorch + models are loaded  → real Grad-CAM via Stream A (MobileNetV2).
    • Demo mode (no PyTorch / no models) → synthetic radial heat overlay so the
      UI card remains functional without ML dependencies.

    Returns:
        gradcam_image   : base64 data-URI (JPEG)
        predicted_class : human-readable class string
        class_index     : 0 | 1 | 2  (C1 Fresh / C2 Moderate / C3 Spoiled)
        mode            : "real" | "demo"
    """
    import base64

    image_bytes = await image.read()
    img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    CLASS_NAMES = ["C1 – FRESH", "C2 – MODERATE", "C3 – SPOILED"]

    # ── Demo / no-torch path ────────────────────────────────────────────────────
    if not _torch_available or not _models_loaded:
        # Lightweight PIL fish heuristic (no ML models required):
        # Fish images are dominated by silver/grey/brown scales; we reject
        # clearly artificial images (very high saturation, pure white, etc.).
        import numpy as np
        arr = np.array(img_pil.resize((64, 64)), dtype=np.float32)
        mean_rgb   = arr.mean(axis=(0, 1))          # (R, G, B)
        brightness = mean_rgb.mean()                 # overall brightness
        channel_std = arr.std(axis=(0, 1)).mean()    # colour variance
        is_likely_fish = (
            brightness > 20          # not nearly-black
            and brightness < 235     # not nearly-white
            and channel_std > 8      # has some texture / colour detail
        )
        if not is_likely_fish:
            raise HTTPException(
                status_code=422,
                detail="NOT_A_FISH: The uploaded image does not appear to contain a fish.",
            )
        import random
        pred_class = random.randint(0, 2)
        overlay_b64 = _generate_synthetic_heatmap(img_pil)
        return {
            "gradcam_image":   overlay_b64,
            "predicted_class": CLASS_NAMES[pred_class],
            "class_index":     pred_class,
            "mode":            "demo",
        }

    # ── Real Grad-CAM path ──────────────────────────────────────────────────────
    import torch
    import numpy as np
    from inference import stream_a_model, stream_a_transforms, device
    from router import is_valid_fish_image

    # Fish validity gate — same gate used by /api/v1/scan-auto
    is_fish, gate_score = is_valid_fish_image(img_pil)
    print(f"   [GradCAM] Fish gate: {'PASS' if is_fish else 'FAIL'} (score={gate_score:.2%})")
    if not is_fish:
        raise HTTPException(
            status_code=422,
            detail="NOT_A_FISH: The uploaded image does not appear to contain a fish.",
        )

    input_tensor = stream_a_transforms(img_pil).unsqueeze(0).to(device)

    # Hook storage
    activations: list = []
    gradients:   list = []

    def _fwd_hook(_module, _inp, out):
        activations.append(out.detach())

    def _bwd_hook(_module, _grad_in, grad_out):
        gradients.append(grad_out[0].detach())

    # Target: last conv layer of MobileNetV2 features block
    target_layer = stream_a_model.features[-1][0]
    h_fwd = target_layer.register_forward_hook(_fwd_hook)
    h_bwd = target_layer.register_full_backward_hook(_bwd_hook)

    try:
        stream_a_model.eval()
        output = stream_a_model(input_tensor)
        pred_class = int(output.argmax(dim=1).item())

        stream_a_model.zero_grad()
        output[0, pred_class].backward()
    finally:
        h_fwd.remove()
        h_bwd.remove()

    # Compute CAM
    grads = gradients[0].squeeze().cpu().numpy()   # (C, H, W)
    acts  = activations[0].squeeze().cpu().numpy()  # (C, H, W)

    if grads.ndim == 3:
        weights = grads.mean(axis=(1, 2))           # (C,)
        cam = np.einsum("c,chw->hw", weights, acts)
    else:
        cam = grads  # fallback for edge-case shapes

    cam = np.maximum(cam, 0)
    cam_min, cam_max = cam.min(), cam.max()
    if cam_max > cam_min:
        cam = (cam - cam_min) / (cam_max - cam_min)

    # Resize to original image dimensions
    w, h = img_pil.size
    cam_img  = Image.fromarray((cam * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
    cam_arr  = np.array(cam_img, dtype=np.float32) / 255.0  # [0,1]

    # Jet-like colormap
    r = np.clip(1.5 - abs(cam_arr * 4.0 - 3.0), 0, 1)
    g = np.clip(1.5 - abs(cam_arr * 4.0 - 2.0), 0, 1)
    b = np.clip(1.5 - abs(cam_arr * 4.0 - 1.0), 0, 1)

    heatmap = np.stack([r, g, b], axis=2)
    heat_uint8 = (heatmap * 255).astype(np.uint8)
    heat_img   = Image.fromarray(heat_uint8, "RGB")

    orig_arr   = np.array(img_pil.resize((w, h)), dtype=np.float32)
    heat_arr   = np.array(heat_img,               dtype=np.float32)
    blended    = np.clip(0.55 * orig_arr + 0.45 * heat_arr, 0, 255).astype(np.uint8)

    overlay_pil = Image.fromarray(blended)
    buf = io.BytesIO()
    overlay_pil.save(buf, format="JPEG", quality=88)
    overlay_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    return {
        "gradcam_image":   overlay_b64,
        "predicted_class": CLASS_NAMES[pred_class],
        "class_index":     pred_class,
        "mode":            "real",
    }
