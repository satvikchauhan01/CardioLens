// User-facing copy. The safety text is exact (PRODUCT_SPEC §9): change it only together with the spec.

import type { ModelType } from "../api/types";

export const APP_NAME = "CardioLens";
export const TAGLINE = "Coronary risk estimates, mapped to the vessels they describe.";

export const DISCLAIMER_BANNER =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

// The five pages (PRODUCT_SPEC §4). The app opens on Home; the first sample patient is analysed
// in the background, so the Analysis page is ready when it is opened.
export const TABS = [
  { id: "home", label: "Home" },
  { id: "patients", label: "Patients" },
  { id: "new", label: "New patient" },
  { id: "analysis", label: "Analysis" },
  { id: "method", label: "Model & method" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
export const DEFAULT_TAB: TabId = "home";

// Header controls
export const THEME_TO_DARK = "Switch to the dark theme";
export const THEME_TO_LIGHT = "Switch to the light theme";
export const TOUR_START = "Take the tour";

// Home page: what the app is and the ways into it. Every number comes from the model service.
export const HOME_EYEBROW = "Educational decision-support prototype";
export const HOME_TITLE = "See which coronary artery a model is concerned about, and why.";
export const HOME_TEXT =
  "CardioLens turns a patient's routine clinical findings into four model estimates, shows each one on the artery it belongs to, and explains it with the patient's own measurements.";
export const HOME_OPEN = "Open the analysis";
export const homeHeartCaption = (patient: string) =>
  `${patient}: each artery is coloured by its model estimate. Drag to turn the heart.`;
export const HOME_HEART_WAITING = "The first estimates are on their way.";
export const HOME_STATS_LABEL = "CardioLens in numbers";
export const homeStats = (counts: { models: number; inputs: number; samples: number; patients: number }) => [
  { icon: "models", value: counts.models, label: "models", note: "Coronary artery disease overall, and one for each of the three arteries." },
  { icon: "inputs", value: counts.inputs, label: "clinical inputs", note: "History, symptoms, ECG, laboratory and echocardiography findings." },
  { icon: "shield", value: counts.samples, label: "sample patients", note: "Set aside before training, so the models have never seen them." },
  { icon: "database", value: counts.patients, label: "patients in the dataset", note: "A small public research dataset with angiography labels." },
] as const;
export const HOME_WAYS_HEADING = "Where to start";
export const homeWays = (counts: { samples: number; withCad: number; without: number; inputs: number }) => [
  {
    tab: "patients",
    icon: "patients",
    title: "Explore the sample patients",
    text: `${counts.samples} patients from the dataset: ${counts.withCad} with the dataset label CAD and ${counts.without} with Normal. See what the models estimate for each.`,
  },
  {
    tab: "new",
    icon: "new",
    title: "Enter a patient of your own",
    text: `All ${counts.inputs} inputs, starting from typical values. Analyse it, then change a value and watch the estimates respond.`,
  },
  {
    tab: "method",
    icon: "method",
    title: "See how it was validated",
    text: "Cross-validated results of every candidate model and a baseline, the plots, and the limitations.",
  },
] as const;
export const HOME_STEPS_HEADING = "How it works";
export const HOME_STEPS = [
  { title: "Choose a patient", text: "A sample patient from the dataset, or values of your own." },
  { title: "Read the heart", text: "Each artery takes the colour of its estimated probability of a narrowing of 50% or more." },
  { title: "Ask why", text: "Select an artery to see which measurements raised or lowered its estimate." },
  { title: "Try a what-if", text: "Change an input and see how the model's estimates respond." },
] as const;

// Guided tour of the Analysis page. `target` names the part of the page a step points at.
export const TOUR_STEPS = [
  {
    target: "patient",
    title: "The patient",
    text: "Every estimate on this page belongs to this patient. The buttons lead to the sample patients and to the form for a patient of your own.",
  },
  {
    target: "heart",
    title: "The heart carries the estimates",
    text: "Each coronary artery, with its branches, takes the colour of its estimated probability of a narrowing of 50% or more. Drag to turn the heart, scroll to zoom, click an artery to select it. The colour does not show where along the artery a narrowing might be.",
  },
  {
    target: "estimates",
    title: "Four estimates, four models",
    text: "Coronary artery disease overall, and each of the three arteries, each from its own model. The mark at 50% is the threshold from which a model predicts.",
  },
  {
    target: "explanation",
    title: "Why this estimate",
    text: "The measurements that raised or lowered the selected estimate, largest first, with the patient's value and where it lies among the training patients. Point at a row for details.",
  },
  {
    target: "whatif",
    title: "What if?",
    text: "Change one of the inputs that matter most to the models. The estimates, the colours and the explanation update together. This shows how the model responds, not the effect of a treatment.",
  },
  {
    target: "labels",
    title: "Compare with angiography",
    text: "For a sample patient, switch this on to see what angiography recorded next to each estimate, and where the model was wrong.",
  },
] as const;
export type TourTarget = (typeof TOUR_STEPS)[number]["target"];
export const TOUR_LABEL = "Guided tour";
export const TOUR_NEXT = "Next";
export const TOUR_BACK = "Back";
export const TOUR_SKIP = "Skip the tour";
export const TOUR_DONE = "Finish";
export const tourProgress = (step: number, total: number) => `Step ${step} of ${total}`;

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
// The same commands as the README's "Run the app"; only the activation line differs by system.
export const BOOT_START_COMMANDS = {
  windows: ["cd backend", ".\\.venv\\Scripts\\Activate.ps1", "uvicorn app.main:app --port 8000"],
  other: ["cd backend", "source .venv/bin/activate", "uvicorn app.main:app --port 8000"],
} as const;
export const RETRY = "Retry";

// An unexpected error while drawing a view (AppErrorBoundary)
export const CRASH_TITLE = "Something went wrong on this page.";
export const CRASH_TEXT = "Reload the page to start again. Nothing you entered was saved.";
export const RELOAD = "Reload the page";

// Patients page (F1): the held-out sample patients, by their dataset label
export const SAMPLES_HEADING = "Sample patients";
export const samplesIntro = (count: number) =>
  `${count} patients from the dataset that the models have never seen: they were set aside before training. Choose one to see what the models estimate for it.`;
export const SAMPLE_GROUPS = [
  {
    label: 1,
    heading: "Dataset label: CAD",
    note: "Angiography recorded a narrowing of 50% or more in at least one coronary artery.",
  },
  { label: 0, heading: "Dataset label: Normal", note: "Angiography recorded no such narrowing." },
] as const;
export const patientCount = (count: number) => `${count} ${count === 1 ? "patient" : "patients"}`;
export const SAMPLE_FILTER_LABEL = "Show";
export const SAMPLE_FILTER_ALL = "All";
// What the ring and the bars on a card are, and what the group is: an estimate is never a label.
export const ESTIMATES_CAPTION =
  "Ring and bars: the models' estimates for the patient. Group: what angiography recorded.";
export const ESTIMATES_LOADING = "Loading the models' estimates…";
export const ESTIMATES_ERROR = "The models' estimates could not be loaded. Every patient can still be opened.";
export const CARD_CAD_ESTIMATE = "CAD estimate";
export const ANALYSE = "Analyse";
export const IN_ANALYSIS = "In analysis";
export const OWN_PATIENT_PROMPT = "Not one of these? Enter a patient of your own.";

// New patient page (F2): a patient of the user's own
export const NEW_PATIENT = "New patient";
export const newPatientIntro = (count: number) =>
  `Enter the ${count} clinical inputs of a patient of your own. Every field starts from a typical value: the training median or most common value of that input.`;
export const START_FROM = "Start from";
export const TYPICAL_VALUES = "Typical values";
export const ANALYSE_OWN = "Analyse this patient";
export const fixFirst = (count: number) =>
  count === 1 ? "1 field needs attention before the patient can be analysed." : `${count} fields need attention before the patient can be analysed.`;
export const OWN_PATIENT = "Your patient";
export const OWN_PATIENT_NOTE = "Entered on the New patient page. It has no dataset label to compare with.";

// Analysis page: the patient on display and the inputs behind the estimates (F2)
export const PATIENT_HEADING = "Patient";
export const CHANGE_PATIENT = "Choose another patient";
export const ALL_INPUTS_HEADING = "All clinical inputs";

// What-if explorer (F7, BR-9, BR-10)
export const QUICK_CONTROLS_HEADING = "Quick what-if controls";
export const QUICK_CONTROLS_HINT = "The inputs that matter most to the four models, on average.";
// PRODUCT_SPEC §9.5, exact.
export const WHAT_IF_NOTE =
  "What-if shows how the model's estimate responds to changed inputs. It does not predict the effect of treatment.";
// BR-15: inputs that are set to a combination no patient in the dataset has (state/coherence.ts).
export const COHERENCE_TITLE = "Unusual combination";
export const COHERENCE_NOTE = "Estimates for such a combination go beyond the data the models were trained on.";
export const RESET_TO_ORIGINAL = "Reset to original";
export const modifiedLabel = (count: number) => `Modified (${count} ${count === 1 ? "field" : "fields"})`;
export const IDLE_HINT = "Choose a sample patient or enter a patient of your own";
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
// Details of one input's contribution, shown while its row is pointed at or focused.
export const EXPLANATION_DETAILS_HINT = "Point at an input, or focus it with the Tab key, for details.";
export const CONTRIBUTION_EFFECT = {
  raises: "Raised this estimate",
  lowers: "Lowered this estimate",
  neutral: "Did not move this estimate",
} as const;
export const SHAP_UNIT_LABELS = { log_odds: "log-odds", probability: "probability" } as const;
export const shareLine = (share: string) => `Share of the total contribution: ${share}`;
export const shapLine = (value: string, unit: string) => `SHAP value: ${value} (${unit})`;
export const percentileLine = (percentile: number) =>
  `${percentile}% of the training patients have a value at or below this one.`;
export const rangeLine = (low: string, high: string) => `Range seen in the dataset: ${low} to ${high}`;

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
export const AUTO_ROTATE = "Auto-rotate";
export const THRESHOLD_MARK = "50%";
export const NO_ESTIMATE = "no estimate";
export const LEGEND_TITLE = "Estimated probability of ≥50% narrowing";
export const LEGEND_NO_ESTIMATE = "No estimate";
// The rim colour names the artery and says nothing about risk; the colour inside is the estimate.
export const LEGEND_RIM_INTRO = "Rim colour names the artery:";
export const LEGEND_RIM_INSIDE = "The colour inside is its estimate.";
// PRODUCT_SPEC §9.3, exact.
export const LEGEND_NOTE =
  "Color shows each artery's model-estimated probability of ≥50% narrowing. It does not show where along the artery a narrowing might be.";
export const STAND_IN_NOTE =
  "The heart is a stylised shape and the artery courses are schematic, not patient anatomy.";
export const MODEL_NOTE =
  "The heart is a reference anatomy model, not this patient's heart, and its own colours carry no estimate. Each artery and its branches take the colour of that artery's estimate; the left main stem, which the LAD and the LCX share, stays grey.";
export const MODEL_UNAVAILABLE_NOTICE = "Detailed heart model unavailable";
export const SCHEMATIC_NOTICE =
  "3D graphics are not available in this browser, so the arteries are shown as a flat front view. Dashed parts run behind the heart.";
export const RESET_DEMO = "Reset demo";
