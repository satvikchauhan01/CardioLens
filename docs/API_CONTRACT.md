# API Contract

**Status:** v0.1 — approved by Satvik (T0.2) · **Date:** 2026-10-07
**Base URL:** `/api` (dev: Vite proxies `/api` and `/static` to `http://localhost:8000`)
**Format:** JSON, UTF-8. Snake_case keys. Probabilities are floats in [0, 1] rounded to 4 decimals.

> All example values below are **illustrative placeholders for format only** — they are not model results.
> Changing anything in this file after approval requires asking Satvik first (CLAUDE_RULES §12).

---

## 1. Shared types

```ts
type TargetId = "cad" | "lad" | "lcx" | "rca";
type ModelType = "logistic_regression" | "random_forest" | "gradient_boosting";
type RiskLevel = "low" | "moderate" | "high";
type FeatureValue = number | boolean | string;
type FeatureType = "numeric" | "binary" | "categorical" | "ordinal";
type FeatureGroupId = "demographic_history" | "symptoms_exam" | "ecg" | "laboratory" | "echo";

interface ErrorResponse {
  error: {
    code: "VALIDATION_ERROR" | "PAYLOAD_TOO_LARGE" | "NOT_FOUND" | "MODEL_UNAVAILABLE" | "INTERNAL_ERROR";
    message: string;          // human-readable, safe to show
    details?: FieldError[];   // only for VALIDATION_ERROR
  };
}

interface FieldError {
  field: string;              // feature id, or "features" for body-level problems
  issue: "missing" | "unknown_field" | "wrong_type" | "not_finite" | "not_integer" | "out_of_range" | "not_allowed";
  message: string;            // e.g. "Must be between 30 and 86 (range seen in the dataset)."
}
```

**Status codes:** 200 OK · 404 `NOT_FOUND` · 413 `PAYLOAD_TOO_LARGE` (body > 16 KB) · 422 `VALIDATION_ERROR` · 500 `INTERNAL_ERROR` (no stack traces) · 503 `MODEL_UNAVAILABLE` (artifacts missing or incompatible).

FastAPI's default validation response is replaced by this envelope via a custom exception handler.

---

## 2. `GET /api/health`

Liveness + readiness. Not wrapped in the error envelope.

**200**
```json
{ "status": "ok", "models_loaded": true, "model_version": "20261009T1030Z-3f2a9c1" }
```
**503**
```json
{ "status": "unavailable", "models_loaded": false, "model_version": null,
  "reason": "Artifacts not found in backend/artifacts. Run: python -m ml.train" }
```

---

## 3. `GET /api/meta`

Everything the frontend needs to build the form, registry checks, legend and labels.

```ts
interface MetaResponse {
  model_version: string;
  trained_at: string;                       // ISO 8601 UTC
  dataset: {
    name: string;                           // "extention of Z-Alizadeh sani dataset" (UCI spelling)
    citation: string;                       // full citation incl. DOI 10.24432/C5461K
    license: string;                        // "CC BY 4.0"
    url: string;                            // UCI dataset page
    n_total: number;                        // rows in file
    n_train: number;                        // rows used for CV + final fit
    n_holdout: number;                      // held-out sample patients
  };
  targets: TargetInfo[];                    // order: cad, lad, lcx, rca
  feature_groups: { id: FeatureGroupId; label: string }[];
  features: FeatureSchema[];                // order = display order within groups
  quick_controls: string[];                 // 8 feature ids, ordered (BR-9)
  decision_threshold: number;               // 0.5
  risk_levels: { id: RiskLevel; label: string; min: number; max: number }[]; // [min, max); last max = 1.0 inclusive
  excluded_columns: string[];               // ["LAD", "LCX", "RCA", "Cath"]
  dropped_features: { source_column: string; reason: string }[];            // e.g. zero variance
}

interface TargetInfo {
  id: TargetId;
  label: string;                            // "Left Anterior Descending"
  short_label: string;                      // "LAD"
  kind: "overall" | "vessel";
  description: string;                      // from problem statement, e.g. "Supplies the front of the heart"
  model_type: ModelType;                    // selected model for this target
  shap_units: "log_odds" | "probability";
}

interface FeatureSchema {
  id: string;                               // snake_case, e.g. "typical_chest_pain"
  source_column: string;                    // exact dataset column, e.g. "Typical Chest Pain"
  label: string;                            // display label
  description: string | null;               // short plain-language description
  group: FeatureGroupId;
  type: FeatureType;
  unit: string | null;                      // only when confirmed from dataset documentation
  integer: boolean;                         // numeric only
  min: number | null;                       // numeric only: dataset minimum (inputs of all rows, D-018)
  max: number | null;                       // numeric only: dataset maximum (inputs of all rows, D-018)
  step: number | null;                      // numeric only: UI step
  categories: string[] | null;              // categorical/ordinal only; ordinal lists are ordered low → high
  default: FeatureValue;                    // training median (numeric) or mode (others)
}
```

