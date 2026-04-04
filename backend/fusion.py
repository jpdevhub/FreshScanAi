import numpy as np

# Stream class indices based on the training notebook
# Stream A: 0 = C1, 1 = C2, 2 = C3
# Stream B: 0 = Fresh_Eyes, 1 = Fresh_Gills, 2 = Nonfresh_Eyes, 3 = Nonfresh_Gills

def apply_temperature_scaling(logits: np.ndarray, temperature: float = 1.5) -> np.ndarray:
    """
    Applies Temperature Scaling to raw logits to calibrate confidence (ECE requirement).
    """
    scaled_logits = logits / temperature
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits)) # stability
    return exp_logits / np.sum(exp_logits)

def calculate_confidence(body_probs: np.ndarray, eye_probs: np.ndarray, gill_probs: np.ndarray) -> float:
    """
    Calculates overall system confidence based on the maximum probabilities from each stream.
    Fusion of individual stream confidences (weighted average matching the score formula).
    """
    body_conf = np.max(body_probs)
    # For eyes and gills, confidence is the strength of the prediction within their binary subsets
    eye_sub_sum = eye_probs[0] + eye_probs[2] if (eye_probs[0] + eye_probs[2]) > 0 else 1e-7
    gill_sub_sum = gill_probs[1] + gill_probs[3] if (gill_probs[1] + gill_probs[3]) > 0 else 1e-7
    
    eye_conf = max(eye_probs[0] / eye_sub_sum, eye_probs[2] / eye_sub_sum)
    gill_conf = max(gill_probs[1] / gill_sub_sum, gill_probs[3] / gill_sub_sum)
    
    # Combined confidence
    return (0.5 * body_conf) + (0.25 * eye_conf) + (0.25 * gill_conf)

def process_and_fuse(body_logits: np.ndarray, eye_logits: np.ndarray, gill_logits: np.ndarray, temperature: float = 1.5) -> dict:
    """
    Runs math calibration, probability mapping, and final freshness fusion.
    """
    # 1. Temperature Scaling
    body_probs = apply_temperature_scaling(body_logits, temperature)
    eye_probs = apply_temperature_scaling(eye_logits, temperature)
    gill_probs = apply_temperature_scaling(gill_logits, temperature)
    
    # 2. Probability Mapping to 0.0 - 1.0 Scale
    body_score = (body_probs[0] * 1.0) + (body_probs[1] * 0.5) + (body_probs[2] * 0.0)
    
    eps = 1e-7
    eye_score = eye_probs[0] / (eye_probs[0] + eye_probs[2] + eps)
    gill_score = gill_probs[1] / (gill_probs[1] + gill_probs[3] + eps)
    
    # 3. Exact Fusion Formula
    final_score = (0.5 * body_score) + (0.25 * eye_score) + (0.25 * gill_score)
    final_score_percent = final_score * 100.0
    
    # Determine Grade
    if final_score_percent >= 90:
        grade = "A"
    elif final_score_percent >= 75:
        grade = "B"
    elif final_score_percent >= 60:
        grade = "C"
    else:
        grade = "Spoiled"
        
    # 4. Uncertainty Constraint Check
    system_confidence = calculate_confidence(body_probs, eye_probs, gill_probs)
    is_uncertain = bool(system_confidence < 0.70)
    
    return {
        "final_score_percent": float(final_score_percent),
        "final_grade": grade,
        "confidence_score": float(system_confidence),
        "uncertain_prediction_flag": is_uncertain,
        "regional_breakdown": {
            "body_freshness_score": float(body_score),
            "eye_freshness_score": float(eye_score),
            "gill_freshness_score": float(gill_score)
        },
        "raw_probs": {
            "body_probs": body_probs.tolist(),
            "eye_probs": eye_probs.tolist(),
            "gill_probs": gill_probs.tolist()
        }
    }
