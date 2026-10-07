"""SHAP explanations, shared by training (global importance) and the API (per patient)."""

import bisect
import math
from collections.abc import Sequence
from decimal import Decimal

import numpy as np
import pandas as pd
import shap

from ml.dataset import plain_value

MAX_RAISING_FACTORS = 3
MAX_LOWERING_FACTORS = 1


def build_explainer(model_type: str, classifier, background: np.ndarray | None):
    """Exact explainer for the model type (DATA_MODEL §7.6)."""
    if model_type == "logistic_regression":
        # Every training row is background, so the base value is the mean output over all of them.
        masker = shap.maskers.Independent(background, max_samples=background.shape[0])
        return shap.LinearExplainer(classifier, masker)
    return shap.TreeExplainer(classifier)


def shap_values(explainer, transformed: np.ndarray) -> tuple[np.ndarray, float]:
    """Positive-class SHAP values, shape (rows, transformed columns), and the base value."""
    values = np.asarray(explainer.shap_values(transformed))
    base = np.atleast_1d(explainer.expected_value)
    if values.ndim == 3:  # random forest: one slice per class
        return values[:, :, 1], float(base[1])
    return values, float(base[0])


def group_by_feature(
    values: np.ndarray, transformed_to_feature: Sequence[str], feature_ids: Sequence[str]
) -> np.ndarray:
    """Sum transformed-column SHAP values back to original features (one-hot parts add up)."""
    position = {feature: index for index, feature in enumerate(feature_ids)}
    grouped = np.zeros((values.shape[0], len(feature_ids)))
    for column, feature in enumerate(transformed_to_feature):
        grouped[:, position[feature]] += values[:, column]
    return grouped


def relative_contributions(values: np.ndarray) -> np.ndarray:
    """BR-7: shap_i / Σ|shap_j|, all zero when the sum is zero."""
    total = np.abs(values).sum()
    return values / total if total > 0 else np.zeros_like(values, dtype=float)


def direction(value: float) -> str:
    if value > 0:
        return "raises"
    return "lowers" if value < 0 else "neutral"


def percentile(value: float, sorted_reference: Sequence[float]) -> int:
    """Share of training patients with a value <= `value`, as an integer 0 to 100 (half rounds up)."""
    share = bisect.bisect_right(sorted_reference, value) / len(sorted_reference)
    return math.floor(100 * share + 0.5)


def global_importance(grouped: np.ndarray, feature_ids: Sequence[str]) -> list[dict]:
    """Every feature's share of mean |SHAP| (DATA_MODEL §6), largest first."""
    mean_abs = np.abs(grouped).mean(axis=0)
    total = mean_abs.sum()
    shares = mean_abs / total if total > 0 else mean_abs
    order = sorted(range(len(feature_ids)), key=lambda index: (-shares[index], index))
    return [{"feature": feature_ids[index], "share": float(shares[index])} for index in order]


def format_number(value: float, step: float) -> str:
    """Number with the precision of the feature's step, without trailing zeros."""
    decimals = max(0, -Decimal(str(step)).as_tuple().exponent)
    text = f"{value:.{decimals}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def format_value(entry: dict, value) -> str:
    """A feature value as shown in the summary: "yes", "67 years", "55%", "LBBB"."""
    if entry["type"] == "binary":
        return "yes" if value else "no"
    if entry["type"] != "numeric":
        return str(value)
    number = format_number(value, entry["step"])
    if not entry["unit"]:
        return number
    return f"{number}{entry['unit']}" if entry["unit"] == "%" else f"{number} {entry['unit']}"


def sentence_label(label: str) -> str:
    """A label as it reads mid-sentence: "Age" -> "age"; "ST elevation" and "Q wave" are kept."""
    return label[0].lower() + label[1:] if label[1:2].islower() else label


def build_summary(contributions: Sequence[dict], schema_by_id: dict[str, dict]) -> str:
    """BR-8 template. `contributions` must be sorted by |shap|, largest first."""

    def phrase(item: dict) -> str:
        entry = schema_by_id[item["feature"]]
        return f"{sentence_label(entry['label'])} ({format_value(entry, item['value'])})"

    raising = [item for item in contributions if item["shap"] > 0][:MAX_RAISING_FACTORS]
    lowering = [item for item in contributions if item["shap"] < 0][:MAX_LOWERING_FACTORS]
    sentences = []
    if raising:
        noun = "Factors" if len(raising) > 1 else "Factor"
        listed = ", ".join(phrase(item) for item in raising)
        sentences.append(f"{noun} that most increased this estimate: {listed}.")
    if lowering:
        estimate = "it" if raising else "this estimate"
        sentences.append(f"Factor that most decreased {estimate}: {phrase(lowering[0])}.")
    return " ".join(sentences) or "No factor changed this estimate."


class TargetExplainer:
    """Explains one target's predictions from its model bundle (DATA_MODEL §7.6)."""

    def __init__(self, bundle: dict, schema: Sequence[dict], reference_values: dict[str, list]):
        self.model_type = bundle["model_type"]
        self.shap_units = bundle["shap_units"]
        self.feature_ids = bundle["feature_ids"]
        self.transformed_to_feature = bundle["transformed_to_feature"]
        self.preprocessor = bundle["pipeline"].named_steps["preprocess"]
        self.schema_by_id = {entry["id"]: entry for entry in schema}
        self.reference_values = reference_values
        self.explainer = build_explainer(
            self.model_type, bundle["pipeline"].named_steps["model"], bundle["shap_background"]
        )

    def grouped_shap(self, features: pd.DataFrame) -> tuple[np.ndarray, float]:
        """SHAP values per original feature, shape (rows, features), and the base value."""
        transformed = self.preprocessor.transform(features[self.feature_ids])
        values, base = shap_values(self.explainer, transformed)
        return group_by_feature(values, self.transformed_to_feature, self.feature_ids), base

    def explain(self, features: pd.DataFrame) -> dict:
        """Explanation (API_CONTRACT §5) for a one-row frame of canonical values; floats unrounded."""
        grouped, base = self.grouped_shap(features)
        row = grouped[0]
        relative = relative_contributions(row)
        contributions = []
        for index in sorted(range(len(row)), key=lambda i: (-abs(row[i]), i)):
            feature = self.feature_ids[index]
            value = plain_value(features[feature].iloc[0])
            numeric = self.schema_by_id[feature]["type"] == "numeric"
            contributions.append(
                {
                    "feature": feature,
                    "value": value,
                    "shap": float(row[index]),
                    "relative": float(relative[index]),
                    "direction": direction(row[index]),
                    "percentile": percentile(value, self.reference_values[feature]) if numeric else None,
                }
            )
        return {
            "model_type": self.model_type,
            "shap_units": self.shap_units,
            "base_value": base,
            "output_value": base + float(row.sum()),
            "contributions": contributions,
            "summary": build_summary(contributions, self.schema_by_id),
        }
