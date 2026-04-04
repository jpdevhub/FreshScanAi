import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from PIL import Image
import io
import json

from inference import load_models, predict_stream_a, predict_stream_b
from fusion import process_and_fuse

# Setup Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "your-anon-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Define Startup Event to preload ML Models
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Absolute paths to models based on your folder structure
    stream_a_path = r"c:\Users\Abhi\Desktop\Bugs\Models\freshscan_stream_a_body.pth"
    stream_b_path = r"c:\Users\Abhi\Desktop\Bugs\Models\stream_b_checkpoint.pth"
    
    print("Loading PyTorch Models into Memory...")
    load_models(stream_a_path, stream_b_path)
    print("Models loaded successfully.")
    yield

app = FastAPI(title="FreshScan AI", lifespan=lifespan)

# Allow CORS for frontends
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
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

@app.post("/api/v1/scan")
async def process_scan(
    body_image: UploadFile = File(...),
    eye_image: UploadFile = File(...),
    gill_image: UploadFile = File(...),
    vendor_id: str = Form(...),
    is_target_domain: bool = Form(default=False)
):
    """
    Accepts 3 images (Body, Eye, Gill) and metadata.
    Runs inference, merges probabilities, saves to Supabase, and returns result.
    """
    # 1. Read Images
    img_body = read_image_from_upload(body_image)
    img_eye = read_image_from_upload(eye_image)
    img_gill = read_image_from_upload(gill_image)

    # 2. PyTorch Inference (Phase 2)
    body_logits = predict_stream_a(img_body)
    eye_logits = predict_stream_b(img_eye)
    gill_logits = predict_stream_b(img_gill)

    # 3. Calibration & Fusion (Phase 3)
    fusion_results = process_and_fuse(
        body_logits=body_logits, 
        eye_logits=eye_logits, 
        gill_logits=gill_logits,
        temperature=1.5
    )

    # 4. Save to Database (Phase 1 Integration)
    scan_data = {
        "vendor_id": vendor_id,
        "final_grade": fusion_results["final_grade"],
        "confidence_score": fusion_results["confidence_score"],
        "is_target_domain": is_target_domain
    }
    
    try:
        supabase.table("scans").insert(scan_data).execute()
    except Exception as e:
        # In a production app you might queue this or retry instead of throwing 500
        print(f"Failed to record scan in database: {e}")

    # Return results including explanation/regional breakdown for frontend bounding boxes
    return {
        "success": True,
        "scan_data": fusion_results
    }

@app.post("/api/v1/scan-auto")
async def scan_auto(
    image: UploadFile = File(...)
):
    """
    Accepts 1 arbitrary image (Body, Eye, or Gill).
    Automatically routes it to the correct internal module using Zero-Shot classification.
    """
    from router import classify_image_type, ImageType
    from inference import scan_whole_body, scan_eyes, scan_gills
    
    img = read_image_from_upload(image)
    
    image_type = classify_image_type(img)
    
    if image_type == ImageType.BODY:
        feature_type = "Whole Body"
        results = scan_whole_body(img)
    elif image_type == ImageType.EYE:
        feature_type = "Fish Eye"
        results = scan_eyes(img)
    elif image_type == ImageType.GILL:
        feature_type = "Fish Gill"
        results = scan_gills(img)
    else:
        # Default fallback
        feature_type = "Unknown - Defaulted to Body"
        results = scan_whole_body(img)
        
    return {
        "success": True,
        "feature_detected": feature_type,
        "freshness_probabilities": results
    }

@app.get("/api/v1/vendors")
async def get_vendors():
    """
    Fetches all vendors, their trust scores, and geospatial locations to render on the Map.
    """
    try:
        response = supabase.table("vendors").select("id, name, location, trust_score, total_scans").execute()
        return {"success": True, "vendors": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
