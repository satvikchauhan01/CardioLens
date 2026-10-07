// A small, valid slice of the API for tests: nine inputs covering every feature type and group.

import type {
  Contribution,
  FeatureSchema,
  FeatureValue,
  MetaResponse,
  MetricSet,
  MetricsResponse,
  ModelType,
  PredictResponse,
  SamplePatient,
  TargetId,
  TargetMetrics,
  TargetPrediction,
} from "../api/types";

function feature(partial: Partial<FeatureSchema> & Pick<FeatureSchema, "id" | "label" | "group" | "type" | "default">): FeatureSchema {
  return {
    source_column: partial.label,
    description: null,
    unit: null,
    integer: false,
    min: null,
    max: null,
    step: null,
    categories: null,
    ...partial,
  };
}

export const FEATURES: FeatureSchema[] = [
  feature({ id: "age", label: "Age", group: "demographic_history", type: "numeric", unit: "years", integer: true, min: 30, max: 86, step: 1, default: 58 }),
  feature({ id: "sex", label: "Sex", group: "demographic_history", type: "categorical", categories: ["Male", "Female"], default: "Male" }),
  feature({ id: "bmi", label: "Body mass index", group: "demographic_history", type: "numeric", unit: "kg/m²", min: 18.115412710007302, max: 40.90065778377467, step: 0.1, default: 26.775510204081634 }),
  feature({ id: "dm", label: "Diabetes mellitus", group: "demographic_history", type: "binary", default: false }),
  feature({ id: "typical_chest_pain", label: "Typical chest pain", group: "symptoms_exam", type: "binary", default: true }),
  feature({ id: "bbb", label: "Bundle branch block", group: "ecg", type: "categorical", categories: ["None", "LBBB", "RBBB"], default: "None" }),
  feature({ id: "cr", label: "Creatinine", group: "laboratory", type: "numeric", unit: "mg/dL", min: 0.5, max: 2.2, step: 0.05, default: 1 }),
  feature({ id: "ef_tte", label: "Ejection fraction", group: "echo", type: "numeric", unit: "%", integer: true, min: 15, max: 60, step: 1, default: 50 }),
  feature({ id: "vhd", label: "Valvular heart disease", group: "echo", type: "ordinal", categories: ["None", "Mild", "Moderate", "Severe"], default: "Mild" }),
];

export const META: MetaResponse = {
  model_version: "20261007T1423Z-7393432",
  trained_at: "2026-10-07T14:23:00Z",
  dataset: {
    name: "extention of Z-Alizadeh sani dataset",
    citation: "Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013).",
    license: "CC BY 4.0",
    url: "https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset",
    n_total: 303,
    n_train: 297,
    n_holdout: 6,
  },
  targets: [
    { id: "cad", label: "Coronary artery disease", short_label: "CAD", kind: "overall", description: "At least one major coronary artery with ≥50% narrowing (dataset definition)", model_type: "logistic_regression", shap_units: "log_odds" },
    { id: "lad", label: "Left Anterior Descending", short_label: "LAD", kind: "vessel", description: "Supplies the front of the heart", model_type: "random_forest", shap_units: "probability" },
    { id: "lcx", label: "Left Circumflex", short_label: "LCX", kind: "vessel", description: "Supplies the side and back of the heart", model_type: "random_forest", shap_units: "probability" },
    { id: "rca", label: "Right Coronary Artery", short_label: "RCA", kind: "vessel", description: "Supplies the right side and bottom of the heart", model_type: "logistic_regression", shap_units: "log_odds" },
  ],
  feature_groups: [
    { id: "demographic_history", label: "Demographics & history" },
    { id: "symptoms_exam", label: "Symptoms & examination" },
    { id: "ecg", label: "ECG findings" },
    { id: "laboratory", label: "Laboratory" },
    { id: "echo", label: "Echocardiography" },
  ],
  features: FEATURES,
  quick_controls: ["typical_chest_pain", "age", "sex", "ef_tte"],
  decision_threshold: 0.5,
  risk_levels: [
    { id: "low", label: "Low", min: 0, max: 0.35 },
    { id: "moderate", label: "Moderate", min: 0.35, max: 0.65 },
    { id: "high", label: "High", min: 0.65, max: 1 },
  ],
  excluded_columns: ["LAD", "LCX", "RCA", "Cath"],
  dropped_features: [{ source_column: "Exertional CP", reason: "zero variance" }],
};

const VALUES_A: Record<string, FeatureValue> = {
  age: 60, sex: "Male", bmi: 29.387755102040817, dm: true, typical_chest_pain: true,
  bbb: "None", cr: 1.15, ef_tte: 55, vhd: "Mild",
};

export const SAMPLES: SamplePatient[] = [
  {
    id: "sample-a", title: "Sample A", subtitle: "60 y · Male", features: VALUES_A,
    ground_truth: { cad: 1, lad: 1, lcx: 1, rca: 1 },
    note: "Held out — not used for training or validation.",
  },
  {
    id: "sample-b", title: "Sample B", subtitle: "71 y · Female",
    features: { ...VALUES_A, age: 71, sex: "Female", dm: false, ef_tte: 40 },
    ground_truth: { cad: 1, lad: 0, lcx: 1, rca: 0 },
    note: "Held out — not used for training or validation.",
  },
];

