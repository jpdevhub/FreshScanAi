# backend/api/public.py
from fastapi import APIRouter, HTTPException
from ..db import supabase  # adjust import path to match your project

router = APIRouter()

@router.get("/report/{scan_id}")
async def get_public_report(scan_id: str):
    result = supabase.table("scans").select("*").eq("id", scan_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result.data