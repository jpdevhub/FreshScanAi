import os
import torch
from PIL import Image
import numpy as np
import json

# Change current working directory to backend
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from inference import load_models, predict_stream_a, predict_stream_b
from fusion import process_and_fuse

def verify_pipeline():
    print("Testing ML Pipeline...")
    
    stream_a_path = r"c:\Users\Abhi\Desktop\Bugs\Models\freshscan_stream_a_body.pth"
    stream_b_path = r"c:\Users\Abhi\Desktop\Bugs\Models\stream_b_checkpoint.pth"
    
    try:
        load_models(stream_a_path, stream_b_path)
        print("Models loaded successfully.")
    except Exception as e:
        print(f"Error loading models: {e}")
        return

    # Create dummy images (solid colors simulating crops/body)
    dummy_body = Image.new('RGB', (224, 224), color='gray')
    dummy_eye = Image.new('RGB', (64, 64), color='black')
    dummy_gill = Image.new('RGB', (64, 64), color='darkred')
    
    print("Running Inference over Dummy Images...")
    try:
        body_logits = predict_stream_a(dummy_body)
        eye_logits = predict_stream_b(dummy_eye)
        gill_logits = predict_stream_b(dummy_gill)
        print(f"Body logits: {body_logits.tolist()}")
        print(f"Eye logits: {eye_logits.tolist()}")
        print(f"Gill logits: {gill_logits.tolist()}")
    except Exception as e:
        print(f"Inference failed: {e}")
        return

    print("\nRunning Fusion Algorithm...")
    try:
        results = process_and_fuse(body_logits, eye_logits, gill_logits)
        print(json.dumps(results, indent=2))
        print("\nPIPELINE VERIFICATION SUCCESS.")
    except Exception as e:
        print(f"Fusion failed: {e}")

if __name__ == "__main__":
    verify_pipeline()
