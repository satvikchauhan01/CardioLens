# Data Model

**Status:** v0.2 — approved by Satvik (T0.2); Python 3.13 per D-025 · **Date:** 2026-10-07

> Facts marked **(verified)** come from the UCI dataset page (checked 2026-10-07).
> Facts marked **(verify in T2.1)** are expectations from public descriptions of the dataset and must be confirmed against the actual file before any modeling. If the file differs, stop, report, and update this document with Satvik's approval.

There is **no database**. All data lives in one source file and in generated artifacts (§7). User inputs are never persisted.

---

## 1. Source dataset

| Property | Value |
|---|---|
| Name | "extention of Z-Alizadeh sani dataset" (UCI spelling), UCI id 411 **(verified)** |
| URL | https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset |
| File | `extention of Z-Alizadeh sani dataset.xlsx` inside the UCI zip download **(verified)** |
| Rows | 303 patients **(verified)** |
| Columns | 59 listed in the UCI variables table **(verified)** — expected 55 inputs + 4 labels **(verify in T2.1)** |
| Missing values | None, per UCI **(verified on the page; re-check in T2.1)** |
| Class definition | CAD if diameter narrowing ≥ 50%, otherwise Normal **(verified)** |
| Label note | CAD (last column, `Cath`) occurs when at least one of LAD, LCX, RCA is stenotic; for each classification only one of LAD/LCX/RCA/Cath may remain **(verified)** |
| License | CC BY 4.0 — sharing and adaptation allowed with credit **(verified)** |
| Citation | Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K **(verified)** |
| Class balance (CAD) | 216 CAD / 87 Normal as reported for the original dataset **(verify in T2.1)**; vessel prevalences unknown until T2.1 |

The file is stored at `backend/data/raw/` and committed with attribution (D-027).

## 2. Expected input columns (verify in T2.1)

Grouped for the UI. Group names combine the dataset's own grouping (demographic; symptom and examination; ECG; laboratory and echo) with the problem statement's wording.

| Group id | Label | Expected source columns |
|---|---|---|
| `demographic_history` | Demographics & history | Age, Weight, Length, Sex, BMI, DM, HTN, Current Smoker, EX-Smoker, FH, Obesity, CRF, CVA, Airway disease, Thyroid Disease, CHF, DLP |
| `symptoms_exam` | Symptoms & examination | BP, PR, Edema, Weak Peripheral Pulse, Lung rales, Systolic Murmur, Diastolic Murmur, Typical Chest Pain, Dyspnea, Function Class, Atypical, Nonanginal, Exertional CP, LowTH Ang |
| `ecg` | ECG findings | Q Wave, St Elevation, St Depression, Tinversion, LVH, Poor R Progression, BBB |
| `laboratory` | Laboratory | FBS, CR, TG, LDL, HDL, BUN, ESR, HB, K, Na, WBC, Lymph, Neut, PLT |
| `echo` | Echocardiography | EF-TTE, Region RWMA, VHD |

Expected count: 17 + 14 + 7 + 14 + 3 = **55 inputs**. Label columns: `Cath`, `LAD`, `LCX`, `RCA`.

Rules applied after inspection:
- Columns with a single unique value are dropped and listed in `dropped_features` with reason "zero variance".
- Duplicate rows are reported, not removed (no evidence they are errors).
- Outliers are reported, not removed (clinical values; no basis to delete).

## 3. Feature metadata (hand-maintained)

Kept in `backend/ml/config.py` as `FEATURE_METADATA`, keyed by exact source column, completed in T2.2 after inspection:

| Field | Rule |
|---|---|
| `id` | snake_case of the source column: lowercase, non-alphanumeric runs → `_`, trimmed (e.g., `EF-TTE` → `ef_tte`, `Region RWMA` → `region_rwma`) |
| `label` | Readable label (expand abbreviations, e.g., `DM` → "Diabetes mellitus", `FBS` → "Fasting blood sugar") |
| `group` | One of the 5 group ids (§2) |
| `type` | `numeric` · `binary` · `categorical` · `ordinal` — assigned by hand from the inspection report, never guessed at runtime |
| `unit` | Only when confirmed from the dataset's documentation; otherwise `null` |
| `description` | Optional short plain-language note; no clinical claims beyond the abbreviation's meaning |

When the schema is built: `min`, `max` and `categories` come from the inputs of **all rows** (D-018), so held-out samples are always valid; `default` (median or mode) and percentile references come from the **training rows** only (§5.3).

