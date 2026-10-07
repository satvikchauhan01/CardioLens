# Product Specification

**Status:** v0.1 — approved by Satvik (T0.2) · **Date:** 2026-10-07
**Product:** CardioLens (working name, D-001)
**Tagline:** "Coronary risk estimates, mapped to the vessels they describe."

> Priority: problem statement → this file → ARCHITECTURE → API_CONTRACT → DATA_MODEL → BUILD_MAP → DECISIONS → code. Conflicts: stop and ask.

---

## 1. Summary

CardioLens is a web app for **educational decision support**. A user loads a sample patient (or edits clinical values) and CardioLens:

1. estimates the probability of overall CAD and of ≥50% stenosis in LAD, LCX and RCA;
2. colors those three arteries on an interactive 3D heart by their probabilities;
3. explains each estimate with the patient's measurements and their relative contributions (SHAP);
4. lets the user change values and immediately see how the estimates respond (what-if);
5. shows how well the models perform under repeated cross-validation, and how they did on held-out patients.

## 2. Scope, roles, permissions

- In scope: features F1–F11 (§3). Out of scope: PROBLEM_ANALYSIS §8.
- **One anonymous role.** No accounts, no login, no permissions model (D-006).
- **No persistence.** Entered values are never stored or logged (BR-12).

## 3. Features

| ID | Feature | Type | Summary |
|---|---|---|---|
| F1 | Sample patients | Must | 6 held-out dataset patients (never used in training or CV) + "Start from typical values" |
| F2 | Patient input form | Must | Generated from the feature schema, grouped by clinical category, validated |
| F3 | Prediction engine | Must | Four models: `cad`, `lad`, `lcx`, `rca` |
| F4 | Results panel | Must | CAD status, vessel probabilities, risk levels, agreement note |
| F5 | 3D heart viewer | Must | Colored, selectable arteries; orbit/zoom; legend; view presets; labels |
| F6 | Explanation panel | Must | Per-target SHAP contributions with value, unit, dataset percentile, summary |
| F7 | What-if explorer | DIFF-1 | Quick controls, live updates, before → after deltas, reset |
| F8 | Ground-truth reveal | DIFF-2 | Dataset angiography labels for unmodified held-out samples |
| F9 | Model & method view | Must + DIFF-2 | CV metrics, plots, global importance, method, limitations, credits |
| F10 | Safety & disclaimer | Must | Persistent banner, result captions, legend note |
| F11 | Fallbacks | Must | API-unavailable, 3D-load-failure and no-WebGL states |

## 4. Screens and layout

### 4.1 Global shell
- **Header:** name + tagline · tabs **Patient analysis** | **Model & method** · **Reset demo** button.
- **Disclaimer banner** (F10) directly under the header on every tab. Compact, non-dismissible.
- **Footer:** short dataset citation, 3D model credit, model version, "Educational prototype".

### 4.2 Patient analysis (default tab)

Desktop (≥1280 px) — three columns:

| Left (~340 px): Input | Center (flexible): 3D | Right (~380 px): Results |
|---|---|---|
| Sample picker (F1) | Canvas (F5) | CAD summary card (F4) |
| Quick what-if controls (F7) | Legend + legend note (F10) | Vessel list: LAD, LCX, RCA (F4) |
| "All clinical inputs" accordion, one section per group (F2) | View presets: Front · Back · Left · Right · Reset view | Agreement note (BR-6) |
| "Reset to original" (F7) | Labels toggle · interaction hint | Explanation panel for the selected target (F6) |
| | | Ground-truth toggle (F8) |

- 768–1279 px: 3D viewer on top; input and results side by side below.
- <768 px: single column (works, not optimized).

### 4.3 Model & method tab (F9)
1. **Method box:** dataset, held-out samples, CV scheme, leakage guard (excluded columns listed), decision threshold.
2. **Metrics table per target:** selected model, the other candidates and the baseline; every metric as mean ± std.
3. **Plots per target:** ROC (out-of-fold), calibration, confusion matrix at threshold 0.5.
4. **Global feature importance per target:** top 10 features by share of mean |SHAP|.
5. **Limitations** (§9.4).
6. **Credits:** dataset citation + license, 3D model credit + license, key libraries.

## 5. User flows

**UF-1 First visit.** Open app → app boots (meta + samples) → Sample A loads automatically → prediction runs → arteries take their colors, results and the CAD explanation appear. Target selected by default: `cad`.

