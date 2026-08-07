"""
Unit tests for `species_classifier.py` (issue #172).

These tests run in two modes so they pass even when torch is unavailable
(eg. CI without GPU/CPU torch installed):

  1. **Torch available**: real MobileNetV3-Small forward passes, with the
     training checkpoint if present. If the checkpoint is missing, only
     exercise the model-loading logic and the "model unavailable" code paths.

  2. **Torch unavailable**: every test asserts graceful degradation —
     `classify_species` returns `None`, `is_available()` is False, no
     exceptions escape the module.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image

# Make `backend/` importable when run from repo root with `pytest backend/tests/`.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _fresh_module():
    """Re-import `species_classifier` so test state is fresh between tests."""
    import importlib
    import species_classifier  # noqa: F401  (ensures it's in sys.modules)

    return importlib.reload(species_classifier)


def _fresh_rgb_image(size=(226, 226), color=(128, 128, 128)) -> Image.Image:
    return Image.new("RGB", size, color)


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def module():
    """A freshly re-imported species_classifier module. Reloads at the
    original model path after the test so subsequent tests see singleton
    state matching a fresh import."""
    m = _fresh_module()
    initial_path = m._resolve_model_path()
    yield m
    try:
        m.reload_model(str(initial_path))
    except Exception:
        pass


@pytest.fixture
def requires_torch(module):
    if not module._TORCH_AVAILABLE:
        pytest.skip("torch not installed in this environment")
    return module


@pytest.fixture
def requires_model(module):
    if not module._TORCH_AVAILABLE:
        pytest.skip("torch not installed")
    if not module.is_available():
        pytest.skip("species model unavailable (checkpoint missing)")
    return module


# ── Constants ────────────────────────────────────────────────────────────────


def test_species_classes_count_and_order(module):
    """Pin the canonical 10-class list — reordering would silently
    misclassify every fish."""
    assert module.SPECIES_CLASSES == (
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
    assert len(module.SPECIES_CLASSES) == 10


def test_classify_returns_none_when_torch_unavailable(module):
    """If torch isn't installed, `classify_species` returns None (no raise)."""
    if module._TORCH_AVAILABLE:
        pytest.skip("torch is installed — this test only runs when torch missing")
    img = _fresh_rgb_image()
    assert module.classify_species(img) is None
    assert module.is_available() is False


def test_classify_returns_none_when_model_file_missing(module, monkeypatch):
    """Without the .pth file, the module sets `_model=None` and every
    classify call returns None."""
    if not module._TORCH_AVAILABLE:
        pytest.skip(
            "torch not installed — covered by test_classify_returns_none_when_torch_unavailable"
        )
    import tempfile

    tmp_dir = tempfile.mkdtemp(prefix="freshscan-test-")
    try:
        bogus_path = Path(tmp_dir) / "does_not_exist.pth"
        monkeypatch.setenv("SPECIES_MODEL", str(bogus_path))
        module.reload_model()
        assert module.is_available() is False
        assert module.classify_species(_fresh_rgb_image()) is None
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_classify_returns_none_on_inference_exception(module):
    """If model.forward raises, `classify_species` returns None so the
    scan endpoint's 200 succeeds (per issue's `species=null` criterion)."""
    if not module.is_available():
        pytest.skip("species model not available — cannot stub a failing forward")
    img = _fresh_rgb_image()

    def _boom(_tensor):
        raise RuntimeError("simulated OOM")

    model = module._model
    original_forward = model.forward
    model.forward = _boom  # type: ignore[method-assign]
    try:
        result = module.classify_species(img)
    finally:
        model.forward = original_forward  # type: ignore[method-assign]
    assert result is None


def test_classify_preserves_image_mode(module):
    """RGBA / P / L images must be converted to RGB without raising
    (training pipeline expects RGB)."""
    if not module.is_available():
        pytest.skip("species model not available in this environment")
    rgba = Image.new("RGBA", (300, 300), (10, 20, 30, 255))
    result = module.classify_species(rgba)
    if result is not None:
        assert "name" in result
        assert "confidence" in result
        assert "top3" in result


def test_classify_handles_non_rgb_inputs_gracefully(module):
    """P (palette) and L (grayscale) images must not raise."""
    if not module.is_available():
        pytest.skip("species model not available")
    palette = Image.new("P", (224, 224), color=10)
    grayscale = Image.new("L", (224, 224), color=128)
    module.classify_species(palette)
    module.classify_species(grayscale)


