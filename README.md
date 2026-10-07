# CardioLens

**Coronary risk estimates, mapped to the vessels they describe.**

> Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.

Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction.

**Status:** in development. This README is a skeleton: setup, run and results sections are filled in as each part is built (BUILD_MAP T10.3 completes it).

## What it is

CardioLens is a web app for educational decision support. From a patient's routine clinical data it:

1. estimates the probability of overall coronary artery disease (CAD) and of ≥50% narrowing in three coronary arteries (LAD, LCX, RCA), using four separate models;
2. colors those arteries on an interactive 3D heart by their estimated probabilities;
3. explains each estimate with the patient's measurements and their relative contributions (SHAP);
4. lets you change values and see how the estimates respond (what-if);
5. reports cross-validated model performance and how the models did on held-out patients.

## Prerequisites

- Python 3.13
- Node.js LTS with npm (developed with Node 22)
- Git

## Setup

Commands are for Windows PowerShell, run from the repository root.

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

macOS/Linux: `python3.13 -m venv .venv` and `source .venv/bin/activate` instead.

Frontend:

```powershell
cd frontend
npm install
```

## Train the models

The trained models and their metrics are already in `backend/artifacts/`, so this step is only needed to reproduce them.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m ml.inspect_data
python -m ml.train
```

`ml.inspect_data` writes a factual report about the dataset file (`backend/artifacts/data_report.md`). `ml.train` runs the whole pipeline in about a minute on a laptop CPU: it holds out six sample patients, cross-validates three candidate models per target, refits the selected one and writes the models, metrics, plots and schema. Seeds are fixed, so a rerun reproduces the same metrics and predictions.

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

`http://localhost:8000/api/health` answers 200 once the models are loaded. If the artifacts are missing or were trained with another scikit-learn version, the server still starts and answers 503 with the reason.

## Run the frontend

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 with the backend running. The dev server forwards `/api` and `/static` to the backend on port 8000. The first sample patient loads by itself; pick another sample or edit any input and the estimates, the artery colours and the explanations update. Drag the heart to rotate it, scroll to zoom, and click an artery (or its row in the list) to see that vessel's explanation.

- **What-if.** The quick controls hold the eight inputs that matter most to the four models on average. Change one and each estimate shows how it moved ("58% → 51%, −7 pp"); "Reset to original" brings the loaded patient back. This shows how the model responds to changed inputs, not the effect of any treatment.
- **Dataset labels.** For an unmodified sample patient, "Show dataset angiography result" puts the dataset's label next to each estimate, with a mark for whether the model's prediction matches it. The six sample patients were never used for training or validation.
- **Model & method.** The second tab shows how the models were validated: the method, the cross-validated metrics of every candidate and the baseline, the ROC, calibration and confusion plots, the most important inputs per target, the limitations and the credits.

## Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

```powershell
cd frontend
npm run test
npm run build
```

The backend suite takes about 40 seconds: besides the unit and API tests it trains all four models once, with a single repeat of the cross-validation, into a temporary folder, and checks that the API can serve the result. It never writes to `backend/artifacts/`. The frontend tests run against a mocked API and need no backend.

## Project structure

```text
CardioLens/
├── README.md
├── docs/               # specification
├── backend/
│   ├── data/raw/       # dataset .xlsx
│   ├── ml/             # offline training pipeline
│   ├── app/            # FastAPI service
│   ├── artifacts/      # trained models, metrics, plots (generated, committed)
│   └── tests/
└── frontend/
    ├── public/models/  # optimized heart asset
    └── src/            # api, config, state, components, scene
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

## Attributions

**Dataset.** Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K — licensed under CC BY 4.0.
Dataset page: https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset

**3D heart model.** No third-party model is used yet: the heart is a stylised stand-in shape generated in code (`frontend/src/scene/heartShape.ts`), and the artery courses are schematic. An open-licensed mesh will be credited here, with author, source URL and license, when it replaces the stand-in.

## Limitations

- Trained on 303 patients from one public research dataset; performance on other populations is unknown.
- Inputs are recorded clinical findings, not raw ECG, echo or imaging data.
- Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.
- Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).
- What-if changes show model sensitivity, not the effect of any treatment.

## Documentation

The full specification is in [`docs/`](docs/): [problem analysis](docs/PROBLEM_ANALYSIS.md) · [product spec](docs/PRODUCT_SPEC.md) · [architecture](docs/ARCHITECTURE.md) · [API contract](docs/API_CONTRACT.md) · [data model](docs/DATA_MODEL.md) · [build map](docs/BUILD_MAP.md) · [demo flow](docs/DEMO_FLOW.md)