export function prediction(probability: number): TargetPrediction {
  return {
    probability,
    predicted: probability >= 0.5,
    risk_level: probability < 0.35 ? "low" : probability < 0.65 ? "moderate" : "high",
  };
}

/** Contributions for every fixture input, largest first; `first` names the top one. */
function contributions(values: Record<string, FeatureValue>, first: string): Contribution[] {
  const relatives = [0.4, -0.25, 0.15, 0.1, -0.05, 0.03, 0.016, -0.004, 0];
  const ids = [first, ...FEATURES.map((f) => f.id).filter((id) => id !== first)];
  return ids.map((id, index) => {
    const relative = relatives[index];
    return {
      feature: id,
      value: values[id],
      shap: relative / 2,
      relative,
      direction: relative > 0 ? "raises" : relative < 0 ? "lowers" : "neutral",
      percentile: typeof values[id] === "number" ? 81 - index : null,
    };
  });
}

const TOP_FEATURE: Record<TargetId, string> = { cad: "typical_chest_pain", lad: "ef_tte", lcx: "cr", rca: "dm" };

/** A complete predict response; the probabilities default to a consistent, mixed-level case. */
export function predictResponse(
  values: Record<string, FeatureValue> = VALUES_A,
  probabilities: Partial<Record<TargetId, number>> = {},
): PredictResponse {
  const p: Record<TargetId, number> = { cad: 0.8123, lad: 0.581, lcx: 0.2207, rca: 0.4402, ...probabilities };
  const targets: TargetId[] = ["cad", "lad", "lcx", "rca"];
  const predictions = Object.fromEntries(targets.map((t) => [t, prediction(p[t])])) as PredictResponse["predictions"];
  const cad = predictions.cad.predicted;
  const anyVessel = targets.slice(1).some((t) => predictions[t].predicted);
  return {
    model_version: META.model_version,
    predictions,
    agreement:
      cad === anyVessel
        ? { consistent: true, message: null }
        : {
            consistent: false,
            message: `The overall CAD model and the three vessel models are trained separately, so they can disagree. Here, ${
              cad ? "CAD is predicted but no single vessel reaches 50%" : "a vessel reaches 50% but overall CAD is not predicted"
            }.`,
          },
    explanations: Object.fromEntries(
      targets.map((t) => [
        t,
        {
          model_type: META.targets.find((target) => target.id === t)!.model_type,
          shap_units: META.targets.find((target) => target.id === t)!.shap_units,
          base_value: 0.4,
          output_value: 0.6,
          contributions: contributions(values, TOP_FEATURE[t]),
          summary: `Summary for ${t}.`,
        },
      ]),
    ) as PredictResponse["explanations"],
  };
}

function metricSet(rocAuc: number): MetricSet {
  const stat = (mean: number) => ({ mean, std: 0.031 });
  return {
    accuracy: stat(rocAuc - 0.06), precision: stat(rocAuc - 0.02), recall: stat(rocAuc - 0.03),
    specificity: stat(rocAuc - 0.15), f1: stat(rocAuc - 0.02), roc_auc: stat(rocAuc),
    average_precision: stat(rocAuc + 0.04), brier: stat(1 - rocAuc),
  };
}

function targetMetrics(target: TargetId, selected: ModelType, rocAuc: number, positives: number): TargetMetrics {
  return {
    n_positive: positives,
    n_negative: 297 - positives,
    prevalence: Number((positives / 297).toFixed(4)),
    selected_model: selected,
    selection_reason: selected === "logistic_regression" ? "Within 0.01 of best; simplest model preferred" : "Highest mean ROC-AUC",
    candidates: {
      logistic_regression: metricSet(selected === "logistic_regression" ? rocAuc : rocAuc - 0.02),
      random_forest: metricSet(selected === "random_forest" ? rocAuc : rocAuc - 0.01),
      gradient_boosting: metricSet(rocAuc - 0.03),
      baseline_prior: { ...metricSet(0.5), roc_auc: { mean: 0.5, std: 0 } },
    },
    global_importance: [
      { feature: "typical_chest_pain", share: 0.151 },
      { feature: "ef_tte", share: 0.086 },
      { feature: "age", share: 0.069 },
    ],
    plots: {
      roc: `/static/plots/${target}_roc.png`,
      calibration: `/static/plots/${target}_calibration.png`,
      confusion: `/static/plots/${target}_confusion.png`,
    },
  };
}

export const METRICS: MetricsResponse = {
  model_version: META.model_version,
  validation: {
    scheme: "repeated_stratified_kfold",
    n_splits: 5,
    n_repeats: 5,
    seed: 42,
    n_rows: 297,
    decision_threshold: 0.5,
    preprocessing_inside_folds: true,
    excluded_columns: ["LAD", "LCX", "RCA", "Cath"],
    holdout_note: "6 sample patients were held out by a fixed rule (seed 42) before any training; they are not used for cross-validation or the final fit.",
  },
  targets: {
    cad: targetMetrics("cad", "logistic_regression", 0.917, 212),
    lad: targetMetrics("lad", "random_forest", 0.855, 174),
    lcx: targetMetrics("lcx", "random_forest", 0.739, 116),
    rca: targetMetrics("rca", "logistic_regression", 0.725, 113),
  },
};

/** A JSON Response as fetch would return it. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