**UF-2 Inspect a vessel.** Hover an artery → it highlights, cursor becomes a pointer, tooltip shows "LAD · Left Anterior Descending · 58%". Click → vessel selected (3D highlight + matching list row) → explanation panel switches to that vessel. Clicking the heart muscle or the CAD card selects `cad`. Clicking empty space changes nothing. Vessel list rows are buttons, so every 3D action is also possible by keyboard.

**UF-3 What-if.** Change a quick control → 400 ms debounce → validate → predict → artery colors transition (≤400 ms), probabilities and explanations update, deltas appear ("LAD 58% → 44%, −14 pp"), a "Modified (n fields)" badge appears. **Reset to original** restores the loaded patient.

**UF-4 Custom values.** "Start from typical values" loads the training median/mode for every feature → edit any field in the accordion → inline validation → live update as in UF-3.

**UF-5 Ground truth.** With an unmodified sample loaded, toggle **Show dataset angiography result** → each target row shows the dataset label and ✓ / ✗ against the predicted status. Hidden as soon as inputs are modified (tooltip explains why).

**UF-6 Evaluation.** Open **Model & method** → metrics, plots and method load (fetched once per session).

**Reset demo** (header): loads Sample A, clears modifications, selects `cad`, resets the camera.

## 6. Application states

### 6.1 Boot
| State | UI | Next |
|---|---|---|
| `booting` | Full-page skeleton | meta + samples OK → `ready` · any failure → `boot_error` |
| `boot_error` | Message: "Can't reach the CardioLens model service." + how to start the backend + **Retry** | Retry → `booting` |
| `ready` | Analysis view | — |

### 6.2 Analysis (state machine)

| State | Meaning | UI | Events → next state |
|---|---|---|---|
| `idle` | No patient loaded | Empty states; neutral grey arteries; hint "Choose a sample patient or start from typical values" | LOAD_PATIENT → `predicting` |
| `predicting` | Request in flight | First load: skeletons. Later: previous results dimmed + small spinner | RESPONSE_OK (latest id) → `ready` · RESPONSE_ERROR (latest id) → `error` · EDIT → debounce |
| `ready` | Results match current inputs | Normal | EDIT → debounce → valid → `predicting` / invalid → `input_invalid` · LOAD_PATIENT → `predicting` |
| `input_invalid` | Inputs fail validation | Field errors; results labelled "Out of date — fix highlighted fields"; no request sent | EDIT → revalidate |
| `error` | Last request failed | Inline error with **Retry**; last good results labelled "Out of date" | RETRY → `predicting` · EDIT → debounce |

Rules: each request gets an increasing id; responses with an older id are discarded. Selection (`selectedTarget` ∈ {cad, lad, lcx, rca}, default `cad`) and hover state are independent of the analysis state.

## 7. Business rules (frozen once approved)

**BR-1 Targets.** `cad` (from dataset column `Cath`), `lad`, `lcx`, `rca` (dataset vessel columns). Positive class = CAD / stenotic (≥50% narrowing per the dataset definition).

**BR-2 Leakage guard.** Dataset columns `LAD`, `LCX`, `RCA`, `Cath` are never model inputs for any target. Training aborts if any appears in the feature list. Covered by an automated test.

**BR-3 Predicted status.** `predicted = probability ≥ 0.5`. Text: CAD → "CAD predicted" / "CAD not predicted"; vessels → "Stenosis predicted" / "Stenosis not predicted".

**BR-4 Risk level (display only).** Low: p < 0.35 · Moderate: 0.35 ≤ p < 0.65 · High: p ≥ 0.65. Caption wherever shown: "Model-estimated probability, not a clinical risk category."

**BR-5 Color.** Continuous interpolation through three stops — teal (p = 0), amber (p = 0.5), crimson (p = 1) — with darkening luminance toward high risk. Always paired with the % value and level label. Neutral grey when there is no prediction. Exact color tokens live in `frontend/src/config/risk.ts` and are checked for color-blind distinguishability in T6.3.

**BR-6 Agreement.** Inconsistent when (`cad` not predicted AND any vessel predicted) OR (`cad` predicted AND no vessel predicted). If inconsistent, show the neutral note in §9.2. Probabilities are never altered to force consistency.

**BR-7 Explanations.** For each target, one contribution per input feature (SHAP values summed back to original features). Sorted by |SHAP| descending; top 8 shown, "Show all" expands.
- `relative_i = shap_i / Σ_j |shap_j|` (all 0 if the sum is 0).
- `direction`: "raises" if shap > 0, "lowers" if shap < 0, "neutral" if shap = 0.
- `percentile` (numeric features only): % of training patients with a value ≤ this value, rounded to an integer.

