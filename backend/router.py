import numpy as np
from PIL import Image
from enum import Enum
import torch
import torch.nn as nn
from torchvision import models, transforms


class ImageType(Enum):
    BODY = "BODY"
    EYE = "EYE"
    GILL = "GILL"
    UNKNOWN = "UNKNOWN"
    NOT_A_FISH = "NOT_A_FISH"


# Fish-related class indices in the ImageNet-1K label set
FISH_CLASS_INDICES = {
    0,   # tench
    1,   # goldfish
    2,   # great white shark
    3,   # tiger shark
    4,   # hammerhead shark
    5,   # electric ray
    6,   # stingray
    389, # barracouta
    390, # eel
    391, # coho salmon
    392, # rock beauty
    393, # anemone fish
    394, # sturgeon
    395, # gar
    396, # lionfish
    397, # puffer fish
}

# ImageNet normalization & resize for the ImageNet-pretrained gate model
_gate_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

_gate_model = None

def _get_gate_model():
    global _gate_model
    if _gate_model is None:
        print("   [Router] Loading ImageNet fish gate (MobileNetV2)...")
        # Fresh MobileNetV2 with original 1000-class ImageNet head
        _gate_model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        _gate_model.eval()
    return _gate_model


def is_valid_fish_image(image: Image.Image) -> tuple[bool, float]:
    """
    Uses a pre-trained ImageNet MobileNetV2 to check if top-K predictions
    fall within known fish class indices. Reliable, offline, no text prompts.
    Returns (is_fish, top_score).
    """
    model = _get_gate_model()
    tensor = _gate_transform(image).unsqueeze(0)
    
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze(0)

    # Check top 5 predictions for any fish class
    top5_probs, top5_indices = torch.topk(probs, 5)
    
    for idx, prob in zip(top5_indices.tolist(), top5_probs.tolist()):
        if idx in FISH_CLASS_INDICES:
            return True, prob
    
    # Return the highest score seen among fish classes (even if they didn't make top 5)
    fish_score = max(probs[i].item() for i in FISH_CLASS_INDICES)
    return False, fish_score



def _has_red_dominance(image: Image.Image) -> tuple[bool, float]:
    """
    Detects gill-red using HSV color space, which is robust to lighting changes.
    Gills are reliably in the red hue range (0-15 or 340-360 degrees in HSV).
    Returns (is_dominant, red_ratio).
    """
    hsv = image.convert('HSV')
    hsv_array = np.array(hsv, dtype=np.float32)

    h, s, v = hsv_array[:, :, 0], hsv_array[:, :, 1], hsv_array[:, :, 2]

    # PIL HSV: H is 0-255 (not 0-360). Red wraps around 0 and 255.
    # Red hue range: 0-15 degrees -> 0-10 in PIL scale, and 340-360 -> 240-255 in PIL scale
    red_hue_low  = (h <= 10)
    red_hue_high = (h >= 240)
    has_saturation = s > 80   # Must be a vivid red, not washed out grey/pink
    has_brightness = v > 80   # Must be visible, not black

    red_mask = (red_hue_low | red_hue_high) & has_saturation & has_brightness
    red_ratio = red_mask.sum() / red_mask.size
    return red_ratio > 0.06, red_ratio


def _has_dark_circular_region(img_array: np.ndarray) -> tuple[bool, float]:
    """
    Checks for a distinct dark circular pupil-like region surrounded by a lighter iris.
    This is the unique visual signature of a fish eye closeup.
    Returns (has_eye_structure, score).
    """
    gray = np.mean(img_array, axis=2)
    h, w = gray.shape

    # Sample a central region where the eye is most likely to be
    cy, cx = h // 2, w // 2
    sample_radius = min(h, w) // 4

    y1 = max(0, cy - sample_radius)
    y2 = min(h, cy + sample_radius)
    x1 = max(0, cx - sample_radius)
    x2 = min(w, cx + sample_radius)

    center_crop = gray[y1:y2, x1:x2]
    surrounding = np.concatenate([
        gray[:y1, :].flatten(),
        gray[y2:, :].flatten(),
        gray[:, :x1].flatten(),
        gray[:, x2:].flatten()
    ])

    center_mean = center_crop.mean()
    surrounding_mean = surrounding.mean() if surrounding.size > 0 else center_mean

    # An eye has a dark center, lighter surrounding (iris/sclera)
    contrast_score = surrounding_mean - center_mean
    return contrast_score > 25, contrast_score


def classify_image_type(image: Image.Image) -> ImageType:
    """
    Full router: first validates the image is a fish, then routes to BODY, EYE, or GILL.
    """
    # --- Step 0: Fish Validity Gate ---
    is_fish, gate_score = is_valid_fish_image(image)
    print(f"   [Router Trace] Fish gate: {'PASS' if is_fish else 'FAIL'} (Score: {gate_score:.2%})")
    
    if not is_fish:
        return ImageType.NOT_A_FISH
    
    # Resize to a standard working size for consistent analysis
    img = image.copy()
    img.thumbnail((512, 512))
    img_array = np.array(img, dtype=np.float32)

    # --- Step 1: Check for Gill (Red Color Dominance) ---
    is_gill, red_ratio = _has_red_dominance(img)
    print(f"   [Router Trace] HSV red ratio: {red_ratio:.2%} | Is Gill: {is_gill}")

    if is_gill:
        return ImageType.GILL

    # --- Step 2: Check for Eye (Dark Circular Center vs Lighter Surround) ---
    has_eye, contrast_score = _has_dark_circular_region(img_array)
    print(f"   [Router Trace] Center-surround contrast: {contrast_score:.1f} | Has Eye: {has_eye}")

    if has_eye:
        return ImageType.EYE

    # --- Step 3: Default to Body ---
    return ImageType.BODY
