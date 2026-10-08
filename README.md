# CardioLens

**Coronary risk estimates, mapped to the vessels they describe.**

> Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.

Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction.

## What it is

CardioLens is a web app for educational decision support. From a patient's routine clinical data it:

1. estimates the probability of overall coronary artery disease (CAD) and of ≥50% narrowing in three coronary arteries (LAD, LCX, RCA), using four separate models;
2. colors those arteries on an interactive 3D heart by their estimated probabilities;
3. explains each estimate with the patient's measurements and their relative contributions (SHAP);
4. lets you change values and see how the estimates respond (what-if);
5. reports cross-validated model performance and how the models did on held-out patients.

## How it works

```text
Browser (React, three.js)  ──  /api  ──►  FastAPI service  ──►  4 scikit-learn models + SHAP explainers
   input form · 3D heart · results            validation · prediction        loaded once from backend/artifacts/
```

- **Offline step.** `python -m ml.train` reads the dataset, holds out six sample patients, cross-validates the candidate models, and writes the models, metrics, plots and input schema to `backend/artifacts/`.
- **At run time** the service loads those files once and answers one kind of question: the four probabilities and their explanations for one patient record. The form in the browser is built from the schema the service sends, so the two cannot drift apart.
- **One id per target** (`cad`, `lad`, `lcx`, `rca`) runs through the training code, the artifact files, the API and the names of the 3D objects, and tests check that they match.
- **Everything is local.** The app makes no calls to other services, and patient inputs are not stored or logged anywhere.

## Prerequisites

- Python 3.13
- Node.js 22.12 or newer with npm (developed with Node 22.16)
- Git

Developed and tested on Windows 11. The macOS / Linux commands below are the standard equivalents and have not been run on those systems.

## Setup

Run these once, from the repository root.

### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
cd ..\frontend
npm install
```

### macOS / Linux

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cd ../frontend
npm install
```

The trained models, their metrics and the 3D heart model are already in the repository, so nothing has to be trained or built before the first run.

## Run the app

Use two terminals, both starting at the repository root. Start the backend first.

**Terminal 1: backend** (Windows PowerShell)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8000
```

macOS / Linux: `cd backend`, `source .venv/bin/activate`, then the same `uvicorn` command.

`http://localhost:8000/api/health` answers 200 once the models are loaded, a few seconds after the start.

**Terminal 2: frontend** (any system)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` and `/static` to the backend on port 8000.

To serve the optimized build instead, run `npm run build` and then `npm run preview` in `frontend`, and open http://localhost:4173.

## Using the app

The first sample patient loads by itself. Pick another sample or edit any input, and the estimates, the artery colours and the explanations update.

- **3D heart.** Drag to rotate, scroll to zoom, and click an artery (or its row in the list) to see that vessel's explanation; a click on the heart selects the overall CAD estimate. The view buttons turn the heart to the front, back, left or right. The circumflex artery runs behind the heart, so its label appears from the back.
- **What-if.** The quick controls hold the eight inputs that matter most to the four models on average. Change one and each estimate shows how it moved ("58% → 51%, −7 pp"); "Reset to original" brings the loaded patient back. This shows how the model responds to changed inputs, not the effect of any treatment.
- **Dataset labels.** For an unmodified sample patient, "Show dataset angiography result" puts the dataset's label next to each estimate, with a mark for whether the model's prediction matches it. The six sample patients were never used for training or validation.
- **Model & method.** The second tab shows how the models were validated: the method, the cross-validated metrics of every candidate and the baseline, the ROC, calibration and confusion plots, the most important inputs per target, the limitations and the credits.
- **Reset demo** in the header returns to the first sample and the starting view.

## Train the models

The trained models and their metrics are already in `backend/artifacts/`, so this step is only needed to reproduce them. Run it in `backend` with the environment activated.

```bash
python -m ml.inspect_data
python -m ml.train
```

`ml.inspect_data` writes a factual report about the dataset file (`backend/artifacts/data_report.md`). `ml.train` runs the whole pipeline in about a minute on a laptop CPU: it holds out six sample patients, cross-validates three candidate models per target, refits the selected one and writes the models, metrics, plots and schema. Seeds are fixed, so a rerun reproduces the same metrics and predictions; only the model version, which contains the time of the run, changes. Restart the backend afterwards.

## Rebuild the 3D heart model

The model is already in `frontend/public/models/heart.glb`, so this step is only needed to change it. It needs the folder of source anatomy parts (`.obj` files, not part of this repository) and Node.js. Run it from the repository root.

```powershell
backend\.venv\Scripts\python.exe tools\heart_model\build_heart.py --source "<folder with the .obj files>"
```

macOS / Linux: `backend/.venv/bin/python tools/heart_model/build_heart.py --source "<folder with the .obj files>"`.

The script selects the outside of the heart and the coronary arteries, places them in the viewer's axes and scale, traces the centre line of each artery, and writes the model together with `frontend/src/scene/heartModelData.ts`. Its last step runs glTF-Transform 4.5.1 through `npx` (downloaded on first use) to weld, simplify and compress the model. A rebuild from the same parts gives the same two files, byte for byte. The frontend tests load the model file and fail if it and the data file do not match.

## Tests

Backend, in `backend` with the environment activated:

```bash
pytest
```

Frontend, in `frontend`:

```bash
npm run test
npm run build
```

The backend suite takes about a minute: besides the unit and API tests it trains all four models once, with a single repeat of the cross-validation, into a temporary folder, and checks that the API can serve the result. It never writes to `backend/artifacts/`. The frontend tests run against a mocked API and need no backend; `npm run build` also type-checks the code.

## Project structure

```text
CardioLens/
├── README.md
├── docs/                # specification: problem analysis, product spec, architecture, API, data model, build map
├── tools/heart_model/   # builds the 3D heart model from the source anatomy parts
├── backend/
│   ├── requirements.txt # pinned versions
│   ├── data/raw/        # dataset .xlsx
│   ├── ml/              # offline pipeline: dataset, preprocessing, models, evaluation, explanations, training
│   ├── app/             # FastAPI service: schemas, validation, artifact registry, predictor
│   ├── artifacts/       # trained models, metrics, plots, schema, sample patients (generated, committed)
│   └── tests/
└── frontend/
    ├── public/models/   # heart.glb: the heart and coronary arteries (generated, committed)
    └── src/
        ├── api/         # the one place that talks to the backend
        ├── config/      # copy, risk colours, vessel registry
        ├── state/       # boot, analysis state machine, input validation
        ├── components/  # layout, patient input, results, evaluation tab
        └── scene/       # 3D viewer, heart model, arteries, labels, 2D fallback