**BR-8 Plain-language summary** (server-side template, deterministic): "Factors that most increased this estimate: A (value), B (value), C (value). Factor that most decreased it: D (value)." Up to 3 raising factors and 1 lowering factor; a clause is omitted when it has no factors.

**BR-9 Quick controls.** The 8 features with the highest average normalized global importance across the four targets (DATA_MODEL §6). Numeric → slider + number input; binary → toggle; categorical/ordinal → segmented control.

**BR-10 What-if deltas.** When current inputs differ from the loaded patient, each target shows original %, current % and the signed difference in percentage points (integer). Badge "Modified (n fields)". **Reset to original** restores the loaded values.

**BR-11 Ground truth.** Available only when the patient came from a sample AND inputs are unmodified. Shows the dataset label per target and match/mismatch against the predicted status (BR-3).

**BR-12 Privacy.** Inputs are never stored or logged by the backend; request bodies are excluded from logs; no cookies, analytics or browser storage.

**BR-13 Validation.** All features required. Numeric: finite; integer when the schema says `integer`; within the dataset range [min, max] observed across the inputs of all 303 rows (D-018). Binary: boolean. Categorical/ordinal: one of the schema's categories. Unknown fields rejected. The frontend sends nothing while invalid; the backend re-validates (HTTP 422).

**BR-14 Display.** Probabilities as integer % (e.g., "58%"). Measurements per schema unit and step. Relative contribution as integer %, or "<1%" when 0 < |r| < 0.5%.

## 8. AI behavior

- Classical supervised ML only (DATA_MODEL §4). **No generative AI** (D-008).
- Deterministic: same inputs + same `model_version` → identical outputs.
- Summaries are templates (BR-8), not generated text.
- `model_version` is shown in the footer and on the Model & method tab.

## 9. Copy and safety (exact text)

**9.1 Disclaimer banner:**
> Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.

**Caption under the CAD card:** "Model estimate — not a diagnosis."

**9.2 Agreement note (BR-6):**
> The overall CAD model and the three vessel models are trained separately, so they can disagree. Here, {CAD is predicted but no single vessel reaches 50% | a vessel reaches 50% but overall CAD is not predicted}.

**9.3 3D legend note:**
> Color shows each artery's model-estimated probability of ≥50% narrowing. It does not show where along the artery a narrowing might be.

**9.4 Limitations (Model & method tab):**
- Trained on 303 patients from one public research dataset; performance on other populations is unknown.
- Inputs are recorded clinical findings, not raw ECG, echo or imaging data.
- Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.
- Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).
- What-if changes show model sensitivity, not the effect of any treatment.

**9.5 What-if note:** "What-if shows how the model's estimate responds to changed inputs. It does not predict the effect of treatment."

**9.6 Wording rules.** Use: "estimate", "model predicts", "probability", "dataset label". Avoid: "diagnosis/diagnose", "detects", "blockage location", "clinically validated", unqualified "accurate", "safe/unsafe".

## 10. Accessibility

- Color is never the only signal: % and level text always accompany it.
- Every 3D interaction has a keyboard-accessible equivalent (vessel list buttons, view preset buttons).
- Visible focus states; ARIA labels on controls; text contrast at WCAG AA.
- `prefers-reduced-motion`: color transitions become instant.
- The canvas has a text alternative summarizing each vessel's estimate.

## 11. Visual design direction

- Light, clean surfaces; teal/blue primary; slate text; risk colors reserved for risk only.
- Rounded cards, soft shadows, generous spacing; one sans-serif family (chosen in T1.4).
- Avoid neon, heavy gradients, glassmorphism, large glows, over-animation, hospital-admin look, childish visuals.
- In 3 seconds a judge must see: what it does (header + tagline), what to do (sample picker), what it produced (colored arteries + CAD card).

## 12. Non-functional requirements

| Area | Target |
|---|---|
| Prediction latency | `POST /api/predict` p95 < 300 ms on a laptop CPU (4 models + SHAP) |
| First load | Usable analysis view < 3 s on localhost; 3D chunk and model load lazily |
| 3D smoothness | ~60 FPS while rotating on integrated graphics; never below ~30 FPS |
| Heart asset | ≤ 5 MB after compression (D-019, D-020) |
| Browsers | Latest Chrome and Edge (primary); Firefox best effort |
| Reliability | No crash on API failure, invalid input or 3D load failure (F11) |
| Reproducibility | `python -m ml.train` regenerates all artifacts deterministically (fixed seeds, pinned versions) |
