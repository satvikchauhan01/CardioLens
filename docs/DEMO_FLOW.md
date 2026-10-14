# Demo Flow

**Status:** v0.5 — v0.1 approved by Satvik (T0.2); the steps that waited for real models were filled in at T9.3; a narration draft for the video was added at T11.3 (§3.1); rewritten on 2026-10-11 for the four pages, the twelve sample patients and the retrained models (BUILD_MAP §9); updated on 2026-10-12 for the Home page, the two themes, the guided tour and the estimates on the patient cards (BUILD_MAP §10). The script and the narration are for Satvik's review · **Date:** 2026-10-12

> Judges receive the Devpost submission (repo + video), so the **YouTube video** (§3) is the primary demo. The live script (§2) is for any live session or Q&A during judging (Oct 15–20).
> The steps that depend on the trained models were filled in on 2026-10-11 from the running app (model version `20261011T1756Z-7393432`), never guessed. If the models are retrained, check these numbers again.

---

## 1. Seeded demo data and controls

- **Pages:** Home · Patients · New patient · Analysis · Model & method. The app opens on Home; Sample A is analysed in the background, so Analysis is ready when it is opened.
- **Theme:** the app starts in the system's theme (this laptop: dark). The sun and moon button in the header switches it; pick one before recording and stay with it. The report's figures are in the light theme.
- **Take the tour** (header, Home): six steps on the Analysis page; Escape or "Skip the tour" ends it.
- **Sample patients A–L** (Patients page): held out from all training and validation (DATA_MODEL §5.3). Six have the dataset label CAD (A, B, C, D, G, H) and six the label Normal (E, F, I, J, K, L).
- **New patient** page: every field starts from the training median/mode ("Typical values"), or from any sample; "Analyse this patient" opens the analysis.
- **Reset demo** (header): the Analysis page, Sample A, no modifications, `cad` selected, camera reset.
- **The heart's own turn:** on the Analysis page the heart turns once around on arrival and stops when it is touched; press **Reset view** before pointing at an artery, or wait for it to stop. "Auto-rotate" starts it again.
- **Reset to original** (Patient card, shown while inputs are modified): undo what-if edits for the loaded patient.
- **Held-out results** (model version above): the models' predictions match the dataset labels for 39 of 48 targets.

| Sample | Dataset labels | Estimates (CAD · LAD · LCX · RCA) | Match |
|---|---|---|---|
| A · 60 y, male | CAD; LAD, LCX and RCA stenotic | >99% · 55% · 58% · 49% | 3 of 4 (RCA: 49% is under the threshold) |
| B · 56 y, male | CAD; LAD and LCX stenotic | >99% · 82% · 46% · 40% | 3 of 4 (LCX) |
| C · 62 y, female | CAD; LAD stenotic | 86% · 55% · 30% · 40% | 4 of 4 |
| D · 71 y, female | CAD; LCX stenotic | >99% · 73% · 47% · 91% | 1 of 4 (LAD, LCX, RCA) |
| G · 67 y, female | CAD; LAD and RCA stenotic | >99% · 66% · 47% · 37% | 3 of 4 (RCA) |
| H · 48 y, male | CAD; RCA stenotic | 97% · 51% · 38% · 27% | 2 of 4 (LAD, RCA) |
| E · 50 y, male | Normal | 91% · 45% · 34% · 8% | 3 of 4 (CAD) |
| F · 50 y, male | Normal | 41% · 31% · 30% · 14% | 4 of 4 |
| I · 52 y, male | Normal | 13% · 15% · 24% · 13% | 4 of 4 |
| J · 40 y, male | Normal | 7% · 20% · 15% · 7% | 4 of 4 |
| K · 41 y, female | Normal | 20% · 37% · 16% · 27% | 4 of 4 |
| L · 48 y, female | Normal | 19% · 17% · 11% · 3% | 4 of 4 |

Twelve patients are an illustration, not an evaluation; the performance numbers are the cross-validated ones.

**Before any demo or recording:**
1. `python -m ml.train` has been run; `/api/health` returns 200.
2. Backend and frontend running; browser zoom 100%; window ≥ 1280 px wide.
3. Other GPU-heavy apps closed; notifications off.
4. One full dry run of §2 with zero console errors.

## 2. Live demo script (about 3 minutes)