## 4. Labels and leakage guard

| Target id | Source column | Expected raw values (verify in T2.1) | Encoding |
|---|---|---|---|
| `cad` | `Cath` | "Cad" / "Normal" | 1 / 0 |
| `lad` | `LAD` | "Stenotic" / "Normal" | 1 / 0 |
| `lcx` | `LCX` | "Stenotic" / "Normal" | 1 / 0 |
| `rca` | `RCA` | "Stenotic" / "Normal" | 1 / 0 |

- **Leakage guard (BR-2):** `EXCLUDED_COLUMNS = ["LAD", "LCX", "RCA", "Cath"]`. The input feature list = all columns − excluded − dropped. `train.py` asserts the intersection is empty; `tests/test_dataset.py` asserts the same.
- **Same inputs for all four targets** (D-010).
- **Consistency check (T2.1):** count rows where `Cath` ≠ (LAD ∨ LCX ∨ RCA). Report the number; do not modify labels. If any exist, ask Satvik how to handle them before T2.3.
- Any raw label value outside the expected set → training fails with a clear message.

## 5. Normalization and encoding

### 5.1 Raw → canonical (done once in `ml/dataset.py`)
Canonical values are what the API accepts and returns. Expected mappings (final maps written after T2.1):

| Kind | Expected raw | Canonical |
|---|---|---|
| Binary | "Y"/"N" or 1/0 (varies by column) | `true` / `false` |
| Sex | "Male" / "Fmale" | "Male" / "Female" |
| BBB | "N" / "LBBB" / "RBBB" | "None" / "LBBB" / "RBBB" |
| VHD (ordinal) | "N" / "mild" / "Moderate" / "Severe" | "None" / "Mild" / "Moderate" / "Severe" |
| Numeric (incl. Function Class, Region RWMA) | numbers | number (integer flag set if all values are integers) |

Any raw value not covered by the final map → fail fast.

### 5.2 Canonical → model matrix (inside each sklearn `Pipeline`)
A `ColumnTransformer` fitted inside each CV fold (no leakage from preprocessing):

| Type | Transformer |
|---|---|
| numeric | `StandardScaler` |
| binary | passthrough as 0/1 |
| ordinal | `OrdinalEncoder` with the explicit ordered category list |
| categorical | `OneHotEncoder(handle_unknown="ignore")` |

`preprocessing.py` also returns `transformed_to_feature`: for every transformed column, the original feature id. SHAP values of one-hot columns are **summed** back to their original feature (valid because SHAP values are additive).

### 5.3 Held-out sample patients (D-016)
Chosen **before any model is trained**, by a fixed rule, so they cannot be picked for good model behaviour:
1. `k` = number of stenotic vessels (LAD + LCX + RCA) per row. Rows failing the consistency check (§4) are not eligible.
2. Slots in order: A: k=3 · B: k=2 · C: k=1 · D: k=1 (prefer a different stenotic vessel than C) · E: k=0 · F: k=0.
3. Each slot picks uniformly at random among unused eligible rows with that `k`, using `numpy.random.default_rng(42)`. If a slot's group is empty, it uses the group with the most remaining rows.
4. The 6 rows are removed from all CV and final training. Remaining rows = **training rows** (expected 297).

## 6. Validation, selection, importance

- **CV:** `RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=42)`, stratified on the target being trained, over training rows only.
- **Candidates (D-011):** `LogisticRegression(max_iter=1000)`, `RandomForestClassifier(n_estimators=300, random_state=42)`, `GradientBoostingClassifier(random_state=42)`; reference `DummyClassifier(strategy="prior")`. Library defaults otherwise; no tuning.
- **Metrics per fold:** accuracy, precision (zero_division=0), recall, specificity, F1 at threshold 0.5; ROC-AUC; average precision; Brier score. Reported as mean ± std over 25 folds.
- **Out-of-fold predictions** from repeat 1 (each row predicted exactly once) → ROC curve, calibration curve (5 quantile bins), confusion matrix.
- **Selection (D-013):** highest mean ROC-AUC; if logistic regression is within 0.01 of the best, choose logistic regression.
- **Final model:** selected candidate refit on all training rows.
- **Global importance:** SHAP on all training rows with the final model; `share(f) = mean|SHAP(f)| / Σ_g mean|SHAP(g)|`, per target.
- **Quick controls (BR-9):** `score(f)` = mean of `share(f)` over the four targets; top 8 by score.

