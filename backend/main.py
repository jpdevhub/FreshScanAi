import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from supabase import create_client, Client
from PIL import Image
import io

from inference import load_models, predict_stream_a, predict_stream_b
from fusion import process_and_fuse
from auth import get_current_user, get_google_oauth_url, exchange_code_for_session

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mjklfhjnebidbsizulgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Public client (anon key) — for auth operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
# Service client (service role key) — bypasses RLS for server-side writes
supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_SERVICE_KEY else None

# Callback URL — FastAPI server must be accessible at this address
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")

@asynccontextmanager
async def lifespan(app: FastAPI):
    stream_a_path = r"c:\Users\Abhi\Desktop\Bugs\Models\freshscan_stream_a_body.pth"
    stream_b_path = r"c:\Users\Abhi\Desktop\Bugs\Models\stream_b_checkpoint.pth"
    print("Loading PyTorch Models into Memory...")
    load_models(stream_a_path, stream_b_path)
    print("Models loaded successfully.")
    yield

app = FastAPI(title="FreshScan AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def read_image_from_upload(upload_file: UploadFile) -> Image.Image:
    try:
        image_bytes = upload_file.file.read()
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")


# ─────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/v1/auth/login/google")
async def login_google():
    """Redirects the browser to Google OAuth via Supabase."""
    callback_url = f"{API_BASE_URL}/api/v1/auth/callback"
    try:
        url = get_google_oauth_url(redirect_to=callback_url)
        return RedirectResponse(url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate OAuth URL: {e}")


@app.get("/api/v1/auth/callback")
async def auth_callback(code: str = Query(...)):
    """
    Supabase redirects here after Google OAuth.
    Exchanges the PKCE code for a session and shows the access token
    on a simple HTML page for testing.
    """
    try:
        session = exchange_code_for_session(code)
        access_token = session.access_token
        user_email = session.user.email if session.user else "Unknown"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>FreshScan AI — Auth Success</title>
            <style>
                body {{ font-family: monospace; background: #0f0f0f; color: #e0e0e0; padding: 40px; }}
                h1 {{ color: #4ade80; }}
                .token-box {{
                    background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
                    padding: 16px; word-break: break-all; font-size: 13px;
                    color: #facc15; margin: 16px 0;
                }}
                button {{
                    background: #4ade80; color: #000; border: none; padding: 10px 20px;
                    border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <h1>✅ Authentication Successful</h1>
            <p>Logged in as: <strong>{user_email}</strong></p>
            <p>Copy your access token below and use it in Postman / curl as:<br>
            <code>Authorization: Bearer &lt;token&gt;</code></p>
            <div class="token-box" id="token">{access_token}</div>
            <button onclick="navigator.clipboard.writeText(document.getElementById('token').innerText)">
                📋 Copy Token
            </button>
            <hr style="border-color:#333; margin:32px 0">
            <p>Test with curl:</p>
            <pre style="color:#94a3b8">curl http://localhost:8000/api/v1/auth/me \\
  -H "Authorization: Bearer {access_token}"</pre>
        </body>
        </html>
        """
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Code exchange failed: {e}")


@app.get("/api/v1/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    """Returns the authenticated user's profile. Requires Bearer token."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.user_metadata.get("full_name"),
        "avatar_url": current_user.user_metadata.get("avatar_url"),
    }


# ─────────────────────────────────────────────
# SCAN HISTORY
# ─────────────────────────────────────────────

@app.get("/api/v1/scans/history")
async def get_scan_history(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    current_user=Depends(get_current_user)
):
    """Returns paginated scan history for the authenticated user."""
    try:
        response = (
            supabase.table("scans")
            .select("id, final_grade, confidence_score, image_type, timestamp, vendor_id")
            .eq("user_id", current_user.id)
            .order("timestamp", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"success": True, "scans": response.data, "count": len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# SCAN ENDPOINTS (now attach user_id)
# ─────────────────────────────────────────────

@app.post("/api/v1/scan")
async def process_scan(
    body_image: UploadFile = File(...),
    eye_image: UploadFile = File(...),
    gill_image: UploadFile = File(...),
    vendor_id: str = Form(...),
    is_target_domain: bool = Form(default=False),
    current_user=Depends(get_current_user)
):
    img_body = read_image_from_upload(body_image)
    img_eye = read_image_from_upload(eye_image)
    img_gill = read_image_from_upload(gill_image)

    body_logits = predict_stream_a(img_body)
    eye_logits = predict_stream_b(img_eye)
    gill_logits = predict_stream_b(img_gill)

    fusion_results = process_and_fuse(
        body_logits=body_logits,
        eye_logits=eye_logits,
        gill_logits=gill_logits,
        temperature=1.5
    )

    scan_data = {
        "user_id": current_user.id,
        "vendor_id": vendor_id,
        "final_grade": fusion_results["final_grade"],
        "confidence_score": fusion_results["confidence_score"],
        "is_target_domain": is_target_domain,
        "image_type": "full_scan"
    }

    try:
        db = supabase_service or supabase
        db.table("scans").insert(scan_data).execute()
    except Exception as e:
        print(f"DB write failed: {e}")

    return {"success": True, "scan_data": fusion_results}


@app.post("/api/v1/scan-auto")
async def scan_auto(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    from router import classify_image_type, ImageType
    from inference import scan_whole_body, scan_eyes, scan_gills

    img = read_image_from_upload(image)
    image_type = classify_image_type(img)

    if image_type == ImageType.NOT_A_FISH:
        raise HTTPException(status_code=422, detail="Uploaded image does not appear to contain a fish.")

    if image_type == ImageType.BODY:
        feature_type, results = "Whole Body", scan_whole_body(img)
    elif image_type == ImageType.EYE:
        feature_type, results = "Fish Eye", scan_eyes(img)
    elif image_type == ImageType.GILL:
        feature_type, results = "Fish Gill", scan_gills(img)
    else:
        feature_type, results = "Unknown - Defaulted to Body", scan_whole_body(img)

    try:
        db = supabase_service or supabase
        db.table("scans").insert({
            "user_id": current_user.id,
            "final_grade": "A",
            "confidence_score": max(results.values()),
            "image_type": feature_type
        }).execute()
    except Exception as e:
        print(f"DB write failed: {e}")

    return {"success": True, "feature_detected": feature_type, "freshness_probabilities": results}


@app.get("/api/v1/vendors")
async def get_vendors():
    try:
        response = supabase.table("vendors").select("id, name, location, trust_score, total_scans").execute()
        return {"success": True, "vendors": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