| Time | Action | Say (short) | Shows |
|---|---|---|---|
| 0:00 | App open on Home; then **Open the analysis** | "A risk percentage doesn't tell you which artery a model is worried about. CardioLens maps four model estimates onto the vessels they describe." Point at the banner: "Educational decision support, not diagnosis." | Problem clarity, SAFE-1 |
| 0:15 | Point to the CAD gauge and the vessel list | "Overall CAD, plus LAD, LCX and RCA — each from its own model, each colored on its own artery. The mark on the gauge is the 50% threshold." Read the legend note. | DASH-1, VIS-2 |
| 0:30 | Rotate, zoom, press **Back** | "LCX and RCA run around the side and bottom, so the view presets help." Hover an artery → tooltip. | VIS-1, VIS-3 |
| 0:45 | Click the **LCX** row (suggested: its explanation differs most from the CAD one) | "Clicking a vessel opens that vessel's explanation." Sample A: LAD 55%, LCX 58%, RCA 49%. Largest factor per vessel: LAD ejection fraction (55%, lowers the estimate), LCX creatinine (1.5 mg/dL, 96th percentile), RCA diabetes mellitus | DIFF-3 |
| 1:00 | Read the explanation | "These are SHAP contributions: what pushed this estimate up or down, with the patient's value and where it sits in the dataset." | DASH-2, DASH-3 |
| 1:20 | Switch the top quick control, **Typical chest pain**, off | "What-if: the colors, probabilities and explanations update live. This is model sensitivity, not a treatment effect." Sample A: LAD 55% → 47% and its status becomes "Stenosis not predicted"; LCX 58% → 54%; RCA 49% → 36%; CAD >99% → 98%. Then **Reset to original**. | DIFF-1, real-time integration |
| 1:40 | Open **Patients**; choose **Sample J** | "Twelve patients the models have never seen. Angiography found coronary disease in six of them and none in the other six. Each card already shows what the models estimate." Point at Sample E (label Normal, ring at 91%: a miss in plain sight). Sample J: CAD 7%, teal arteries. | F1, patients without CAD |
| 1:55 | Toggle **Show dataset angiography result**; then **Choose another patient** → **Sample D** | "For Sample J all four predictions match what angiography recorded. For Sample D only one does: the model predicts LAD and RCA stenosis where the dataset says Normal, and misses the LCX — and the app shows that too." (39 of 48 across the twelve.) | DIFF-2 |
| 2:15 | Open **New patient**; change Age; press **Analyse this patient** | "Or enter a patient of your own: fifty-four inputs, starting from typical values. Values outside the dataset's range are refused before anything is sent." | F2 |
| 2:35 | Open **Model & method** | "Repeated stratified 5-fold cross-validation, mean ± std, against a baseline, with the label columns excluded from every model." | PM-4, PM-5 |
| 2:55 | Close | "Four models, one heart, every estimate explained — for education and decision support." | — |

## 3. YouTube video (target ~6 min; allowed 3–10)

Requirements (SG 3, PS): shows the project **running**, explains the approach, covers the input workflow, 3D interactions and technical implementation; English voice-over (+ subtitles if possible); **Unlisted**, not private.

| Segment | Length | Content |
|---|---|---|
| 1. Hook and problem | 0:30 | Why a bare risk number is not enough; disclaimer on screen |
| 2. What CardioLens does | 0:30 | The Home page (headline, turning heart, the four numbers), then the three-panel layout of the Analysis page |
| 3. Input workflow | 0:50 | Patients page (two groups, a patient without CAD); New patient page: typical values, edit a field, validation message on a bad value, "Analyse this patient" |
| 4. 3D interactions | 0:45 | Rotate, zoom, presets, hover, click-to-select, legend note |
| 5. Explanations | 0:40 | Per-vessel SHAP, values, percentiles, summary |
| 6. What-if + ground truth | 0:45 | Live update, deltas, reset; reveal on held-out samples, a hit and a miss |
| 7. Technical implementation | 1:30 | Architecture diagram (ARCHITECTURE §1); leakage guard; repeated CV and model selection; SHAP grouping of one-hot features; one target-id key across API and 3D; 3D performance choices |
| 8. Results | 0:30 | Real metrics table from the Model & method page — no rounding up, no cherry-picking. Say both sides: CAD ROC-AUC 0.917 ± 0.037; the vessel models are weaker, LCX 0.726 ± 0.076 and RCA 0.728 ± 0.057 |
| 9. Limitations and close | 0:20 | PRODUCT_SPEC §9.4 in brief; thank you |

### 3.1 Narration draft (T11.3)

A draft for Satvik to put into his own words; about 900 words, a little over six minutes at a calm pace. Every number is from the running app or from `backend/artifacts/metrics.json` (model version above). Record at 100% zoom in a window at least 1280 px wide, after one dry run with the console open.

