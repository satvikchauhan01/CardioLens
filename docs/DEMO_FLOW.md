# Demo Flow

**Status:** v0.3 — v0.1 approved by Satvik (T0.2); the steps that waited for real models were filled in at T9.3, and a narration draft for the video was added at T11.3 (§3.1); both are for Satvik's review · **Date:** 2026-10-08

> Judges receive the Devpost submission (repo + video), so the **YouTube video** (§3) is the primary demo. The live script (§2) is for any live session or Q&A during judging (Oct 15–20).
> The steps that depend on the trained models were filled in on 2026-10-07 from the running app (model version `20261007T1423Z-7393432`), never guessed. If the models are retrained, check these numbers again.

---

## 1. Seeded demo data and controls

- **Sample patients A–F:** held out from all training and validation (DATA_MODEL §5.3). Sample A loads automatically on first visit.
- **Start from typical values:** training median/mode for every feature.
- **Reset demo** (header): Sample A, no modifications, `cad` selected, camera reset.
- **Reset to original** (Patient card, shown while inputs are modified): undo what-if edits for the loaded patient.
- **Held-out results** (model version above): the model's predictions match the dataset labels for 4 of 4 targets on Samples A, B, C and F, 3 of 4 on Sample E (CAD) and 2 of 4 on Sample D (LAD, RCA). Six patients are an illustration, not an evaluation; the performance numbers are the cross-validated ones.

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
| 0:55 | Click the **LCX** artery (suggested: its explanation differs most from the CAD one) | "Clicking a vessel opens that vessel's explanation." Sample A: LAD 58%, LCX 60%, RCA 52%. Top factor per vessel: LAD regions with RWMA, LCX creatinine (1.5 mg/dL, 96th percentile), RCA diabetes mellitus | DIFF-3 |
| 1:10 | Read the explanation | "These are SHAP contributions: what pushed this estimate up or down, with the patient's value and where it sits in the dataset." | DASH-2, DASH-3 |
| 1:35 | Switch the top quick control, **Typical chest pain**, off | "What-if: the colors, probabilities and explanations update live. This is model sensitivity, not a treatment effect." Sample A: LAD 58% → 51%, LCX 60% → 57%, RCA 52% → 37% and its status becomes "Stenosis not predicted"; CAD >99% → 98%. Then **Reset to original**. | DIFF-1, real-time integration |
| 2:00 | Toggle **Show dataset angiography result**, then load **Sample D** | "These sample patients were held out from training. For Sample A the model's four predictions match what the angiography recorded. For Sample D it is wrong on two vessels: it predicts LAD and RCA stenosis, the dataset says Normal — and the app shows that too." (Sample E is the other miss: CAD predicted at 91%, dataset label Normal.) | DIFF-2 |
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
| 8. Results | 0:30 | Real metrics table from the Model & method tab — no rounding up, no cherry-picking. Say both sides: CAD ROC-AUC 0.917 ± 0.033; the vessel models are weaker, LCX 0.739 ± 0.056 and RCA 0.725 ± 0.045 |
| 9. Limitations and close | 0:20 | PRODUCT_SPEC §9.4 in brief; thank you |

### 3.1 Narration draft (T11.3)

A draft for Satvik to put into his own words; about 800 words, close to six minutes at a calm pace. Every number is from the running app or from `backend/artifacts/metrics.json` (model version above). Record at 100% zoom in a window at least 1280 px wide, after one dry run with the console open.

**1. Hook and problem** (app open on Sample A)
"A model that says 'ninety-nine percent risk of coronary artery disease' leaves out two things a reader needs: which artery is the model concerned about, and why. This is CardioLens, my project for Track A. One thing first, and it stays on screen the whole time: this is an educational and decision-support prototype. It is not a diagnosis."

**2. What it does** (move the pointer across the three columns)
"On the left is one patient's routine clinical data. On the right are four model estimates: coronary artery disease overall, and a narrowing of fifty percent or more in the LAD, the LCX and the RCA. In the middle is a 3D heart, and each of those three arteries takes the colour of its own estimate."

