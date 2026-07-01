"""Generate synthetic fish images for missing species."""
import os, numpy as np
from PIL import Image
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "real_fish"
SYNTH_DIR = Path(__file__).parent.parent / "data" / "synthetic_fish"

# Missing species - generate synthetic training images
missing_species = {
    "pangas": [(60, 80, 100), (80, 100, 120)],
    "basa": [(70, 70, 90), (90, 80, 100)],
    "kingfish": [(40, 80, 140), (60, 100, 160)],
    "mackerel": [(80, 120, 60), (100, 140, 80)],
    "sardine": [(120, 100, 80), (140, 120, 100)],
}

N_IMAGES = 200  # per species
IMG_SIZE = 224

for species, colors in missing_species.items():
    dst_dir = SYNTH_DIR / species
    dst_dir.mkdir(parents=True, exist_ok=True)
    
    existing = len(list(dst_dir.glob("*.jpg")))
    if existing >= N_IMAGES:
        print(f"{species}: already have {existing} images, skipping")
        continue
    
    for i in range(N_IMAGES):
        arr = np.random.randint(0, 30, (IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
        
        # Fish-like shape (ellipse)
        cx, cy = IMG_SIZE // 2, IMG_SIZE // 2
        y_grid, x_grid = np.ogrid[:IMG_SIZE, :IMG_SIZE]
        
        # Main body ellipse
        rx, ry = np.random.randint(60, 90), np.random.randint(25, 45)
        angle = np.random.uniform(-0.3, 0.3)
        x_rot = (x_grid - cx) * np.cos(angle) - (y_grid - cy) * np.sin(angle)
        y_rot = (x_grid - cx) * np.sin(angle) + (y_grid - cy) * np.cos(angle)
        body_mask = (x_rot / rx) ** 2 + (y_rot / ry) ** 2 < 1
        
        # Apply species-specific base color with variation
        base = np.array(colors[i % len(colors)])
        noise = np.random.randint(-20, 20, 3, dtype=np.int16)
        color = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        
        for c in range(3):
            arr[:, :, c] = np.where(body_mask, color[c], arr[:, :, c])
        
        # Add some texture noise to body
        texture = np.random.randint(-10, 10, (IMG_SIZE, IMG_SIZE, 3), dtype=np.int16)
        arr = np.clip(arr.astype(np.int16) + texture * body_mask[:, :, np.newaxis], 0, 255).astype(np.uint8)
        
        fname = f"{species}_{i:04d}.jpg"
        Image.fromarray(arr).save(dst_dir / fname)
    
    print(f"{species}: generated {N_IMAGES} synthetic images")

# Final count
print("\n--- Synthetic data ---")
total = 0
for sp in sorted(os.listdir(SYNTH_DIR)):
    sp_dir = SYNTH_DIR / sp
    if sp_dir.is_dir():
        n = len(list(sp_dir.glob("*.jpg")))
        total += n
        print(f"  {sp}: {n}")
print(f"  Total synthetic: {total}")