```

## Model summary

Four separate classifiers, one per target, trained on 297 patients (six more are held out as demo patients and never used for training or validation). Each model sees the same 54 clinical inputs. The four angiography columns (`LAD`, `LCX`, `RCA`, `Cath`) are never inputs to any model; the code refuses to train if one appears.

For each target, logistic regression, random forest and gradient boosting are compared with repeated stratified 5-fold cross-validation (5 repeats, 25 folds), with preprocessing refitted inside every fold. The model with the highest mean ROC-AUC is selected, except that logistic regression is preferred when it is within 0.01 of the best. No hyperparameters are tuned.

Cross-validated results of the selected models (mean ± standard deviation over 25 folds, threshold 0.5), from `backend/artifacts/metrics.json`, model version `20261007T1423Z-7393432`:

| Target | Selected model | Positive / negative | ROC-AUC | Accuracy | Precision | Recall | Specificity | F1 | Brier |
|---|---|---|---|---|---|---|---|---|---|
| CAD | Logistic regression | 212 / 85 | 0.917 ± 0.033 | 0.860 ± 0.031 | 0.908 ± 0.034 | 0.896 ± 0.044 | 0.769 ± 0.096 | 0.901 ± 0.023 | 0.104 ± 0.019 |
| LAD | Random forest | 174 / 123 | 0.855 ± 0.053 | 0.789 ± 0.064 | 0.784 ± 0.064 | 0.892 ± 0.051 | 0.643 ± 0.130 | 0.833 ± 0.048 | 0.161 ± 0.019 |
| LCX | Random forest | 116 / 181 | 0.739 ± 0.056 | 0.675 ± 0.046 | 0.653 ± 0.116 | 0.396 ± 0.088 | 0.854 ± 0.075 | 0.485 ± 0.076 | 0.204 ± 0.011 |
| RCA | Logistic regression | 113 / 184 | 0.725 ± 0.045 | 0.672 ± 0.049 | 0.581 ± 0.076 | 0.526 ± 0.093 | 0.762 ± 0.071 | 0.547 ± 0.070 | 0.215 ± 0.026 |

A baseline that always predicts the class prior scores ROC-AUC 0.500 on every target. The vessel-level models, LCX and RCA in particular, are much weaker than the overall CAD model: at the 0.5 threshold their recall is only 0.40 and 0.53. `metrics.json` also holds the other candidates, the baseline and the global feature importances, and `backend/artifacts/plots/` holds the ROC, calibration and confusion plots.

Each prediction is explained with SHAP values (exact explainers for linear and tree models), summed back to the original clinical features.

## Performance

Measured on 2026-10-08 on the development laptop: AMD Ryzen 7 5800HS with integrated Radeon graphics (no separate graphics card), 16 GB of memory, Windows 11, Chromium 152.

| What | Measured | Target |
|---|---|---|
| One prediction with four explanations, from the browser | median 80 ms, 95th percentile 85 ms (50 calls) | 95th percentile under 300 ms |
| First estimates on screen after opening the page (optimized build) | about 0.13 s | under 3 s |
| Drawing one frame of the 3D heart while it turns | median 1.1 ms, slowest 5.6 ms (240 frames); zoomed in: median 1.5 ms | 16.7 ms for 60 frames per second |
| 3D scene | 6 draw calls, about 92,000 triangles, 3 lights, no textures or shadows | under 50 draw calls, under 150,000 triangles |
| Preparing the heart model after its download | about 50 ms | — |
| Downloads | page code 278 kB (87 kB compressed), 3D viewer code 1.03 MB (280 kB compressed, loaded after the page is usable), heart model 0.65 MB | heart model under 5 MB |

The frame time is the time to draw a frame and wait for the graphics card to finish it, measured inside the page. The frame rate seen on screen was not measured, because the browser used for these measurements limits how often it redraws.

## Configuration

The defaults need no configuration. Three settings exist for other setups:

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `ALLOWED_ORIGINS` | backend | `http://localhost:5173` | Comma-separated origins that may call the API from a browser |
| `ARTIFACTS_DIR` | backend | `backend/artifacts` | Folder the models and metrics are loaded from |
| `VITE_API_BASE_URL` | frontend, at build time | `/api` | Base URL of the API |