**1. Hook and problem** (app open on Home)
"A model that says 'ninety-nine percent risk of coronary artery disease' leaves out two things a reader needs: which artery is the model concerned about, and why. This is CardioLens, my project for Track A. One thing first, and it stays on screen the whole time: this is an educational and decision-support prototype. It is not a diagnosis."

**2. What it does** (press "Open the analysis"; move the pointer across the three columns)
"This is the analysis of one patient. On the left is the patient's routine clinical data. On the right are four model estimates: coronary artery disease overall, and a narrowing of fifty percent or more in the LAD, the LCX and the RCA. In the middle is a 3D heart, and each of those three arteries takes the colour of its own estimate."

**3. Input workflow** (Patients page; choose Sample J; then New patient: change Age; type 200 into Age; correct it; "Analyse this patient")
"Where do the patients come from? Twelve sample patients are built in. They were set aside before training, so the models have never seen them. Angiography found coronary disease in six of them and none in the other six, and every card already shows what the models estimate. This is Sample J, one of the six without coronary disease: seven percent, and the arteries are teal. I can also enter a patient of my own on a separate page: fifty-four inputs, in five groups, from demographics to echo findings, each starting from a typical value. Every value is checked first. An age of 200 is outside the range seen in the dataset, so the field says so and the patient cannot be analysed. With a valid value, one click opens the analysis."

**4. 3D interactions** (Reset demo; drag, scroll, hover the LAD; click the LCX row; read the legend)
"The heart has the colours of a heart; they carry no estimate. Each artery, with its branches, carries the colour of its own estimate, and a rim of its own colour, blue for the LAD, magenta for the LCX and green for the RCA, so that the three can be told apart even when their estimates are alike. I can rotate and zoom the heart. Hovering an artery or one of its branches shows its name and estimate, and a click selects it. The trunk of the circumflex artery runs behind the heart, so choosing LCX in the list turns the heart to the back. The legend says what the colour means: the estimated probability for that artery. It does not show where along the artery a narrowing might be. The dataset has no such information, so the app does not pretend to."

**5. Explanations** (LCX selected; scroll the explanation; "Show all")
"Selecting a vessel opens that vessel's explanation. These are SHAP contributions: which inputs pushed this estimate up or down, with the patient's value, its unit and where it lies among the training patients. For this patient's LCX the largest factor is creatinine: 1.5 milligrams per decilitre, the ninety-sixth percentile. The sentence on top is filled from a template, not written by a language model."

**6. What-if and dataset labels** (Reset demo; switch Typical chest pain off; Reset to original; tick "Show dataset angiography result"; Patients → Sample J; Patients → Sample D)
"The quick controls hold the eight inputs that matter most to the four models. If I switch typical chest pain off, everything updates together. The LAD estimate goes from 55 to 47 percent, and its status changes to 'stenosis not predicted'. This is how the model responds to a changed input. It is not the effect of a treatment. And if an edit creates a patient that cannot exist, say a weight that no longer matches the body mass index, the app points that out. Now the angiography labels from the dataset. For Sample J, the patient without coronary disease, all four predictions match. For Sample D only one does: the model predicts a narrowing in the LAD, at 73 percent, and in the RCA, at 91 percent, where the dataset says normal, and it misses the LCX. Across the twelve patients, 39 of 48 predictions match. The app shows its misses as plainly as its hits."

