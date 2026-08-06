"""
Species Classifier — MobileNetV3-Small inference for fish species detection.

Per issue #172: load `Models/species_mobilenetv3.pth` once at module import
(singleton), expose `classify_species(pil_image) -> Optional[dict]`.

If the model file is missing or torch is unavailable, the module degrades
gracefully: `classify_species` returns `None` and the scan endpoint emits
`species: null` in its response instead of raising (per acceptance criteria).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional, TypedDict

logger = logging.getLogger("freshscan.species")

# Lazy torch import: keep the FastAPI server bootable on hosts without
# torch installed (matches inference.py's `try/except ModuleNotFoundError`).
try:
    import torch  # type: ignore
    import torch.nn as nn  # type: ignore
    from torchvision import models, transforms  # type: ignore
    from PIL import Image  # type: ignore

    _TORCH_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover — exercised only on hosts w/o torch
    _TORCH_AVAILABLE = False
    torch = None  # type: ignore
    nn = None  # type: ignore
    models = None  # type: ignore
    transforms = None  # type: ignore
    Image = None  # type: ignore

# ── Constants ────────────────────────────────────────────────────────────────

# The 10 supported species (matches the training set in
# `Models/species_mobilenetv3.pth`). Order is critical — it must line up
# with the order the classifier head was trained against.
SPECIES_CLASSES: tuple[str, ...] = (
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
)

SPECIES_MODEL_FILENAME = "species_mobilenetv3.pth"
INPUT_SIZE = (224, 224)

# ImageNet normalization (matches inference.py's `common_normalize`).
_IMAGENET_MEAN = (0.485, 0.456, 0.406)
_IMAGENET_STD = (0.229, 0.224, 0.225)


class SpeciesResult(TypedDict):
    name: str
    confidence: float
    top3: list[dict]


# ── Model file resolution ────────────────────────────────────────────────────

def _resolve_model_path(explicit_path: Optional[str] = None) -> Path:
    """Return the absolute path to species_mobilenetv3.pth.

    Resolution order (matches `main.py` STREAM_A pattern):
      1. Explicit `explicit_path` argument (caller-provided override)
      2. `SPECIES_MODEL` env var
      3. `<repo_root>/Models/species_mobilenetv3.pth`
    """
    if explicit_path:
        return Path(explicit_path)
    env_path = os.environ.get("SPECIES_MODEL")
    if env_path:
        return Path(env_path)
    # backend/species_classifier.py → repo_root/Models/…
    repo_root = Path(__file__).resolve().parent.parent
    model_dir = Path(os.environ.get("MODEL_DIR", str(repo_root / "Models")))
    return model_dir / SPECIES_MODEL_FILENAME


# ── Model architecture ───────────────────────────────────────────────────────

def _build_mobilenetv3_small(num_classes: int = len(SPECIES_CLASSES)):
    """Construct MobileNetV3-Small with a fresh classifier head matching
    the trained checkpoint. Mirrors how `inference.py` rebuilds MobileNetV2
    for Stream A — `weights=None` so we don't pull the ImageNet backbone.
    """
    model = models.mobilenet_v3_small(weights=None)
    # MobileNetV3-Small classifier: Sequential[Linear(576,1024), Hardswish,
    # Dropout, Linear(1024, num_classes)]. Replace only the last layer.
    last = model.classifier[-1]  # type: ignore[attr-defined]
    in_features = last.in_features  # type: ignore[attr-defined]
    model.classifier[-1] = nn.Linear(in_features, num_classes)  # type: ignore[index]
    return model


# ── Module-level singleton state ──────────────────────────────────────────────

# Loaded once at module import time per the issue's "Do NOT reload the model
# on every request" requirement. `None` means unavailable (no torch, no .pth,
# or load exception); callers must treat `None` as "skip species" rather than
# failing the whole scan request.
_model = None
_device = None
_transform = None


def _load_model(model_path: Path) -> None:
    """Private loader — runs at import time and is idempotent (can be
    re-invoked in tests via `reload_model` to swap in a stub).
    """
    global _model, _device, _transform
    if not _TORCH_AVAILABLE:
        logger.info("PyTorch unavailable — species classifier disabled.")
        _model = None
        return
    if not model_path.exists():
        logger.info(
            "Species model not found at %s — species classifier disabled.",
            model_path,
        )
        _model = None
        return
    try:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = _build_mobilenetv3_small()
        # `weights_only=True` matches `inference.py`'s Stream A loader, but we
        # fall back to False so we don't reject checkpoints that bundled extra
        # optimizer state from the training run.
        try:
            state_dict = torch.load(
                str(model_path),
                map_location=_device,
                weights_only=True,
            )
        except Exception:
            state_dict = torch.load(
                str(model_path),
                map_location=_device,
                weights_only=False,
            )
        # Strip an optional `module.` DDP prefix if the checkpoint was saved
        # from a DistributedDataParallel wrapper — harmless otherwise.
        cleaned: dict = {}
        for k, v in state_dict.items():
            cleaned[k[7:] if k.startswith("module.") else k] = v
        model.load_state_dict(cleaned, strict=True)
        model.to(_device)
        model.eval()
        _model = model
        _transform = transforms.Compose(
            [
                transforms.Resize(INPUT_SIZE),
                transforms.ToTensor(),
                transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
            ]
        )
        logger.info(
            "Species model loaded from %s (device=%s, classes=%d).",
            model_path,
            _device,
            len(SPECIES_CLASSES),
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.exception("Failed to load species model: %s", exc)
        _model = None


# Eager load at import time (per issue requirement).
_load_model(_resolve_model_path())


def reload_model(model_path: Optional[str] = None) -> None:
    """Test seam: re-run the loader. Pass `model_path` to force a custom
    checkpoint location; omit it to re-resolve via env/defaults. Not
    used at runtime — only from `tests/test_species_classifier.py`.
    """
    _load_model(_resolve_model_path(model_path))


def is_available() -> bool:
    """Cheap predicate so `main.py` can decide whether to attempt species
    inference without needing to try/except on every scan request.
    """
    return _model is not None


# ── Inference ────────────────────────────────────────────────────────────────

def _run_inference(pil_image):
    """Preprocess + forward pass. Helper for `classify_species` so the
    no_grad decorator lives in one place.
    """
    # PIL images may arrive in RGBA or P (palette) mode — the training
    # pipeline assumes RGB. PIL's `.convert("RGB")` is a cheap no-op
    # if already RGB.
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")
    tensor = _transform(pil_image).unsqueeze(0).to(_device)
    # `torch.no_grad` is a context-manager, not just a decorator — use it
    # inline so we don't have to worry about partial-decorator quirks when
    # torch isn't installed. Note this runs only when `_TORCH_AVAILABLE` is
    # True because `classify_species` short-circuits before here otherwise.
    with torch.no_grad():  # type: ignore[union-attr]
        logits = _model(tensor)  # type: ignore[misc]
    return logits.squeeze(0)


def _format_top3(probs_tensor) -> list[dict]:
    """Map the top-3 class indices to {name, confidence} dicts. Confidence
    is rounded to 4 decimal places (e.g. 0.9451) to match the issue
    example payload.
    """
    if len(probs_tensor) < 3:
        # Defensive — the trained model always emits 10 classes, but tests
        # in CI sometimes feed stub logits with fewer entries.
        top_n = min(3, len(probs_tensor))
    else:
        top_n = 3
    top_indices = torch.topk(probs_tensor, top_n).indices.tolist()
    return [
        {"name": SPECIES_CLASSES[i], "confidence": round(float(probs_tensor[i]), 4)}
        for i in top_indices
    ]


def classify_species(pil_image) -> Optional[SpeciesResult]:
    """Run species classification on a PIL image.

    Returns ``None`` (per the issue's "If species model fails for any
    reason, the scan still succeeds (species is null)" criterion) when:
      * torch is not installed
      * the .pth file was missing at startup
      * the model load raised an exception at startup
      * the forward pass raises (corrupt image, OOM, etc.)

    On success returns::

        {
          "name": "Rohu Carp",
          "confidence": 0.9451,
          "top3": [
            {"name": "Rohu Carp",       "confidence": 0.9451},
            {"name": "Catla Carp",      "confidence": 0.0380},
            {"name": "Mrigal Carp",     "confidence": 0.0170},
          ],
        }
    """
    if not _TORCH_AVAILABLE or _model is None or _transform is None:
        return None
    try:
        logits = _run_inference(pil_image)
        probs = torch.softmax(logits, dim=0)
        confidence, idx = torch.max(probs, dim=0)
        return SpeciesResult(
            name=SPECIES_CLASSES[int(idx)],
            confidence=round(float(confidence), 4),
            top3=_format_top3(probs),
        )
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("Species inference failed (returning null): %s", exc)
        return None