## Troubleshooting

- **"Can't reach the CardioLens model service."** The backend is not running, or is still loading the models. Start it (Terminal 1 above) and press Retry.
- **"Model service not ready: …"** The backend started but cannot use the files in `backend/artifacts/`; the message says why. Usually the installed scikit-learn differs from the pinned version: run `pip install -r requirements.txt` again, or retrain with `python -m ml.train`.
- **PowerShell refuses to run `Activate.ps1`.** Skip the activation and call the environment's Python directly: `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, and likewise `.\.venv\Scripts\python.exe -m pytest`.
- **"Port 5173 is already in use."** Another program, or an earlier `npm run dev`, holds the port. Close it; the frontend is set to use exactly this port.
- **A flat drawing of the heart instead of the 3D model.** The browser could not start 3D graphics, so the app shows a 2D schematic with the same colours and the same selection. Hardware acceleration may be switched off in the browser's settings.
- **"Detailed heart model unavailable."** `frontend/public/models/heart.glb` could not be loaded; the app draws a simpler stand-in heart and keeps working.

## Attributions

**Dataset.** Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K — licensed under CC BY 4.0.
Dataset page: https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset

**3D heart model.** The heart and the coronary arteries in `frontend/public/models/heart.glb` are built from BodyParts3D anatomy parts (one file per anatomical structure, named with its FMA id) by `tools/heart_model/build_heart.py`. **The full credit, source URL and licence of the model are still to be added here**, and in the app's footer and credits, before this repository is published with the model.

The model is a reference anatomy, not a patient's heart. Only the trunks of the three vessels the models estimate (LAD, LCX, RCA) take the risk colour; the left main stem and the branches are drawn in grey. If the model file cannot be loaded, the app draws a stylised stand-in heart generated in code (`frontend/src/scene/heartShape.ts`) instead.

**Libraries.** scikit-learn, SHAP, pandas, NumPy, FastAPI and Uvicorn in the backend; React, Vite, Tailwind CSS, three.js, React Three Fiber and drei in the frontend. Versions are pinned in `backend/requirements.txt` and `frontend/package.json`.

## Disclaimer

CardioLens is an educational and decision-support prototype built for a hackathon. Its estimates come from models trained on 303 patients of one public research dataset and have not been validated for clinical use. They are not a diagnosis, and they are not a substitute for clinical evaluation or for diagnostic imaging such as coronary angiography. The colour of an artery shows the model's estimated probability for that artery; it does not show where along the artery a narrowing might be. The 3D heart is a reference anatomy, not the patient's heart.

## Limitations

- Trained on 303 patients from one public research dataset; performance on other populations is unknown.
- Inputs are recorded clinical findings, not raw ECG, echo or imaging data.
- Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.
- Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).
- What-if changes show model sensitivity, not the effect of any treatment.

## Documentation

The full specification is in [`docs/`](docs/): [problem analysis](docs/PROBLEM_ANALYSIS.md) · [product spec](docs/PRODUCT_SPEC.md) · [architecture](docs/ARCHITECTURE.md) · [API contract](docs/API_CONTRACT.md) · [data model](docs/DATA_MODEL.md) · [build map](docs/BUILD_MAP.md) · [demo flow](docs/DEMO_FLOW.md)
