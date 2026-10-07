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

_To be completed (T3.4)._

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Until the models are trained, `http://localhost:8000/api/health` answers 503 with the reason.

## Run the frontend

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` and `/static` to the backend on port 8000.

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

## Project structure

```text
CardioLens/
├── CLAUDE_RULES.md
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

_To be completed from `backend/artifacts/metrics.json` after training (T3.4). No results are reported before the models are trained._

## Attributions

**Dataset.** Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K — licensed under CC BY 4.0.
Dataset page: https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset

**3D heart model.** _To be added with author, source URL and license (T6.1)._

## Limitations

- Trained on 303 patients from one public research dataset; performance on other populations is unknown.
- Inputs are recorded clinical findings, not raw ECG, echo or imaging data.
- Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.
- Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).
- What-if changes show model sensitivity, not the effect of any treatment.

## Documentation

The full specification is in [`docs/`](docs/): [problem analysis](docs/PROBLEM_ANALYSIS.md) · [product spec](docs/PRODUCT_SPEC.md) · [architecture](docs/ARCHITECTURE.md) · [API contract](docs/API_CONTRACT.md) · [data model](docs/DATA_MODEL.md) · [build map](docs/BUILD_MAP.md) · [decisions](docs/DECISIONS.md) · [demo flow](docs/DEMO_FLOW.md)
