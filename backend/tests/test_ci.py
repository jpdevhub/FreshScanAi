"""
tests/test_ci.py — Lightweight CI smoke tests for FreshScan AI backend.

These tests run without PyTorch, model files, or a live server.
They verify pure Python logic that can be tested in isolation.
"""

import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np


# ---------------------------------------------------------------------------
# fusion.py — pure numpy, no torch required
# ---------------------------------------------------------------------------

from fusion import apply_temperature_scaling, calculate_confidence, process_and_fuse


def test_temperature_scaling_output_sums_to_one():
    logits = np.array([1.0, 2.0, 0.5])
    probs = apply_temperature_scaling(logits)
    assert abs(probs.sum() - 1.0) < 1e-6


def test_temperature_scaling_preserves_ordering():
    logits = np.array([3.0, 1.0, 2.0])
    probs = apply_temperature_scaling(logits)
    assert probs[0] > probs[2] > probs[1]


def test_temperature_scaling_higher_temp_flattens_distribution():
    logits = np.array([3.0, 1.0, 0.5])
    low_temp = apply_temperature_scaling(logits, temperature=0.5)
    high_temp = apply_temperature_scaling(logits, temperature=5.0)
    # Higher temperature → lower max probability (flatter)
    assert high_temp.max() < low_temp.max()


def test_calculate_confidence_returns_float_in_range():
    body_probs = np.array([0.7, 0.2, 0.1])
    eye_probs = np.array([0.6, 0.1, 0.2, 0.1])
    gill_probs = np.array([0.1, 0.7, 0.1, 0.1])
    conf = calculate_confidence(body_probs, eye_probs, gill_probs)
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 1.0


def test_process_and_fuse_returns_expected_keys():
    body = np.array([2.0, 1.0, 0.5])
    eye = np.array([1.5, 0.5, 0.3, 0.2])
    gill = np.array([0.3, 1.8, 0.4, 0.5])
    result = process_and_fuse(body, eye, gill)
    required_keys = {
        "final_score_percent",
        "final_grade",
        "confidence_score",
        "uncertain_prediction_flag",
        "regional_breakdown",
    }
    assert required_keys.issubset(result.keys())


def test_process_and_fuse_score_in_valid_range():
    body = np.array([2.0, 1.0, 0.5])
    eye = np.array([1.5, 0.5, 0.3, 0.2])
    gill = np.array([0.3, 1.8, 0.4, 0.5])
    result = process_and_fuse(body, eye, gill)
    assert 0.0 <= result["final_score_percent"] <= 100.0


def test_process_and_fuse_grade_is_valid():
    body = np.array([2.0, 1.0, 0.5])
    eye = np.array([1.5, 0.5, 0.3, 0.2])
    gill = np.array([0.3, 1.8, 0.4, 0.5])
    result = process_and_fuse(body, eye, gill)
    assert result["final_grade"] in {"A", "B", "C", "Spoiled"}


def test_process_and_fuse_uncertain_flag_is_bool():
    body = np.array([1.0, 1.0, 1.0])  # uniform → low confidence
    eye = np.array([1.0, 1.0, 1.0, 1.0])
    gill = np.array([1.0, 1.0, 1.0, 1.0])
    result = process_and_fuse(body, eye, gill)
    assert isinstance(result["uncertain_prediction_flag"], bool)


# ---------------------------------------------------------------------------
# auth.py — environment parsing logic, no Supabase connection needed
# ---------------------------------------------------------------------------


def test_dev_bypass_constants_are_readable():
    """Verify the module loads and the env-driven constants are accessible."""
    import auth

    assert hasattr(auth, "DEV_BYPASS_AUTH")
    assert hasattr(auth, "DEV_BYPASS_TOKEN")
    assert isinstance(auth.DEV_BYPASS_AUTH, bool)
    assert isinstance(auth.DEV_BYPASS_TOKEN, str)