**3. Input workflow** (click Sample C, then "Start from typical values"; change Age; type 200 into Age; correct it)
"Six sample patients are built in. They were set aside before training, so the models have never seen them. I can also start from typical values and enter a patient by hand: fifty-four inputs, in five groups, from demographics to echo findings. Every change is checked first. An age of 200 is outside the range seen in the dataset, so the field says so and no estimate is requested. With a valid value the estimates update in about half a second."

**4. 3D interactions** (Reset demo; drag, scroll, hover the LAD; click the LCX row; read the legend)
"I can rotate and zoom the heart. Hovering an artery shows its name and estimate, and a click selects it. The circumflex artery runs behind the heart, so choosing LCX in the list turns the heart to the back. The legend says what the colour means: the estimated probability for that artery. It does not show where along the artery a narrowing might be. The dataset has no such information, so the app does not pretend to."

**5. Explanations** (LCX selected; scroll the explanation; "Show all")
"Selecting a vessel opens that vessel's explanation. These are SHAP contributions: which inputs pushed this estimate up or down, with the patient's value, its unit and where it lies among the training patients. For this patient's LCX the largest factor is creatinine: 1.5 milligrams per decilitre, the ninety-sixth percentile. The sentence on top is filled from a template, not written by a language model."

**6. What-if and dataset labels** (Reset demo; switch Typical chest pain off; Reset to original; tick "Show dataset angiography result"; load Sample D)
"The quick controls hold the eight inputs that matter most to the four models. If I switch typical chest pain off, everything updates together. The RCA estimate goes from 52 to 37 percent, and its status changes to 'stenosis not predicted'. This is how the model responds to a changed input. It is not the effect of a treatment. Now the angiography labels from the dataset. For Sample A all four predictions match. For Sample D the model predicts a narrowing in the LAD, at 79 percent, and in the RCA, at 92 percent, and the dataset says both are normal. The app shows its misses as plainly as its hits."

**7. Technical implementation** (Model & method tab, method box; then the architecture diagram of ARCHITECTURE §1 or the report's page 5)
"How it is built. The dataset is the Z-Alizadeh Sani dataset from the UCI repository: 303 patients. There are four separate models, one per target. The four angiography columns are never inputs to any model; the code refuses to train if one appears, and tests check it. For each target I compare logistic regression, a random forest and gradient boosting against a baseline, with repeated stratified five-fold cross-validation, 25 folds, and the preprocessing refitted inside every fold. Nothing is tuned, because with 297 training rows a search would mostly fit noise. A FastAPI service loads the models once and returns four probabilities and four explanations per request. The same four ids, cad, lad, lcx and rca, run through the training code, the API and the names of the 3D objects, and that keeps each estimate on the right artery. The heart is built from 44 BodyParts3D anatomy parts into one file of 0.65 megabytes. It draws a frame in about one millisecond on this laptop's integrated graphics."

**8. Results** (Model & method tab, the two tables, then the plots)
"The results, as measured. The overall model reaches a ROC-AUC of 0.917, plus or minus 0.033. The vessel models are weaker: 0.855 for the LAD, 0.739 for the LCX and 0.725 for the RCA, against 0.5 for the baseline. At the 0.5 threshold the LCX model finds only 40 percent of the stenotic vessels, and the RCA model 53 percent. Routine findings say much more about whether a patient has coronary disease than about which artery is affected. This page shows every candidate, the baseline and the calibration plots."

**9. Limitations and close** (scroll to Limitations; back to Patient analysis)
"The limits: 303 patients from one dataset, recorded findings and not raw ECG or imaging, and estimates per artery with no location inside it. CardioLens is for education and decision support. The code, the trained models and a five-page report are in the repository. Thank you."

Before recording: the heart model's full credit and licence must be in the app's footer and credits, because both are on screen in this video.

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
