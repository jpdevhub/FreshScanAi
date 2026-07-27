"""
Fish Species Classification Module

Uses MobileNetV3-Small for lightweight, fast species identification.
Designed for edge deployment via ONNX Runtime.
"""

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np
from pathlib import Path

# ── Species Labels ──────────────────────────────────────────────────────────
# Common fish species found in Indian/local markets
SPECIES_LABELS = [
    "Rohu Carp",
    "Catla Carp",
    "Mrigal Carp",
    "Pangas",
    "Basa",
    "Tilapia",
    "Pomfret",
    "Kingfish",
    "Mackerel",
    "Sardine",
]

SPECIES_METADATA = {
    "Rohu Carp": {"scientific_name": "Labeo rohita", "habitat": "Freshwater"},
    "Catla Carp": {"scientific_name": "Catla catla", "habitat": "Freshwater"},
    "Mrigal Carp": {"scientific_name": "Cirrhinus cirrhosus", "habitat": "Freshwater"},
    "Pangas": {"scientific_name": "Pangasius hypophthalmus", "habitat": "Freshwater"},
    "Basa": {"scientific_name": "Pangasius bocourti", "habitat": "Freshwater"},
    "Tilapia": {"scientific_name": "Oreochromis niloticus", "habitat": "Freshwater"},
    "Pomfret": {"scientific_name": "Pampus argenteus", "habitat": "Marine"},
    "Kingfish": {"scientific_name": "Scomberomorus commerson", "habitat": "Marine"},
    "Mackerel": {"scientific_name": "Rastrelliger kanagurta", "habitat": "Marine"},
    "Sardine": {"scientific_name": "Sardinella longiceps", "habitat": "Marine"},
}

NUM_SPECIES = len(SPECIES_LABELS)

# ── Device ──────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ── Model Architecture ──────────────────────────────────────────────────────
def get_species_model(num_classes: int = NUM_SPECIES) -> nn.Module:
    """
    MobileNetV3-Small backbone with a custom classification head.
    Lightweight (~2.5M params) — ideal for edge/FastAPI deployment.
    """
    model = models.mobilenet_v3_small(weights=None)
    # Replace classifier head for our species count
    in_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(256, num_classes),
    )
    return model


# ── Preprocessing ───────────────────────────────────────────────────────────
species_transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


# ── Global Model Reference ─────────────────────────────────────────────────
_species_model = None
_species_loaded = False


def load_species_model(weights_path: str):
    """
    Load pre-trained species classification weights.
    Run once on server startup.
    """
    global _species_model, _species_loaded

    path = Path(weights_path)
    if not path.exists():
        print(f"WARNING: Species model not found at {path}. Using default species.")
        return

    try:
        _species_model = get_species_model()
        checkpoint = torch.load(path, map_location=device, weights_only=True)

        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            _species_model.load_state_dict(checkpoint["model_state_dict"])
        else:
            _species_model.load_state_dict(checkpoint)

        _species_model.to(device)
        _species_model.eval()
        _species_loaded = True
        print(f"Species model loaded from {path}")
    except Exception as exc:
        _species_model = None
        _species_loaded = False
        print(f"WARNING: Failed to load species model from {path}: {exc}. Using default species.")


# ── Inference ───────────────────────────────────────────────────────────────
@torch.no_grad()
def predict_species(image: Image.Image) -> dict:
    """
    Classify fish species from an image.

    Returns:
        {
            "common_name": str,
            "scientific_name": str,
            "habitat": str,
            "confidence": float,
            "all_probs": dict[str, float],
        }
    """
    if not _species_loaded or _species_model is None:
        # Fallback: return default species with low confidence
        return {
            "common_name": "Rohu Carp",
            "scientific_name": "Labeo rohita",
            "habitat": "Freshwater",
            "confidence": 0.0,
            "all_probs": {label: 0.0 for label in SPECIES_LABELS},
        }

    tensor = species_transform(image).unsqueeze(0).to(device)
    logits = _species_model(tensor)
    probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()

    top_idx = int(np.argmax(probs))
    top_label = SPECIES_LABELS[top_idx]
    metadata = SPECIES_METADATA[top_label]

    return {
        "common_name": top_label,
        "scientific_name": metadata["scientific_name"],
        "habitat": metadata["habitat"],
        "confidence": float(probs[top_idx]),
        "all_probs": {label: float(probs[i]) for i, label in enumerate(SPECIES_LABELS)},
    }
