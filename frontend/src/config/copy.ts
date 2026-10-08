// User-facing copy. The safety text is exact (PRODUCT_SPEC §9): change it only together with the spec.

import type { ModelType } from "../api/types";

export const APP_NAME = "CardioLens";
export const TAGLINE = "Coronary risk estimates, mapped to the vessels they describe.";

export const DISCLAIMER_BANNER =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

export const TABS = [
  { id: "analysis", label: "Patient analysis" },
  { id: "method", label: "Model & method" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const FOOTER_DATASET =
  "Dataset: “extention of Z-Alizadeh sani dataset”, Alizadehsani, Roshanzamir & Sani (2013), UCI Machine Learning Repository, CC BY 4.0.";
// Short form of CREDIT_HEART below; the licence is added to both when it is supplied.
export const FOOTER_HEART = "3D heart: BodyParts3D.";
export const FOOTER_NOTE = "Educational prototype";
export const MODEL_VERSION_LABEL = "Model version";

// Boot (PRODUCT_SPEC §6.1)
export const BOOT_LOADING = "Loading the model service…";
export const BOOT_ERROR_TITLE = "Can't reach the CardioLens model service.";
export const BOOT_NOT_READY_PREFIX = "Model service not ready:";
export const BOOT_START_HINT = "Start the backend from the project folder, then retry:";
export const BOOT_START_COMMANDS = [
  "cd backend",
  ".\\.venv\\Scripts\\Activate.ps1",
  "uvicorn app.main:app --port 8000",
];
export const RETRY = "Retry";

// An unexpected error while drawing a view (AppErrorBoundary)
export const CRASH_TITLE = "Something went wrong on this page.";
export const CRASH_TEXT = "Reload the page to start again. Nothing you entered was saved.";
export const RELOAD = "Reload the page";

// Patient input (F1, F2)
export const PATIENT_HEADING = "Patient";
export const SAMPLES_LABEL = "Sample patients";
export const TYPICAL_VALUES = "Start from typical values";
export const TYPICAL_NOTE = "Typical values: the training median or most common value of every input.";
export const ALL_INPUTS_HEADING = "All clinical inputs";

// What-if explorer (F7, BR-9, BR-10)
export const QUICK_CONTROLS_HEADING = "Quick what-if controls";
export const QUICK_CONTROLS_HINT = "The inputs that matter most to the four models, on average.";
// PRODUCT_SPEC §9.5, exact.
export const WHAT_IF_NOTE =
  "What-if shows how the model's estimate responds to changed inputs. It does not predict the effect of treatment.";
export const RESET_TO_ORIGINAL = "Reset to original";
export const modifiedLabel = (count: number) => `Modified (${count} ${count === 1 ? "field" : "fields"})`;
export const IDLE_HINT = "Choose a sample patient or start from typical values";
export const YES = "Yes";
export const NO = "No";

// Results (F4, BR-3, BR-4)
export const RESULTS_HEADING = "Model estimates";
export const CAD_CAPTION = "Model estimate — not a diagnosis.";
export const RISK_LEVEL_CAPTION = "Model-estimated probability, not a clinical risk category.";
export const STATUS_TEXT = {
  overall: { predicted: "CAD predicted", notPredicted: "CAD not predicted" },
  vessel: { predicted: "Stenosis predicted", notPredicted: "Stenosis not predicted" },
} as const;
export const VESSELS_LABEL = "Coronary arteries";
export const UPDATING = "Updating…";
export const OUT_OF_DATE = "Out of date";
export const OUT_OF_DATE_INVALID = "Out of date — fix highlighted fields";
export const FIX_FIELDS_HINT = "Fix the highlighted fields to see the estimates.";
export const PREDICT_ERROR_TITLE = "The estimates could not be updated.";

// Ground-truth reveal (F8, BR-11)
export const GROUND_TRUTH_TOGGLE = "Show dataset angiography result";
export const GROUND_TRUTH_LABEL = "Dataset label";
// The label values as the dataset writes them (DATA_MODEL §4).
export const DATASET_LABELS = {
  overall: { 1: "CAD", 0: "Normal" },
  vessel: { 1: "Stenotic", 0: "Normal" },
} as const;
export const GROUND_TRUTH_MATCH = "matches the model's prediction";
export const GROUND_TRUTH_MISMATCH = "differs from the model's prediction";
export const GROUND_TRUTH_NOTE =
  "This sample patient was held out from training and validation. The dataset label is what angiography recorded.";
export const GROUND_TRUTH_ONLY_SAMPLES = "Only sample patients have a dataset label to compare with.";
export const GROUND_TRUTH_MODIFIED =
  "Hidden while inputs are modified: the dataset label belongs to the original patient. Use “Reset to original” to compare again.";
export const groundTruthSummary = (matches: number, total: number) =>
  `The model's prediction matches the dataset label for ${matches} of ${total} targets.`;

// Explanation (F6, BR-7)
export const EXPLANATION_HEADING = "Why this estimate";
export const EXPLANATION_METHOD = "SHAP contributions";
export const EXPLANATION_LEGEND =
  "Bars to the right raised this estimate, bars to the left lowered it. Each percentage is that input's share of the total contribution.";
export const RAISES = "raises the estimate";
export const LOWERS = "lowers the estimate";
export const NEUTRAL = "no effect on the estimate";
export const PERCENTILE_HINT = "Share of training patients with a value at or below this one.";

export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  logistic_regression: "Logistic regression",
  random_forest: "Random forest",
  gradient_boosting: "Gradient boosting",
};

// Model & method tab (F9, PRODUCT_SPEC §4.3)
export const BASELINE_LABEL = "Baseline (class prior)";
export const METRICS_LOADING = "Loading the evaluation results…";
export const METRICS_ERROR_TITLE = "The evaluation results could not be loaded.";
export const METHOD_HEADING = "Method";
export const OVERVIEW_HEADING = "Selected models";
export const OVERVIEW_CAPTION =
  "Cross-validated results of the model selected for each target: mean ± standard deviation over the folds, at the decision threshold.";
export const DETAIL_HEADING = "Results by target";
export const CANDIDATES_CAPTION =
  "Every candidate and the baseline for this target: mean ± standard deviation over the folds.";
export const PLOTS_HEADING = "Out-of-fold plots";
export const IMPORTANCE_HEADING = "Global feature importance";
export const IMPORTANCE_CAPTION = "Top 10 inputs by their share of the mean absolute SHAP value on the training rows.";
export const SELECTION_RULE =
  "The candidate with the highest mean ROC-AUC is selected; logistic regression is preferred when it is within 0.01 of the best. No hyperparameters are tuned.";
export const LIMITATIONS_HEADING = "Limitations";
// PRODUCT_SPEC §9.4, exact.
export const LIMITATIONS = [
  "Trained on 303 patients from one public research dataset; performance on other populations is unknown.",
  "Inputs are recorded clinical findings, not raw ECG, echo or imaging data.",
  "Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.",
  "Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).",
  "What-if changes show model sensitivity, not the effect of any treatment.",
];
export const CREDITS_HEADING = "Credits";
// The source is named; its licence line and full credit are still to be supplied (BUILD_MAP T6.1).
export const CREDIT_HEART =
  "3D heart and coronary arteries: built from the BodyParts3D anatomy parts. Full credit and licence to be added.";
export const CREDIT_LIBRARIES =
  "Built with scikit-learn, SHAP, FastAPI, React, three.js and React Three Fiber.";

export const METRIC_LABELS = {
  roc_auc: "ROC-AUC",
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  specificity: "Specificity",
  f1: "F1",
  average_precision: "Average precision",
  brier: "Brier score",
} as const;

// 3D viewer (F5, F10, F11)
export const VIEWER_HEADING = "3D heart";
export const VIEWER_LOADING = "Loading the 3D viewer…";
export const VIEWER_HINT = "Drag to rotate · scroll to zoom · click an artery for its explanation";
export const LABELS_TOGGLE = "Labels";
export const NO_ESTIMATE = "no estimate";
export const LEGEND_TITLE = "Estimated probability of ≥50% narrowing";
export const LEGEND_NO_ESTIMATE = "No estimate";
// PRODUCT_SPEC §9.3, exact.
export const LEGEND_NOTE =
  "Color shows each artery's model-estimated probability of ≥50% narrowing. It does not show where along the artery a narrowing might be.";
export const STAND_IN_NOTE =
  "The heart is a stylised shape and the artery courses are schematic, not patient anatomy.";
export const MODEL_NOTE =
  "The heart is a reference anatomy model, not this patient's heart. Only the three main arteries take a colour; their branches and the left main stem stay grey.";
export const MODEL_UNAVAILABLE_NOTICE = "Detailed heart model unavailable";
export const SCHEMATIC_NOTICE =
  "3D graphics are not available in this browser, so the arteries are shown as a flat front view. Dashed parts run behind the heart.";
export const RESET_DEMO = "Reset demo";
