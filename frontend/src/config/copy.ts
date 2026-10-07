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
export const FOOTER_NOTE = "Educational prototype";
export const MODEL_VERSION_LABEL = "Model version";

export const VIEW_NOT_BUILT = "This view has not been built yet.";

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

// Patient input (F1, F2)
export const PATIENT_HEADING = "Patient";
export const SAMPLES_LABEL = "Sample patients";
export const TYPICAL_VALUES = "Start from typical values";
export const TYPICAL_NOTE = "Typical values: the training median or most common value of every input.";
export const ALL_INPUTS_HEADING = "All clinical inputs";
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

// 3D viewer (F5), built in Phase 6
export const VIEWER_HEADING = "3D heart";
export const VIEWER_NOT_BUILT = "The interactive heart viewer has not been built yet.";
