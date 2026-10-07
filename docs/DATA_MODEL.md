# Data Model

**Status:** v0.3 — updated from the real file at T2.1 (changes listed in §9, for Satvik's review) · **Date:** 2026-10-07

> Facts marked **(verified)** come from the UCI dataset page (checked 2026-10-07).
> Facts marked **(file)** were checked against the actual file on 2026-10-07; `backend/artifacts/data_report.md` is the generated evidence.

There is **no database**. All data lives in one source file and in generated artifacts (§7). User inputs are never persisted.

---

## 1. Source dataset

| Property | Value |
|---|---|
| Name | "extention of Z-Alizadeh sani dataset" (UCI spelling), UCI id 411 **(verified)** |
| URL | https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset |
| File | `extention of Z-Alizadeh sani dataset.xlsx` inside the UCI zip download **(verified)** |
| Sheets | `Sheet 1 - Table 1` holds the data and is the one read. A second sheet, `Sheet1`, holds a single row of 100 column names from a larger source table and no patients; it is ignored **(file)** |
| Rows | 303 patients **(verified, file)** |
| Columns | 59: 55 inputs + 4 labels **(file)** |
| Missing values | None **(verified, file)** |
| Duplicate rows | None **(file)** |
| Class definition | CAD if diameter narrowing ≥ 50%, otherwise Normal **(verified)** |
| Label note | CAD (last column, `Cath`) occurs when at least one of LAD, LCX, RCA is stenotic; for each classification only one of LAD/LCX/RCA/Cath may remain **(verified)** |
| License | CC BY 4.0 — sharing and adaptation allowed with credit **(verified)** |
| Citation | Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K **(verified)** |
| Class balance | CAD 216 / 87 · LAD 177 / 126 · LCX 119 / 184 · RCA 114 / 189 (positive / negative, all 303 rows) **(file)** |
| Stenotic vessels per patient | 0: 86 · 1: 87 · 2: 67 · 3: 63 **(file)** |

The file is stored at `backend/data/raw/` and committed with attribution (D-027). SHA-256: `739343245c2ba578b541370217531750d8e936022f928b83e0d91756caa3ff0b`.

## 2. Input columns (file)

Grouped for the UI. Group names combine the dataset's own grouping (demographic; symptom and examination; ECG; laboratory and echo) with the problem statement's wording.

| Group id | Label | Expected source columns |
|---|---|---|
| `demographic_history` | Demographics & history | Age, Weight, Length, Sex, BMI, DM, HTN, Current Smoker, EX-Smoker, FH, Obesity, CRF, CVA, Airway disease, Thyroid Disease, CHF, DLP |
| `symptoms_exam` | Symptoms & examination | BP, PR, Edema, Weak Peripheral Pulse, Lung rales, Systolic Murmur, Diastolic Murmur, Typical Chest Pain, Dyspnea, Function Class, Atypical, Nonanginal, Exertional CP, LowTH Ang |
| `ecg` | ECG findings | Q Wave, St Elevation, St Depression, Tinversion, LVH, Poor R Progression, BBB |
| `laboratory` | Laboratory | FBS, CR, TG, LDL, HDL, BUN, ESR, HB, K, Na, WBC, Lymph, Neut, PLT |
| `echo` | Echocardiography | EF-TTE, Region RWMA, VHD |

Count: 17 + 14 + 7 + 14 + 3 = **55 inputs**, all present in the file under exactly these names. Label columns: `Cath`, `LAD`, `LCX`, `RCA`.

Rules applied after inspection:
- Columns with a single unique value are dropped and listed in `dropped_features` with reason "zero variance". In this file that is one column: **`Exertional CP`** (always "N"), leaving **54 model inputs**.
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
| `step` | UI step for numeric features: 1 for integer-valued columns; set by hand for the others (BMI, HDL, HB, K: 0.1 · CR: 0.05) |

When the schema is built: `min`, `max` and `categories` come from the inputs of **all rows** (D-018), so held-out samples are always valid; `default` (median or mode) and percentile references come from the **training rows** only (§5.3).

**Types assigned (file).** Numeric (23): Age, Weight, Length, BMI, BP, PR, Function Class, FBS, CR, TG, LDL, HDL, BUN, ESR, HB, K, Na, WBC, Lymph, Neut, PLT, EF-TTE, Region RWMA. Categorical (2): Sex, BBB. Ordinal (1): VHD. Binary (29): every other input.

**Units (D-041).** The UCI page documents no units, so they come from two papers written or co-written by the dataset's creators:

| Source | Units confirmed |
|---|---|
| Alizadehsani R. et al., "Diagnosing Coronary Artery Disease via Data Mining Algorithms by Considering Laboratory and Echocardiography Features", *Res Cardiovasc Med* 2013;2(3):133–139, doi:10.5812/cardiovascmed.10888, Tables 1–2 | Age (years) · Weight (kg) · BMI (kg/m²) · EF (%) · "Obesity: yes if BMI > 25" · VHD levels Normal/Mild/Moderate/Severe |
| Joloudari J.H., …, Alizadehsani R., et al., "GSVMA: A Genetic-Support Vector Machine-Anova method for CAD diagnosis based on Z-Alizadeh Sani dataset", arXiv:2108.08292, Table 1 | BP (mmHg) · PR (ppm) · FBS, Cr, TG, LDL, HDL, BUN (mg/dL) · ESR (mm/h) · HB (g/dL) · K, Na (mEq/lit, written here as mEq/L) · Lymph, Neut (%) · EF (%) |
| The file itself | Length (cm): `BMI = Weight / (Length / 100)²` holds for all 303 rows |

No unit is shown for **WBC** and **PLT**: the second source prints "cells/mL" and "1000/mL", which do not fit the values (3,700–18,000 and 25–742), so they are left as `null` rather than corrected by guesswork. The same table prints "Cr (creatine)"; the label used is "Creatinine". Function Class (0–3) and Region RWMA (0–4) have no unit and no definition in these sources, so none is given.

## 4. Labels and leakage guard

| Target id | Source column | Raw values (file) | Encoding |
|---|---|---|---|
| `cad` | `Cath` | "CAD" / "Normal" | 1 / 0 |
| `lad` | `LAD` | "Stenotic" / "Normal" | 1 / 0 |
| `lcx` | `LCX` | "Stenotic" / "Normal" | 1 / 0 |
| `rca` | `RCA` | "Stenotic" / "Normal" | 1 / 0 |

- **Leakage guard (BR-2):** `EXCLUDED_COLUMNS = ["LAD", "LCX", "RCA", "Cath"]`. The input feature list = all columns − excluded − dropped. `train.py` asserts the intersection is empty; `tests/test_dataset.py` asserts the same.
- **Same inputs for all four targets** (D-010).
- **Consistency check (T2.1):** count rows where `Cath` ≠ (LAD ∨ LCX ∨ RCA). Report the number; do not modify labels. **Result (file): 1 row** — data row 93 (spreadsheet row 95) has `LAD` = "Stenotic" and `Cath` = "Normal". Decision (D-040, Satvik 2026-10-07): the row stays in the training rows exactly as recorded for all four models, and it is never eligible as a held-out sample (§5.3).
- Any raw label value outside the expected set → training fails with a clear message.

## 5. Normalization and encoding

### 5.1 Raw → canonical (done once in `ml/dataset.py`)
Canonical values are what the API accepts and returns. Final mappings (file):

| Kind | Raw | Canonical |
|---|---|---|
| Binary, coded 1/0 (11 columns: DM, HTN, Current Smoker, EX-Smoker, FH, Edema, Typical Chest Pain, Q Wave, St Elevation, St Depression, Tinversion) | 1 / 0 | `true` / `false` |
| Binary, coded "Y"/"N" (the other 18 binary columns) | "Y" / "N" | `true` / `false` |
| Sex | "Male" / "Fmale" | "Male" / "Female" |
| BBB | "N" / "LBBB" / "RBBB" | "None" / "LBBB" / "RBBB" |
| VHD (ordinal) | "N" / "mild" / "Moderate" / "Severe" | "None" / "Mild" / "Moderate" / "Severe" |
| Numeric (incl. Function Class 0–3, Region RWMA 0–4) | numbers | number (integer flag set if all values are integers; BMI, CR, HDL, HB and K are not) |

Matching is exact (case-sensitive). Any raw value not covered by the map → fail fast.

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
4. The 6 rows are removed from all CV and final training. Remaining rows = **training rows** (297).

"Prefer a different stenotic vessel" is applied to every `k=1` slot: rows whose single stenotic vessel no earlier `k=1` sample shows are tried first.

**Result (file, seed 42).** Data rows (0-based; spreadsheet row = index + 2):

| Sample | Row | Subtitle | Dataset labels |
|---|---|---|---|
| A | 33 | 60 y · Male | CAD · LAD, LCX, RCA stenotic |
| B | 235 | 56 y · Male | CAD · LAD, LCX stenotic |
| C | 172 | 62 y · Female | CAD · LAD stenotic |
| D | 88 | 71 y · Female | CAD · LCX stenotic |
| E | 185 | 50 y · Male | Normal |
| F | 286 | 50 y · Male | Normal |

Training rows: CAD 212 / 85 · LAD 174 / 123 · LCX 116 / 181 · RCA 113 / 184 (positive / negative).

## 6. Validation, selection, importance

- **CV:** `RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=42)`, stratified on the target being trained, over training rows only.
- **Candidates (D-011):** `LogisticRegression(max_iter=1000)`, `RandomForestClassifier(n_estimators=300, random_state=42)`, `GradientBoostingClassifier(random_state=42)`; reference `DummyClassifier(strategy="prior")`. Library defaults otherwise; no tuning.
- **Metrics per fold:** accuracy, precision (zero_division=0), recall, specificity, F1 at threshold 0.5; ROC-AUC; average precision; Brier score. Reported as mean ± std over 25 folds (population standard deviation, rounded to 4 decimals in `metrics.json`; D-042).
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

**7.5 `reference_values.json`** — `{ "<numeric feature id>": [sorted training values] }`. Percentile = 100 × (count of values ≤ x) / n, rounded to an integer with halves rounding up.

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
Explainers by model type: logistic regression → `shap.LinearExplainer` (log-odds); random forest → `shap.TreeExplainer` (probability of class 1); gradient boosting → `shap.TreeExplainer` (log-odds). Additivity (`base + Σ shap = model output`) is tested for each model type.

The linear explainer uses every training row as background, so its base value is exactly the mean model output over the training rows. The tree explainers use the trees' own training statistics (path-dependent), which needs no background data; for the random forest the base value is within 0.01 of the mean training output.
## 8. Frontend data structures

```ts
// src/config/vessels.ts — 3D-specific config only; display labels come from /api/meta
interface VesselConfig {
  id: "lad" | "lcx" | "rca";
  objectName: `artery-${"lad" | "lcx" | "rca"}`;
  preferredView: "front" | "back" | "left" | "right";   // preset used when selected from the list
}
const HEART_MODEL_URL: string | null;   // null while the stand-in heart is used (D-051)

// src/scene/arteryPaths.ts — control points in the heart model's coordinate space
type Vec3 = [number, number, number];
interface ArteryPath {
  id: "lad" | "lcx" | "rca" | "left_main";   // left_main: neutral, non-interactive trunk
  points: Vec3[];
  radius: number;
  interactive: boolean;
  labelAnchors: { point: Vec3; normal: Vec3 }[];   // where the label may sit; the one facing the camera is used
}

// src/state/analysisReducer.ts — PRODUCT_SPEC §6.2
interface AnalysisState {
  status: "idle" | "predicting" | "ready" | "input_invalid" | "error";
  source: "sample" | "typical" | null;
  sampleId: string | null;
  loadedValues: Record<string, FeatureValue> | null;   // values when the patient was loaded
  values: Record<string, FeatureValue | null> | null;  // current values; null = an empty field
  fieldErrors: Record<string, string>;
  result: PredictResponse | null;                      // matches `values`; set only when status = ready
  originalResult: PredictResponse | null;              // result for loadedValues (what-if deltas)
  lastGoodResult: PredictResponse | null;              // shown dimmed or "Out of date" when not ready
  latestRequestId: number;                             // every load and edit takes a new id
  loadRequestId: number | null;                        // the request that predicts loadedValues
  error: ApiError | null;
}
```

## 9. What T2.1 changed in this document (2026-10-07)

1. `Cath` positive value is "CAD", not "Cad" (§4).
2. The workbook has two sheets; only `Sheet 1 - Table 1` is data (§1).
3. Binary columns use two encodings, 1/0 in 11 columns and "Y"/"N" in 18 (§5.1).
4. `Exertional CP` is constant and is dropped, so the models have 54 inputs, not 55 (§2).
5. One row has inconsistent labels; it is kept as recorded (§4, D-040).
6. Units are now sourced, with WBC and PLT left without a unit (§3, D-041).
7. Class balance, vessel prevalences and the six held-out rows are filled in from the file (§1, §5.3).
8. `step` added to the hand-maintained metadata (§3).
