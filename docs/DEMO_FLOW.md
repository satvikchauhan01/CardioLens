# Demo Flow

**Status:** v0.1 — approved by Satvik (T0.2) · **Date:** 2026-10-07

> Judges receive the Devpost submission (repo + video), so the **YouTube video** (§3) is the primary demo. The live script (§2) is for any live session or Q&A during judging (Oct 15–20).
> Anything marked **[after T3.4]** depends on real trained models and is filled in only from real outputs, never guessed.

---

## 1. Seeded demo data and controls

- **Sample patients A–F:** held out from all training and validation (DATA_MODEL §5.3). Sample A loads automatically on first visit.
- **Start from typical values:** training median/mode for every feature.
- **Reset demo** (header): Sample A, no modifications, `cad` selected, camera reset.
- **Reset to original** (input panel): undo what-if edits for the loaded patient.

**Before any demo or recording:**
1. `python -m ml.train` has been run; `/api/health` returns 200.
2. Backend and frontend running; browser zoom 100%; window ≥ 1280 px wide.
3. Other GPU-heavy apps closed; notifications off.
4. One full dry run of §2 with zero console errors.

## 2. Live demo script (2–3 minutes)

| Time | Action | Say (short) | Shows |
|---|---|---|---|
| 0:00 | App open on Sample A | "A risk percentage doesn't tell you which artery a model is worried about. CardioLens maps four model estimates onto the vessels they describe." Point at the banner: "Educational decision support, not diagnosis." | Problem clarity, SAFE-1 |
| 0:15 | Point to CAD card and vessel list | "Overall CAD, plus LAD, LCX and RCA — each from its own model, each colored on its own artery." Read the legend note. | DASH-1, VIS-2 |
| 0:35 | Rotate, zoom, press **Back** | "LCX and RCA run around the side and bottom, so the view presets help." Hover an artery → tooltip. | VIS-1, VIS-3 |
| 0:55 | Click an artery **[after T3.4: pick the most interesting vessel for Sample A]** | "Clicking a vessel opens that vessel's explanation." | DIFF-3 |
| 1:10 | Read the explanation | "These are SHAP contributions: what pushed this estimate up or down, with the patient's value and where it sits in the dataset." | DASH-2, DASH-3 |
| 1:35 | Change the top quick control **[after T3.4]** | "What-if: the colors, probabilities and explanations update live. This is model sensitivity, not a treatment effect." Then **Reset to original**. | DIFF-1, real-time integration |
| 2:00 | Toggle **Show dataset angiography result** | "Sample A was held out from training. Here is what the angiography actually showed — including where the model is wrong." | DIFF-2 |
| 2:20 | Open **Model & method** | "Repeated stratified 5-fold cross-validation, mean ± std, against a baseline, with the label columns excluded from every model." | PM-4, PM-5 |
| 2:45 | Close | "Four models, one heart, every estimate explained — for education and decision support." | — |

## 3. YouTube video (target ~6 min; allowed 3–10)

Requirements (SG 3, PS): shows the project **running**, explains the approach, covers the input workflow, 3D interactions and technical implementation; English voice-over (+ subtitles if possible); **Unlisted**, not private.

| Segment | Length | Content |
|---|---|---|
| 1. Hook and problem | 0:30 | Why a bare risk number is not enough; disclaimer on screen |
| 2. What CardioLens does | 0:30 | One sentence + the three-panel layout |
| 3. Input workflow | 0:45 | Sample picker; "Start from typical values"; edit a field; validation message on a bad value |
| 4. 3D interactions | 0:45 | Rotate, zoom, presets, hover, click-to-select, legend note |
| 5. Explanations | 0:45 | Per-vessel SHAP, values, percentiles, summary |
| 6. What-if + ground truth | 0:45 | Live update, deltas, reset; reveal on a held-out sample |
| 7. Technical implementation | 1:30 | Architecture diagram (ARCHITECTURE §1); leakage guard; repeated CV and model selection; SHAP grouping of one-hot features; one target-id key across API and 3D; 3D performance choices |
| 8. Results | 0:30 | Real metrics table from the Model & method tab **[after T3.4]** — no rounding up, no cherry-picking |
| 9. Limitations and close | 0:20 | PRODUCT_SPEC §9.4 in brief; thank you |

## 4. Manual end-to-end checklist (T9.3 and before recording)

- [ ] Backend starts; `/api/health` → 200
- [ ] Frontend boots; Sample A loads; zero console errors
- [ ] Samples A–F each predict; 3D colors match the % in the results panel
- [ ] Hover and click each artery; list ↔ 3D selection stays in sync; keyboard selection works
- [ ] Explanation panel switches per target; "Show all" works
- [ ] Quick control edit updates within ~0.5 s; deltas correct; Reset to original works
- [ ] Invalid input → field error and no request; fixing it resumes updates
- [ ] Ground-truth toggle appears only for unmodified samples
- [ ] Model & method tab shows metrics and plots
- [ ] Disclaimer banner on both tabs; CAD caption and legend note present
- [ ] Backend stopped → boot/predict error states; restart + Retry recovers
- [ ] Heart file missing → proxy heart + notice
- [ ] WebGL disabled → 2D schematic
- [ ] Smooth rotation on integrated graphics; usable with CPU throttled 4×
- [ ] Reset demo restores the initial state

## 5. Wording

Follow PRODUCT_SPEC §9.6. Say "estimate", "probability", "model predicts", "dataset label". Never say "diagnoses", "detects blockages", "shows where the blockage is", "clinically validated".

## 6. Q&A preparation (answer from real results only)

| Likely question | Answer outline |
|---|---|
| How did you prevent target leakage? | LAD, LCX, RCA and Cath are excluded from every model's inputs; enforced in code and by a test; the dataset's own note requires it |
| Why trust metrics from 303 patients? | Repeated stratified 5-fold CV (25 folds), mean ± std, baseline comparison, preprocessing inside folds, six held-out patients never seen in training |
| Why these models? | Simple, well-understood models with exact SHAP explainers; fixed defaults, no tuning, to avoid overfitting a small dataset |
| Does the color show where the blockage is? | No. It shows each artery's estimated probability of ≥50% narrowing; the dataset has no location within an artery |
| What if CAD and vessel models disagree? | They are separate models; we show a neutral note instead of altering probabilities |
| How do outputs stay matched to the right artery? | One target-id key through API, artifacts, registry and 3D object names, checked by tests |
| Why SHAP, not LIME? | Exact, additive explanations for linear and tree models; one-hot parts sum back to the original feature |
