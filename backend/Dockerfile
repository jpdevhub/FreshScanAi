# FreshScan AI — Hugging Face Spaces Dockerfile
FROM python:3.12-slim

# HF Spaces requirement: non-root user
RUN useradd -m -u 1000 user
USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=/home/user/models \
    HF_MODEL_REPO=karansingh12/freshscan-models

WORKDIR /home/user/app

# Install CPU-only PyTorch first (saves ~1.5 GB vs CUDA build)
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir \
    torch==2.2.2 \
    torchvision==0.17.2 \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining backend dependencies
COPY --chown=user requirements_space.txt .
RUN pip install --no-cache-dir -r requirements_space.txt

# Copy all backend source files
COPY --chown=user . .

# Create model cache directory
RUN mkdir -p /home/user/models

# HF Spaces must expose port 7860
EXPOSE 7860

CMD ["bash", "startup.sh"]