**200 (abridged example)**
```json
{
  "model_version": "20261009T1030Z-3f2a9c1",
  "trained_at": "2026-10-09T10:30:00Z",
  "dataset": { "name": "extention of Z-Alizadeh sani dataset", "citation": "Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K.", "license": "CC BY 4.0", "url": "https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset", "n_total": 303, "n_train": 297, "n_holdout": 6 },
  "targets": [
    { "id": "cad", "label": "Coronary artery disease", "short_label": "CAD", "kind": "overall", "description": "At least one major coronary artery with ≥50% narrowing (dataset definition)", "model_type": "logistic_regression", "shap_units": "log_odds" },
    { "id": "lad", "label": "Left Anterior Descending", "short_label": "LAD", "kind": "vessel", "description": "Supplies the front of the heart", "model_type": "random_forest", "shap_units": "probability" }
  ],
  "feature_groups": [ { "id": "demographic_history", "label": "Demographics & history" } ],
  "features": [
    { "id": "age", "source_column": "Age", "label": "Age", "description": null, "group": "demographic_history", "type": "numeric", "unit": "years", "integer": true, "min": 30, "max": 86, "step": 1, "categories": null, "default": 58 },
    { "id": "bbb", "source_column": "BBB", "label": "Bundle branch block", "description": null, "group": "ecg", "type": "categorical", "unit": null, "integer": false, "min": null, "max": null, "step": null, "categories": ["None", "LBBB", "RBBB"], "default": "None" }
  ],
  "quick_controls": ["typical_chest_pain", "age", "region_rwma", "ef_tte", "bp", "fbs", "dm", "htn"],
  "decision_threshold": 0.5,
  "risk_levels": [ { "id": "low", "label": "Low", "min": 0.0, "max": 0.35 }, { "id": "moderate", "label": "Moderate", "min": 0.35, "max": 0.65 }, { "id": "high", "label": "High", "min": 0.65, "max": 1.0 } ],
  "excluded_columns": ["LAD", "LCX", "RCA", "Cath"],
  "dropped_features": []
}
```

---

## 4. `GET /api/samples`

The held-out sample patients (never used for training or CV).

```ts
interface SamplesResponse { samples: SamplePatient[] }   // ordered A → F; A is the default

interface SamplePatient {
  id: string;                               // "sample-a" … "sample-f"
  title: string;                            // "Sample A"
  subtitle: string;                         // "61 y · Male"
  features: Record<string, FeatureValue>;   // complete, canonical values (valid for POST /api/predict)
  ground_truth: Record<TargetId, 0 | 1>;    // dataset labels; shown only via F8
  note: string;                             // "Held out — not used for training or validation."
}
```

---

## 5. `POST /api/predict`

**Request**
```ts
interface PredictRequest {
  features: Record<string, FeatureValue>;   // exactly the schema's feature ids, all required
}
```
Validation (BR-13): missing → `missing`; extra key → `unknown_field`; wrong JSON type → `wrong_type`; NaN/Infinity → `not_finite`; non-integer for integer feature → `not_integer`; outside training [min, max] → `out_of_range`; category not in list → `not_allowed`. All problems are reported together in `details`.

