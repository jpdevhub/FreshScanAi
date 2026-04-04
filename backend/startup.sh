#!/bin/bash
set -e

echo "========================================="
echo " FreshScan AI — Backend Startup"
echo "========================================="
echo ""
echo "[1/2] Downloading models from Hugging Face Hub..."

python3 -c "
import os
from huggingface_hub import hf_hub_download

repo_id  = os.environ.get('HF_MODEL_REPO', 'karansingh12/freshscan-models')
model_dir = os.environ.get('MODEL_DIR', '/home/user/models')

os.makedirs(model_dir, exist_ok=True)

print(f'  Repo  : {repo_id}')
print(f'  Target: {model_dir}')
print()

print('  Downloading freshscan_stream_a_body.pth ...')
hf_hub_download(
    repo_id=repo_id,
    filename='freshscan_stream_a_body.pth',
    local_dir=model_dir,
)
print('  Stream A ready.')

print('  Downloading stream_b_checkpoint.pth ...')
hf_hub_download(
    repo_id=repo_id,
    filename='stream_b_checkpoint.pth',
    local_dir=model_dir,
)
print('  Stream B ready.')
print()
print('  All models downloaded successfully.')
"

echo ""
echo "[2/2] Starting FastAPI server on port 7860..."
exec uvicorn main:app --host 0.0.0.0 --port 7860
