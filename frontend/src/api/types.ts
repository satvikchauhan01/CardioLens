// Mirrors docs/API_CONTRACT.md exactly. A change there means a change here in the same commit.

// §1 Shared types
export type TargetId = "cad" | "lad" | "lcx" | "rca";
export type ModelType = "logistic_regression" | "random_forest" | "gradient_boosting";
export type RiskLevel = "low" | "moderate" | "high";
export type FeatureValue = number | boolean | string;
export type FeatureType = "numeric" | "binary" | "categorical" | "ordinal";
export type FeatureGroupId = "demographic_history" | "symptoms_exam" | "ecg" | "laboratory" | "echo";
export type ShapUnits = "log_odds" | "probability";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "MODEL_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  issue:
    | "missing"
    | "unknown_field"
    | "wrong_type"
    | "not_finite"
    | "not_integer"
    | "out_of_range"
    | "not_allowed";
  message: string;
}

export interface ErrorResponse {
  error: { code: ErrorCode; message: string; details?: FieldError[] };
}

// §3 GET /api/meta
export interface TargetInfo {
  id: TargetId;
  label: string;
  short_label: string;
  kind: "overall" | "vessel";
  description: string;
  model_type: ModelType;
  shap_units: ShapUnits;
}

export interface FeatureSchema {
  id: string;
  source_column: string;
  label: string;
  description: string | null;
  group: FeatureGroupId;
  type: FeatureType;
  unit: string | null;
  integer: boolean;
  min: number | null;
  max: number | null;
  step: number | null;
  categories: string[] | null;
  default: FeatureValue;
}

export interface MetaResponse {
  model_version: string;
  trained_at: string;
  dataset: {
    name: string;
    citation: string;
    license: string;
    url: string;
    n_total: number;
    n_train: number;
    n_holdout: number;
  };
  targets: TargetInfo[];
  feature_groups: { id: FeatureGroupId; label: string }[];
  features: FeatureSchema[];
  quick_controls: string[];
  decision_threshold: number;
  risk_levels: { id: RiskLevel; label: string; min: number; max: number }[];
  excluded_columns: string[];
  dropped_features: { source_column: string; reason: string }[];
}

// §4 GET /api/samples
export interface SamplePatient {
  id: string;
  title: string;
  subtitle: string;
  features: Record<string, FeatureValue>;
  ground_truth: Record<TargetId, 0 | 1>;
  note: string;
}

export interface SamplesResponse {
  samples: SamplePatient[];
}

// §5 POST /api/predict
export interface PredictRequest {
  features: Record<string, FeatureValue>;
}

export interface TargetPrediction {
  probability: number;
  predicted: boolean;
  risk_level: RiskLevel;
}

export interface Contribution {
  feature: string;
  value: FeatureValue;
  shap: number;
  relative: number;
  direction: "raises" | "lowers" | "neutral";
  percentile: number | null;
}

export interface Explanation {
  model_type: ModelType;
  shap_units: ShapUnits;
  base_value: number;
  output_value: number;
  contributions: Contribution[];
  summary: string;
}

export interface PredictResponse {
  model_version: string;
  predictions: Record<TargetId, TargetPrediction>;
  agreement: { consistent: boolean; message: string | null };
  explanations: Record<TargetId, Explanation>;
}

// §6 GET /api/metrics
export interface Stat {
  mean: number;
  std: number;
}

export interface MetricSet {
  accuracy: Stat;
  precision: Stat;
  recall: Stat;
  specificity: Stat;
  f1: Stat;
  roc_auc: Stat;
  average_precision: Stat;
  brier: Stat;
}

export interface TargetMetrics {
  n_positive: number;
  n_negative: number;
  prevalence: number;
  selected_model: ModelType;
  selection_reason: string;
  candidates: Record<ModelType | "baseline_prior", MetricSet>;
  global_importance: { feature: string; share: number }[];
  plots: { roc: string; calibration: string; confusion: string };
}

export interface MetricsResponse {
  model_version: string;
  validation: {
    scheme: "repeated_stratified_kfold";
    n_splits: number;
    n_repeats: number;
    seed: number;
    n_rows: number;
    decision_threshold: number;
    preprocessing_inside_folds: boolean;
    excluded_columns: string[];
    holdout_note: string;
  };
  targets: Record<TargetId, TargetMetrics>;
}
