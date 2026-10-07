"""Candidate models (D-011): library defaults, fixed seeds, no tuning."""

from collections.abc import Sequence

from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from ml.config import SEED
from ml.preprocessing import build_preprocessor

# Selection order: on an exact ROC-AUC tie the earlier (simpler) model wins.
MODEL_TYPES = ("logistic_regression", "random_forest", "gradient_boosting")
BASELINE = "baseline_prior"

MODEL_LABELS = {
    "logistic_regression": "Logistic regression",
    "random_forest": "Random forest",
    "gradient_boosting": "Gradient boosting",
    BASELINE: "Baseline (class prior)",
}

# Units of the SHAP values each model type is explained in (DATA_MODEL §7.6).
SHAP_UNITS = {
    "logistic_regression": "log_odds",
    "random_forest": "probability",
    "gradient_boosting": "log_odds",
}


def make_classifier(model_type: str):
    if model_type == "logistic_regression":
        return LogisticRegression(max_iter=1000)
    if model_type == "random_forest":
        return RandomForestClassifier(n_estimators=300, random_state=SEED)
    if model_type == "gradient_boosting":
        return GradientBoostingClassifier(random_state=SEED)
    if model_type == BASELINE:
        return DummyClassifier(strategy="prior")
    raise ValueError(f"Unknown model type: {model_type}")


def make_pipeline(model_type: str, schema: Sequence[dict]) -> Pipeline:
    return Pipeline([("preprocess", build_preprocessor(schema)), ("model", make_classifier(model_type))])