## 7. Artifacts (`backend/artifacts/`, generated by `python -m ml.train`)

| File | Content |
|---|---|
| `manifest.json` | Version, timestamps, data hash, seed, library versions |
| `feature_schema.json` | Features, groups, quick controls, excluded and dropped columns |
| `samples.json` | 6 held-out sample patients + ground truth + source row index |
| `metrics.json` | Validation setup + per-target metrics, selection, global importance, plot paths |
| `reference_values.json` | Sorted training values per numeric feature (for percentiles) |
| `models/{target}.joblib` | Model bundle per target (§7.6) |
| `plots/{target}_{roc,calibration,confusion}.png` | Evaluation plots |
| `data_report.md` | T2.1 inspection report |

**7.1 `manifest.json`**
```json
{
  "model_version": "20261009T1030Z-3f2a9c1",
  "trained_at": "2026-10-09T10:30:00Z",
  "data_file": "extention of Z-Alizadeh sani dataset.xlsx",
  "data_sha256": "<64 hex chars>",
  "seed": 42,
  "python": "3.13.x",
  "libraries": { "scikit-learn": "x.y.z", "shap": "x.y.z", "pandas": "x.y.z", "numpy": "x.y.z", "joblib": "x.y.z" },
  "targets": ["cad", "lad", "lcx", "rca"]
}
```
`model_version` = UTC timestamp + first 7 hex chars of `data_sha256`.

**7.2 `feature_schema.json`** — `{ features: FeatureSchema[], feature_groups, quick_controls, excluded_columns, dropped_features }` (types in API_CONTRACT §3).

**7.3 `samples.json`** — `{ samples: (SamplePatient & { source_row: number })[] }`; `source_row` is for traceability and is not sent by the API.

**7.4 `metrics.json`** — `MetricsResponse` (API_CONTRACT §6).

**7.5 `reference_values.json`** — `{ "<numeric feature id>": [sorted training values] }`. Percentile = 100 × (count of values ≤ x) / n, rounded.

**7.6 `models/{target}.joblib`** (Python dict)
```python
{
  "target": "lad",
  "model_type": "random_forest",
  "pipeline": Pipeline([("preprocess", ColumnTransformer(...)), ("model", Classifier(...))]),
  "feature_ids": [...],                 # column order expected by the pipeline
  "transformed_to_feature": [...],      # original feature id per transformed column
  "shap_units": "probability",          # "log_odds" for logistic regression / gradient boosting
  "shap_background": np.ndarray | None, # transformed training rows; used by LinearExplainer
  "sklearn_version": "x.y.z",
}
```
Explainers by model type: logistic regression → `shap.LinearExplainer` (log-odds); random forest → `shap.TreeExplainer` (probability of class 1); gradient boosting → `shap.TreeExplainer` (log-odds). Additivity (`base + Σ shap = model output`) is tested per target.

## 8. Frontend data structures

```ts
// src/config/vessels.ts — 3D-specific config only; display labels come from /api/meta
interface VesselConfig {
  id: "lad" | "lcx" | "rca";
  objectName: `artery-${"lad" | "lcx" | "rca"}`;
  preferredView: "front" | "back" | "left" | "right";   // preset used when selected from the list
}

// src/scene/arteryPaths.ts — control points in the heart model's coordinate space
type Vec3 = [number, number, number];
interface ArteryPath {
  id: "lad" | "lcx" | "rca" | "left_main";   // left_main: neutral, non-interactive trunk
  points: Vec3[];
  radius: number;
  interactive: boolean;
}

// src/state/analysisReducer.ts — PRODUCT_SPEC §6.2
interface AnalysisState {
  status: "idle" | "predicting" | "ready" | "input_invalid" | "error";
  source: "sample" | "typical" | null;
  sampleId: string | null;
  loadedValues: Record<string, FeatureValue> | null;   // values when the patient was loaded
  values: Record<string, FeatureValue> | null;         // current (possibly modified) values
  fieldErrors: Record<string, string>;
  result: PredictResponse | null;                      // matches `values` when status = ready
  originalResult: PredictResponse | null;              // result for loadedValues (what-if deltas)
  lastGoodResult: PredictResponse | null;              // shown as "Out of date" on error/invalid
  latestRequestId: number;
  error: ApiError | null;
}
```