**Response 200**
```ts
interface PredictResponse {
  model_version: string;
  predictions: Record<TargetId, TargetPrediction>;
  agreement: { consistent: boolean; message: string | null };   // BR-6; message null when consistent
  explanations: Record<TargetId, Explanation>;
}

interface TargetPrediction {
  probability: number;                      // P(positive)
  predicted: boolean;                       // probability >= decision_threshold (BR-3)
  risk_level: RiskLevel;                    // BR-4
}

interface Explanation {
  model_type: ModelType;
  shap_units: "log_odds" | "probability";
  base_value: number;                       // expected model output over training data, in shap_units
  output_value: number;                     // base_value + Σ shap, in shap_units
  contributions: Contribution[];            // one per input feature, sorted by |shap| desc
  summary: string;                          // BR-8 template text
}

interface Contribution {
  feature: string;                          // feature id
  value: FeatureValue;                      // the input value used
  shap: number;                             // grouped SHAP value, in shap_units
  relative: number;                         // shap / Σ|shap|, in [-1, 1] (BR-7)
  direction: "raises" | "lowers" | "neutral";
  percentile: number | null;                // numeric features only, 0–100 integer
}
```

**200 (abridged example — illustrative values only)**
```json
{
  "model_version": "20261009T1030Z-3f2a9c1",
  "predictions": {
    "cad": { "probability": 0.8123, "predicted": true,  "risk_level": "high" },
    "lad": { "probability": 0.5810, "predicted": true,  "risk_level": "moderate" },
    "lcx": { "probability": 0.2207, "predicted": false, "risk_level": "low" },
    "rca": { "probability": 0.4402, "predicted": false, "risk_level": "moderate" }
  },
  "agreement": { "consistent": true, "message": null },
  "explanations": {
    "lad": {
      "model_type": "random_forest",
      "shap_units": "probability",
      "base_value": 0.43,
      "output_value": 0.581,
      "contributions": [
        { "feature": "typical_chest_pain", "value": true, "shap": 0.071, "relative": 0.24, "direction": "raises", "percentile": null },
        { "feature": "age", "value": 67, "shap": 0.032, "relative": 0.11, "direction": "raises", "percentile": 81 },
        { "feature": "ef_tte", "value": 55, "shap": -0.018, "relative": -0.06, "direction": "lowers", "percentile": 52 }
      ],
      "summary": "Factors that most increased this estimate: typical chest pain (yes), age (67 years), region with RWMA (2). Factor that most decreased it: ejection fraction (55%)."
    }
  }
}
```
(Real responses contain all four targets in `explanations` and every feature in `contributions`.)

**Errors:** 413, 422 (with `details`), 500, 503.

**422 example**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "2 inputs need attention.",
  "details": [
    { "field": "age", "issue": "out_of_range", "message": "Must be between 30 and 86 (range seen in the dataset)." },
    { "field": "bbb", "issue": "not_allowed", "message": "Must be one of: None, LBBB, RBBB." }
  ] } }
```

---

## 6. `GET /api/metrics`

```ts
interface MetricsResponse {
  model_version: string;
  validation: {
    scheme: "repeated_stratified_kfold";
    n_splits: 5;
    n_repeats: 5;
    seed: 42;
    n_rows: number;                         // training rows (held-out samples excluded)
    decision_threshold: number;             // 0.5
    preprocessing_inside_folds: true;
    excluded_columns: string[];             // leakage guard
    holdout_note: string;
  };
  targets: Record<TargetId, TargetMetrics>;
}

interface TargetMetrics {
  n_positive: number;
  n_negative: number;
  prevalence: number;
  selected_model: ModelType;
  selection_reason: string;                 // e.g. "Highest mean ROC-AUC" or "Within 0.01 of best; simplest model preferred"
  candidates: Record<ModelType | "baseline_prior", MetricSet>;
  global_importance: { feature: string; share: number }[];   // top 10, share of mean |SHAP|, sums ≤ 1
  plots: { roc: string; calibration: string; confusion: string };   // e.g. "/static/plots/lad_roc.png"
}

interface MetricSet {
  accuracy: Stat; precision: Stat; recall: Stat; specificity: Stat; f1: Stat;
  roc_auc: Stat; average_precision: Stat; brier: Stat;
}
interface Stat { mean: number; std: number }   // across 25 folds
```

---

## 7. `GET /static/plots/{file}.png`

PNG files generated at training time: `{target}_roc.png`, `{target}_calibration.png`, `{target}_confusion.png`. 404 if missing.

---

## 8. Cross-cutting rules

- CORS: allowlist `ALLOWED_ORIGINS`; methods GET, POST; no credentials.
- Request bodies are never logged (BR-12).
- Responses are deterministic for a given `model_version` and input.
- The frontend's `src/api/types.ts` must mirror this file exactly; a change here means a change there in the same commit.
