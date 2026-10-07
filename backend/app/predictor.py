"""Validated canonical inputs -> PredictResponse (ARCHITECTURE DF-2 step 5)."""

import threading

import pandas as pd

from app.registry import Registry
from ml.config import DECISION_THRESHOLD, RISK_LEVELS, TARGET_IDS, VESSEL_IDS

PROBABILITY_DECIMALS = 4
SHAP_DECIMALS = 6
RELATIVE_DECIMALS = 4

AGREEMENT_INTRO = (
    "The overall CAD model and the three vessel models are trained separately, so they can disagree."
)
CAD_WITHOUT_VESSEL = "CAD is predicted but no single vessel reaches 50%"
VESSEL_WITHOUT_CAD = "a vessel reaches 50% but overall CAD is not predicted"

# One prediction at a time: the models and explainers are shared between requests.
_lock = threading.Lock()


def risk_level(probability: float) -> str:
    """BR-4, display only: low below 0.35, moderate below 0.65, otherwise high."""
    for level in RISK_LEVELS[:-1]:
        if probability < level["max"]:
            return level["id"]
    return RISK_LEVELS[-1]["id"]


def agreement(predictions: dict[str, dict]) -> dict:
    """BR-6: say so when the overall model and the vessel models disagree; never force them to agree."""
    cad = predictions["cad"]["predicted"]
    any_vessel = any(predictions[vessel]["predicted"] for vessel in VESSEL_IDS)
    if cad == any_vessel:
        return {"consistent": True, "message": None}
    detail = CAD_WITHOUT_VESSEL if cad else VESSEL_WITHOUT_CAD
    return {"consistent": False, "message": f"{AGREEMENT_INTRO} Here, {detail}."}


def _rounded(explanation: dict) -> dict:
    return {
        **explanation,
        "base_value": round(explanation["base_value"], SHAP_DECIMALS),
        "output_value": round(explanation["output_value"], SHAP_DECIMALS),
        "contributions": [
            {
                **item,
                "shap": round(item["shap"], SHAP_DECIMALS),
                "relative": round(item["relative"], RELATIVE_DECIMALS),
            }
            for item in explanation["contributions"]
        ],
    }


def predict(registry: Registry, features: dict) -> dict:
    """Four probabilities and four explanations for one validated patient record."""
    frame = pd.DataFrame([features])
    predictions, explanations = {}, {}
    with _lock:
        # Any failure fails the whole request, so a response never mixes targets (D-032).
        for target in TARGET_IDS:
            positive = registry.pipelines[target].predict_proba(frame)[0, 1]
            probability = round(float(positive), PROBABILITY_DECIMALS)
            predictions[target] = {
                "probability": probability,
                # Status and level come from the rounded value, so they always match what is shown.
                "predicted": probability >= DECISION_THRESHOLD,
                "risk_level": risk_level(probability),
            }
            explanations[target] = _rounded(registry.explainers[target].explain(frame))
    return {
        "model_version": registry.model_version,
        "predictions": predictions,
        "agreement": agreement(predictions),
        "explanations": explanations,
    }