**7. Technical implementation** (Model & method page, method box; then the architecture diagram of ARCHITECTURE §1 or the report's page 5)
"How it is built. The dataset is the Z-Alizadeh Sani dataset from the UCI repository: 303 patients. There are four separate models, one per target. The four angiography columns are never inputs to any model; the code refuses to train if one appears, and tests check it. For each target I compare logistic regression, a random forest and gradient boosting against a baseline, with repeated stratified five-fold cross-validation, 25 folds, and the preprocessing refitted inside every fold. Nothing is tuned, because with 291 training rows a search would mostly fit noise. A FastAPI service loads the models once and returns four probabilities and four explanations per request. The same four ids, cad, lad, lcx and rca, run through the training code, the API and the names of the 3D objects, and that keeps each estimate on the right artery. The heart is built from 44 BodyParts3D anatomy parts into one file of 0.66 megabytes, and the build checks that every branch springs from the artery whose colour it takes. It draws a frame in under two milliseconds on this laptop's integrated graphics."

**8. Results** (Model & method page, the two tables, then the plots)
"The results, as measured. The overall model reaches a ROC-AUC of 0.917, plus or minus 0.037. The vessel models are weaker: 0.851 for the LAD, 0.726 for the LCX and 0.728 for the RCA, against 0.5 for the baseline. At the 0.5 threshold the LCX model finds only 43 percent of the stenotic vessels, and the RCA model 54 percent. Routine findings say much more about whether a patient has coronary disease than about which artery is affected. This page shows every candidate, the baseline and the calibration plots."

**9. Limitations and close** (scroll to Limitations; back to Analysis)
"The limits: 303 patients from one dataset, recorded findings and not raw ECG or imaging, and estimates per artery with no location inside it. The inputs are typed in or taken from a sample; reading them from an uploaded report is future work. CardioLens is for education and decision support. The code, the trained models and a five-page report are in the repository. Thank you."

Before recording: the heart model's full credit and licence must be in the app's footer and credits, because both are on screen in this video.

## 4. Manual end-to-end checklist (T9.3 and before recording)

- [ ] Backend starts; `/api/health` → 200
- [ ] Frontend boots on Home with the turning heart in Sample A's colours; "Open the analysis" shows Sample A; zero console errors
- [ ] The theme switch turns every page dark and light again; the plots on Model & method stay readable
- [ ] "Take the tour" lights the six parts of the Analysis page in turn; Escape ends it
- [ ] Patients page: twelve cards in two groups of six, each with a ring and three bars (table in §1); "Show" narrows to one group; the patient in analysis is marked "In analysis"
- [ ] Samples A–L each open their analysis; 3D colors match the % in the results panel (table in §1)
- [ ] New patient page: starts from typical values; "Start from" fills in a sample; an invalid value → field error and a disabled button; "Analyse this patient" opens the analysis of "Your patient"
- [ ] The browser's Back and Forward buttons move between the five pages; the patient in analysis stays
- [ ] The heart turns once on arrival and stops when touched; hover and click each artery; list ↔ 3D selection stays in sync; keyboard selection works
- [ ] Explanation panel switches per target; "Show all" works; pointing at an input opens its details
- [ ] Quick control edit updates within ~0.5 s; deltas correct; Reset to original works
- [ ] Invalid input on the Analysis page → field error and no request; fixing it resumes updates
- [ ] Ground-truth toggle appears only for unmodified samples, not for a patient of one's own
- [ ] Model & method page shows metrics and plots
- [ ] Disclaimer banner on all five pages; CAD caption and legend note present
- [ ] Backend stopped → boot/predict error states; restart + Retry recovers
- [ ] Heart file missing → proxy heart + notice
- [ ] WebGL disabled → 2D schematic
- [ ] Smooth rotation on integrated graphics; usable with CPU throttled 4×
- [ ] Reset demo restores the initial state

## 5. Wording

Follow PRODUCT_SPEC §9.6. Say "estimate", "probability", "model predicts", "dataset label". Never say "diagnoses", "detects blockages", "shows where the blockage is", "clinically validated". Call the six samples without disease "patients with the dataset label Normal" or "patients in whom angiography found no narrowing of 50% or more". Avoid "healthy": the dataset says nothing else about them.

## 6. Q&A preparation (answer from real results only)

| Likely question | Answer outline |
|---|---|
| How did you prevent target leakage? | LAD, LCX, RCA and Cath are excluded from every model's inputs; enforced in code and by a test; the dataset's own note requires it |
| Why trust metrics from 303 patients? | Repeated stratified 5-fold CV (25 folds), mean ± std, baseline comparison, preprocessing inside folds, twelve held-out patients never seen in training |
| How were the sample patients chosen? | Before training, by a fixed rule with seed 42: the number of stenotic vessels each must have is fixed (six with disease, six without), and the seed picks the patient. None was chosen by how the model does on it; the misses are shown |
| Why these models? | Simple, well-understood models with exact SHAP explainers; fixed defaults, no tuning, to avoid overfitting a small dataset |
| Does the color show where the blockage is? | No. It shows each artery's estimated probability of ≥50% narrowing; the dataset has no location within an artery |
| What if CAD and vessel models disagree? | They are separate models; we show a neutral note instead of altering probabilities |
| How do outputs stay matched to the right artery? | One target-id key through API, artifacts, registry and 3D object names, checked by tests |
| Why SHAP, not LIME? | Exact, additive explanations for linear and tree models; one-hot parts sum back to the original feature |
| Why is the gauge's arc one colour, not green to red? | The colour is the estimate's own colour on the one risk scale that the arteries, the legend and the bars share; a rainbow arc would be a second scale. The scale gets darker with risk, so it reads without telling red from green |
| Can it read a medical report? | Not yet. The inputs are typed in or taken from a sample. Reading an uploaded report would need text recognition and a reliable mapping to the 54 inputs, with every value confirmed by the user; it is listed as future work |
