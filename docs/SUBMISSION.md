# Devpost submission

**Status:** draft for Satvik (T11.5) · **Date:** 2026-10-08

The text below is a draft of the project description. Every fact in it is taken from the running app, from `backend/artifacts/metrics.json` (model version `20261007T1423Z-7393432`) or from the README. The parts marked **(yours)** need Satvik's own words or a link that does not exist yet.

---

## 1. Fields

| Field | Value |
|---|---|
| Project name | CardioLens |
| Tagline | Coronary risk estimates, mapped to the vessels they describe. |
| Track | Track A: Cardiovascular Risk Visualization & Prediction |
| Repository | https://github.com/satvikchauhan01/CardioLens |
| Video | **(yours)** YouTube link, Unlisted or Public, not Private |
| Report | `docs/CardioLens_Report.pdf` in the repository (5 pages) |
| Team | **(yours)** real full name; your Devpost account added to the submission |
| Built with | python, scikit-learn, shap, fastapi, pandas, react, typescript, three.js, react-three-fiber, vite, tailwindcss |
| Image | `docs/images/app_overview.jpg`; more in `docs/images/` |

## 2. Project description

### What it is

CardioLens is a web app for education and decision support. From one patient's routine clinical data it estimates the probability of coronary artery disease (CAD) overall and of a narrowing of 50% or more in each of the three main coronary arteries: LAD, LCX and RCA. It shows each estimate on the artery it belongs to, on an interactive 3D heart, and explains it with the patient's own measurements.

It is a prototype trained on a small public research dataset. Its estimates are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.

### The problem

A single risk number does not say which artery a model is concerned about, or why. The track asks for three things in one tool: vessel-level prediction, a 3D view of where the risk belongs, and an explanation a reader can follow. **(yours)** One or two sentences on why you chose this track.

### What it does

- **Four estimates from four models.** Overall CAD, LAD, LCX and RCA, each from its own classifier on the same 54 clinical inputs: demographics and history, symptoms and examination, ECG findings, laboratory values and echo findings.
- **A 3D heart that carries the estimates.** The three arteries take the colour of their estimated probability. Rotate, zoom, hover for a tooltip, click an artery to select it. The legend says what the colour means and what it does not: it is the probability for that artery, not the place of a narrowing.
- **An explanation per vessel.** SHAP contributions for the selected target, with each input's value, unit, percentile among the training patients and share of the total contribution, and a short summary filled from a template.
- **What-if.** Change an input and the estimates, the artery colours and the explanations update together in about half a second, with "before → after" on every estimate. The app says that this shows how the model responds, not the effect of a treatment.
- **Held-out patients with their real labels.** Six sample patients were set aside before training. The app can put the dataset's angiography label next to each estimate, with a mark where the model is wrong.
- **An evaluation page.** Cross-validated metrics for every candidate model and a baseline, ROC, calibration and confusion plots, the most important inputs per target, and the limitations.

### How it works

- **Data.** The UCI "extention of Z-Alizadeh sani dataset": 303 patients, 59 columns, CC BY 4.0. Six patients are held out as sample patients; the other 297 are the training rows.
- **Leakage guard.** The four angiography columns (`LAD`, `LCX`, `RCA`, `Cath`) are never inputs to any model. The guard is in the data loader, the preprocessor, the trainer and the API's start-up check, and tests cover each place.
- **Models and validation.** For each target, logistic regression, a random forest and gradient boosting are compared against a baseline with repeated stratified 5-fold cross-validation (5 repeats, 25 folds), with the preprocessing refitted inside every fold. Nothing is tuned. Seeds and versions are fixed, and one command retrains everything in about a minute.
- **Service.** A FastAPI service loads the four models once and returns four probabilities and four SHAP explanations per request: median 80 ms from the browser on a laptop. Inputs are not stored or logged, and the app calls no outside service.
- **3D.** The heart is built from 44 BodyParts3D anatomy parts into one file of 0.65 MB with about 92,000 triangles. The arteries are that model's own meshes. The same four ids (`cad`, `lad`, `lcx`, `rca`) run through the training code, the API and the names of the 3D objects, and tests check that they match. The viewer draws a frame in about 1 ms on integrated graphics; without WebGL the app shows a 2D schematic instead.
- **Frontend.** React, TypeScript and React Three Fiber. The input form is built from the schema the service sends.

### Results

Cross-validated on 297 patients, mean ± standard deviation over 25 folds, at a threshold of 0.5:

| Target | Selected model | ROC-AUC | Recall | Specificity |
|---|---|---|---|---|
| CAD | Logistic regression | 0.917 ± 0.033 | 0.896 ± 0.044 | 0.769 ± 0.096 |
| LAD | Random forest | 0.855 ± 0.053 | 0.892 ± 0.051 | 0.643 ± 0.130 |
| LCX | Random forest | 0.739 ± 0.056 | 0.396 ± 0.088 | 0.854 ± 0.075 |
| RCA | Logistic regression | 0.725 ± 0.045 | 0.526 ± 0.093 | 0.762 ± 0.071 |

A baseline that always predicts the class prior scores 0.500 on every target. The overall model separates patients well. The vessel models are weaker, LCX and RCA above all: the same routine findings say much more about whether a patient has CAD than about which artery is affected. On the six held-out patients the 24 predictions match the dataset labels in 21 cases; six patients are an illustration, not an evaluation.

### What was hard

- **Keeping each estimate on the right artery.** One id per target from the training code to the 3D object names, with tests that load the shipped heart model and check each vessel's mesh.
- **Labels on a real anatomy.** The circumflex artery runs behind the heart. Labels are placed where an artery can be seen and hide when the heart covers it, and choosing a vessel in the list turns the heart to a view that shows it.
- **A small dataset.** With 297 training rows every design choice had to avoid fitting noise: no tuning, repeated cross-validation with the spread reported, a baseline next to every model, and the weaker results shown as they are.

**(yours)** Add or replace with what you found hardest.

### Limitations

- Trained on 303 patients from one public research dataset; performance on other populations is unknown.
- Inputs are recorded clinical findings, not raw ECG, echo or imaging data.
- Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.
- Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).
- What-if changes show model sensitivity, not the effect of any treatment.

### Credits

- Dataset: Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K. CC BY 4.0.
- 3D anatomy: BodyParts3D. **(yours)** The full credit, source address and licence are still to be added, here and in the app.
- Libraries: scikit-learn, SHAP, pandas, NumPy, FastAPI, Uvicorn, React, Vite, Tailwind CSS, three.js, React Three Fiber, drei.

## 3. Before pressing Submit

- [ ] The heart model's credit and licence are in the app's footer, the Model & method credits, the README and the report, and the report PDF has been rebuilt (`tools/report/build_report.py`).
- [ ] The last commit is pushed; the repository page opens in a private browser window (public).
- [ ] The video plays in a private browser window (Unlisted, not Private), is 3 to 10 minutes long, has English audio or subtitles, and shows the app running.
- [ ] Description pasted, repository and video links added, real full name on the team.
- [ ] Submitted before the deadline (planned: 18:00 IST on 14 October; check the exact time and time zone on the Devpost page).
- [ ] A screenshot of the confirmation is saved.
