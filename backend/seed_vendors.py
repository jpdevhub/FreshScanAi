"""
Vendor seeding script.

Usage:
    cd backend
    python seed_vendors.py

Replace vendors_seed.json with your own data in the same format.
Set SUPABASE_URL and SUPABASE_SERVICE_KEY as environment variables
or they will be read from the defaults in this file.
"""

import os
import json
from pathlib import Path
from supabase import create_client

# Load .env from same directory as this script
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "https://mjklfhjnebidbsizulgr.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

SEED_FILE = Path(__file__).parent / "data" / "vendors_seed.json"


def main():
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY is not set.")
        return

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        vendors = json.load(f)

    print(f"Seeding {len(vendors)} vendors ...")

    for v in vendors:
        # Try full insert (migration applied)
        full_row = {
            "name":                v["name"],
            "address":             v.get("address", ""),
            "lat":                 v["lat"],
            "lng":                 v["lng"],
            "trust_score":         v.get("trust_score", 0.0),
            "avg_freshness_score": v.get("avg_freshness_score", 0),
            "vendor_count":        v.get("vendor_count", 1),
            "total_scans":         v.get("total_scans", 0),
        }
        base_row = {
            "name":        v["name"],
            "address":     v.get("address", ""),
            "trust_score": v.get("trust_score", 0.0),
        }

        try:
            resp = client.table("vendors").insert(full_row).execute()
            if resp.data:
                print(f"  Inserted (full): {v['name']}")
            else:
                print(f"  ERROR inserting {v['name']}: no data returned")
        except Exception as e:
            err_str = str(e)
            if "schema cache" in err_str or "column" in err_str.lower():
                # Migration not applied — fall back to base columns
                print(f"  Schema not migrated. Inserting base row for: {v['name']}")
                try:
                    resp2 = client.table("vendors").insert(base_row).execute()
                    if resp2.data:
                        print(f"  Inserted (base): {v['name']}")
                    else:
                        print(f"  ERROR on base insert for {v['name']}")
                except Exception as e2:
                    print(f"  FAILED {v['name']}: {e2}")
            elif "duplicate" in err_str.lower() or "unique" in err_str.lower():
                print(f"  Already exists (skipped): {v['name']}")
            else:
                print(f"  FAILED {v['name']}: {e}")

    print("\nDone. If you saw 'base' inserts, run the SQL migration in Supabase then re-run this script.")


if __name__ == "__main__":
    main()