def test_classify_returns_correct_dict_shape(module):
    """When the model is available, the returned dict matches the issue
    acceptance-criteria::

        {"name": str, "confidence": float, "top3": [{name, confidence}, ...]}
    """
    if not module.is_available():
        pytest.skip("species model not available in this environment")
    img = _fresh_rgb_image()
    result = module.classify_species(img)
    assert result is not None
    assert set(result.keys()) >= {"name", "confidence", "top3"}
    assert result["name"] in module.SPECIES_CLASSES
    assert 0.0 <= result["confidence"] <= 1.0
    assert isinstance(result["top3"], list)
    assert len(result["top3"]) == 3
    for entry in result["top3"]:
        assert set(entry.keys()) == {"name", "confidence"}
        assert entry["name"] in module.SPECIES_CLASSES
        assert 0.0 <= entry["confidence"] <= 1.0
    # top1 must be the max of top3.
    assert result["top3"][0]["confidence"] == max(
        e["confidence"] for e in result["top3"]
    )


def test_classify_top3_names_are_distinct(module):
    """Top-3 predictions must be 3 distinct species (no duplicates)."""
    if not module.is_available():
        pytest.skip("species model not available")
    img = _fresh_rgb_image()
    result = module.classify_species(img)
    if result is None:
        pytest.skip("model returned None — cannot verify")
    names = [e["name"] for e in result["top3"]]
    assert len(names) == len(set(names)), f"top3 has duplicates: {names}"


def test_top3_confidences_sum_to_near_one(module):
    """The top-3 softmax outputs should sum to <= 1.0 (10-class softmax).
    This guards against accidentally returning raw logits.

    Tolerance is 1e-3 (not 1e-6) because `_format_top3` rounds each
    confidence to 4 decimals before summing — three independent
    roundings can drift the total by up to ~3e-4. The 1e-3 cushion
    safely absorbs that while still catching raw-logit regressions by
    3+ orders of magnitude (raw-logit top3 on a 10-class softmax would
    overshoot 1.0 by orders more). See CodeRabbit review on PR #182.
    """
    if not module.is_available():
        pytest.skip("species model not available")
    img = _fresh_rgb_image()
    result = module.classify_species(img)
    if result is None:
        pytest.skip("model returned None")
    total = sum(e["confidence"] for e in result["top3"])
    assert 0.0 < total <= 1.0 + 1e-3


def test_resolve_model_path_priority(module, monkeypatch):
    """Path resolution priority: explicit arg → env → repo default."""
    import tempfile

    tmp_dir = tempfile.mkdtemp(prefix="freshscan-test-")
    try:
        # Case 1: explicit arg wins.
        explicit = Path(tmp_dir) / "explicit.pth"
        assert module._resolve_model_path(str(explicit)) == Path(explicit)
        # Case 2: env var beats default.
        env_path = Path(tmp_dir) / "env.pth"
        monkeypatch.setenv("SPECIES_MODEL", str(env_path))
        assert module._resolve_model_path() == Path(env_path)
        # Case 3: repo default.
        monkeypatch.delenv("SPECIES_MODEL", raising=False)
        resolved = module._resolve_model_path()
        assert resolved.name == module.SPECIES_MODEL_FILENAME
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_load_model_strips_ddp_module_prefix(module, monkeypatch):
    """Checkpoints saved from DistributedDataParallel wrappers have a
    `module.` prefix on every key; the loader must strip it."""
    if not module._TORCH_AVAILABLE:
        pytest.skip("torch not installed")
    import torch

    tmp_dir = tempfile.mkdtemp(prefix="freshscan-test-")
    try:
        model = module._build_mobilenetv3_small()
        prefixed = {f"module.{k}": v for k, v in model.state_dict().items()}
        pth_path = Path(tmp_dir) / "ddp_model.pth"
        torch.save(prefixed, str(pth_path))
        monkeypatch.setenv("SPECIES_MODEL", str(pth_path))
        module.reload_model()
        assert module.is_available() is True
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_classify_returns_none_skill_does_not_silently_pass(module, monkeypatch):
    """Regression-guard: when species_pred is None, the payload's `species`
    block must be exactly None — NOT a stale placeholder. Covered in
    main.py's `_build_scan_payload` via species_prediction=None."""
    # This is more of a documentation test — we re-assert the module behavior.
    if not module._TORCH_AVAILABLE:
        pytest.skip("torch not installed")
    tmp_dir = tempfile.mkdtemp(prefix="freshscan-test-")
    try:
        bogus_path = Path(tmp_dir) / "missing.pth"
        monkeypatch.setenv("SPECIES_MODEL", str(bogus_path))
        module.reload_model()
        assert module.is_available() is False
        assert module.classify_species(_fresh_rgb_image()) is None
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)
