"""Pydantic models mirroring docs/API_CONTRACT.md. Unknown keys are rejected in both directions."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

# Pydantic keeps the exact JSON type in these unions: true stays a bool and 58 stays an int.
FeatureValue = bool | int | float | str
Number = int | float
ModelType = Literal["logistic_regression", "random_forest", "gradient_boosting"]
RiskLevel = Literal["low", "moderate", "high"]
ShapUnits = Literal["log_odds", "probability"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- GET /api/meta -------------------------------------------------------------------------------


class DatasetInfo(Strict):
    name: str
    citation: str
    license: str
    url: str
    n_total: int
    n_train: int
    n_holdout: int


class TargetInfo(Strict):
    id: str
    label: str
    short_label: str
    kind: Literal["overall", "vessel"]
    description: str
    model_type: ModelType
    shap_units: ShapUnits


class FeatureGroup(Strict):
    id: str
    label: str


class FeatureSchema(Strict):
    id: str
    source_column: str
    label: str
    description: str | None
    group: str
    type: Literal["numeric", "binary", "categorical", "ordinal"]
    unit: str | None
    integer: bool
    min: Number | None
    max: Number | None
    step: Number | None
    categories: list[str] | None
    default: FeatureValue


class RiskLevelInfo(Strict):
    id: RiskLevel
    label: str
    min: float
    max: float


class DroppedFeature(Strict):
    source_column: str
    reason: str


class MetaResponse(Strict):
    model_version: str
    trained_at: str
    dataset: DatasetInfo
    targets: list[TargetInfo]
    feature_groups: list[FeatureGroup]
    features: list[FeatureSchema]
    quick_controls: list[str]
    decision_threshold: float
    risk_levels: list[RiskLevelInfo]
    excluded_columns: list[str]
    dropped_features: list[DroppedFeature]


# --- GET /api/samples ----------------------------------------------------------------------------


class SamplePatient(Strict):
    id: str
    title: str
    subtitle: str
    features: dict[str, FeatureValue]
    ground_truth: dict[str, Literal[0, 1]]
    note: str


class SamplesResponse(Strict):
    samples: list[SamplePatient]


# --- POST /api/predict ---------------------------------------------------------------------------


class PredictRequest(Strict):
    # Values are checked one by one against the feature schema (BR-13), not by Pydantic.
    features: dict[str, Any]


class TargetPrediction(Strict):
    probability: float
    predicted: bool
    risk_level: RiskLevel


class Agreement(Strict):
    consistent: bool
    message: str | None


class Contribution(Strict):
    feature: str
    value: FeatureValue
    shap: float
    relative: float
    direction: Literal["raises", "lowers", "neutral"]
    percentile: int | None


class Explanation(Strict):
    model_type: ModelType
    shap_units: ShapUnits
    base_value: float
    output_value: float
    contributions: list[Contribution]
    summary: str


class PredictResponse(Strict):
    model_version: str
    predictions: dict[str, TargetPrediction]
    agreement: Agreement
    explanations: dict[str, Explanation]


# --- GET /api/metrics ----------------------------------------------------------------------------


class Stat(Strict):
    mean: float
    std: float


class MetricSet(Strict):
    accuracy: Stat
    precision: Stat
    recall: Stat
    specificity: Stat
    f1: Stat
    roc_auc: Stat
    average_precision: Stat
    brier: Stat


class ImportanceItem(Strict):
    feature: str
    share: float


class PlotPaths(Strict):
    roc: str
    calibration: str
    confusion: str


class TargetMetrics(Strict):
    n_positive: int
    n_negative: int
    prevalence: float
    selected_model: ModelType
    selection_reason: str
    candidates: dict[str, MetricSet]
    global_importance: list[ImportanceItem]
    plots: PlotPaths


class ValidationInfo(Strict):
    scheme: Literal["repeated_stratified_kfold"]
    n_splits: int
    n_repeats: int
    seed: int
    n_rows: int
    decision_threshold: float
    preprocessing_inside_folds: bool
    excluded_columns: list[str]
    holdout_note: str


class MetricsResponse(Strict):
    model_version: str
    validation: ValidationInfo
    targets: dict[str, TargetMetrics]
