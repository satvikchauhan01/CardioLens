# Architecture

**Status:** v0.2 — approved by Satvik (T0.2); Python 3.13 per D-025 · **Date:** 2026-10-07
Related: PRODUCT_SPEC (behavior), API_CONTRACT (wire format), DATA_MODEL (data + artifacts), DECISIONS (why).

---

## 1. Overview

```text
┌────────────────────────── Browser: React SPA (Vite + TypeScript) ──────────────────────────┐
│  Input panel ──► analysis state (reducer) ──► Results panel + Explanation panel             │
│       ▲                │        ▲                          ▲                                │
│       │                ▼        │                          │ selectedTarget                 │
│  What-if controls   API client (fetch)               3D viewer (React Three Fiber, lazy)    │
└───────────────────────────┬─────────────────────────────────────────────────────────────────┘
                            │ HTTP + JSON  (dev: Vite proxy /api → :8000, same origin)
┌───────────────────────────▼─────────────────────────────────────────────────────────────────┐
│ Backend: FastAPI (Python 3.13)                                                              │
│  routes → validation (schema) → predictor (4 sklearn pipelines) → explainer (SHAP)          │
│  registry: loads artifacts once at startup, read-only                                       │
└───────────────────────────┬─────────────────────────────────────────────────────────────────┘
                            │ file reads at startup
┌───────────────────────────▼─────────────────────────────────────────────────────────────────┐
│ backend/artifacts/  (generated offline by `python -m ml.train`, committed to the repo)      │
│ models/{cad,lad,lcx,rca}.joblib · feature_schema.json · samples.json · metrics.json          │
│ reference_values.json · manifest.json · data_report.md · plots/*.png                         │
└───────────────────────────▲─────────────────────────────────────────────────────────────────┘
                            │ offline CLI (no server involved)
          ML training pipeline (backend/ml) ◄── backend/data/raw/extention of Z-Alizadeh sani dataset.xlsx
```

Two runtime processes (frontend dev server or static build, backend API) and one offline step (training). No database, no auth, no external services at runtime.

## 2. Components

### C1 — Frontend SPA
| Aspect | Specification |
|---|---|
| Responsibility | Layout, patient input, analysis state machine, results, explanations, what-if, Model & method tab, disclaimers |
| Inputs | User actions; `GET /api/meta`, `GET /api/samples`, `POST /api/predict`, `GET /api/metrics` |
| Outputs | Rendered UI; requests to the backend |
| Communication | `fetch` via `src/api/client.ts` (10 s timeout, error normalization) |
| Data format | JSON per API_CONTRACT; TS types in `src/api/types.ts` mirror it exactly |
| Dependencies | React, React DOM, Tailwind CSS, TypeScript, Vite |
| Failure behavior | Boot failure → `boot_error` screen with Retry; predict failure → `error` state keeps last good result labelled "Out of date"; invalid input → no request (PRODUCT_SPEC §6) |

### C2 — 3D rendering layer
| Aspect | Specification |
|---|---|
| Responsibility | Render heart + LAD/LCX/RCA; color by probability; hover/select; view presets; labels; legend |
| Inputs | `predictions` (per target probability), `selectedTarget`, `hoveredVessel`, reduced-motion flag |
| Outputs | Events `onSelectTarget(id)`, `onHoverVessel(id | null)` |
| Communication | React props/callbacks only (no direct API calls) |
| Data format | Vessel registry (`src/config/vessels.ts`) + path control points (`src/scene/arteryPaths.ts`) |
| Dependencies | three, @react-three/fiber, @react-three/drei |
| Failure behavior | Heart asset fails → error boundary renders `ProxyHeart` (simple shape) with the same arteries; WebGL unavailable → `VesselSchematic2D` (SVG) with the same colors and click behavior; loading → in-canvas loader |

### C3 — API client (inside C1)
| Aspect | Specification |
|---|---|
| Responsibility | One place for base URL, timeouts, JSON parsing, error mapping |
| Behavior | Non-2xx with error envelope → `ApiError {code, message, details}`; network failure/timeout → `ApiError {code: "NETWORK_ERROR"}`; never throws raw `Response` |
| Config | `VITE_API_BASE_URL` (default `/api`) |

### C4 — Backend API (FastAPI)
| Aspect | Specification |
|---|---|
| Responsibility | Serve metadata, samples, metrics, plots; validate inputs; run inference + explanation |
| Inputs | HTTP requests (API_CONTRACT); artifacts at startup |
| Outputs | JSON responses; static PNG plots |
| Communication | HTTP/JSON; Uvicorn ASGI server, single worker |
| Dependencies | fastapi, uvicorn, pydantic, plus C5 |
| Failure behavior | Artifacts missing/incompatible at startup → server still starts; `/api/health` returns 503 with reason; data endpoints return 503 `MODEL_UNAVAILABLE`. Validation failure → 422. Body > 16 KB → 413. Unexpected exception → 500 `INTERNAL_ERROR` without stack trace in the body |

### C5 — Inference & explanation module
| Aspect | Specification |
|---|---|
| Responsibility | Convert validated canonical inputs → model input row; predict 4 probabilities; compute grouped SHAP contributions, percentiles, summaries; agreement check |
| Location | `backend/app/predictor.py` (orchestration) + `backend/ml/explain.py` (shared with training) |
| Inputs | Validated `features` dict; loaded model bundles; reference values |
| Outputs | `PredictResponse` (API_CONTRACT §5) |
| Failure behavior | Any per-target failure fails the whole request with 500 (no partial results, so 3D never shows a mix of stale and fresh colors) |

### C6 — ML training pipeline (offline)
| Aspect | Specification |
|---|---|
| Responsibility | Load + normalize data; build feature schema; hold out samples; cross-validate candidates; select; fit final models; compute global importance; write artifacts + plots + manifest |
| Entry points | `python -m ml.inspect_data` (T2.1), `python -m ml.train` (T3.4) — run from `backend/` |
| Inputs | `backend/data/raw/extention of Z-Alizadeh sani dataset.xlsx` |
| Outputs | Everything in `backend/artifacts/` (DATA_MODEL §7) |
| Dependencies | pandas, openpyxl, numpy, scikit-learn, shap, matplotlib, joblib |
| Failure behavior | Fails fast with a clear message: file missing, unexpected columns, leakage-guard violation, label values outside expected set |

### C7 — Artifact storage
Plain files in `backend/artifacts/`, committed to git (model weights are a required deliverable). Read-only at runtime. `manifest.json` records library versions; the API refuses to load models if the installed scikit-learn version differs from the training version (pickled models are version-sensitive).

### C8 — Database: none
No requirement needs persistence. Predictions are computed per request in memory. (D-005)

### C9 — Authentication/authorization: none
Single anonymous role, local demo, no stored data. (D-006)

### C10 — External services: none at runtime
Dataset and heart asset are downloaded once, manually, by Satvik. The app makes no calls to CDNs, LLMs or analytics at runtime (meshopt decoder is bundled; no HDRI environment maps; fonts bundled or system). (D-007, D-020)

### C11 — Background jobs/workers: none
Training is an offline CLI step, not a runtime job.

## 3. Data flows

**DF-1 App boot**
1. Browser loads the SPA shell (3D viewer chunk is lazy-loaded in parallel).
2. `GET /api/meta` → targets, feature schema, quick controls, thresholds, risk levels.
3. `GET /api/samples` → 6 held-out sample patients.
4. Frontend loads Sample A into state → DF-2 step 3.
5. 3D chunk finishes → `useGLTF('/models/heart.glb')` loads (Suspense loader → model, or error boundary → proxy heart).

**DF-2 Predict (load or edit)**
1. User edits a field (or loads a sample/typical values/reset).
2. Edits debounce 400 ms; loads skip the debounce.
3. Client validation (BR-13). Invalid → `input_invalid`, stop.
4. `POST /api/predict {features}` with request id *n*.
5. Backend: size check → schema validation → canonical → model row → 4 × `predict_proba` → 4 × SHAP → grouping, relative, direction, percentile → summaries → agreement → JSON.
6. Frontend: if *n* is not the latest id, discard. Else store result → `ready`.
7. 3D colors transition to the new probabilities; explanation panel re-renders for `selectedTarget`; deltas computed client-side against the loaded patient's first result (BR-10).

**DF-3 Select vessel**
3D click or list button → `selectedTarget` updates → explanation panel reads `explanations[selectedTarget]` from the last response. No new request.

**DF-4 Model & method tab**
First open → `GET /api/metrics` (cached in memory for the session) → table + `<img src="/static/plots/{target}_{kind}.png">`.

**DF-5 Training (offline)**
`python -m ml.train`: load xlsx → normalize values → drop zero-variance columns → leakage guard → select 6 held-out samples (seed 42) → build feature schema (ranges from all rows, defaults and percentile references from training rows) → for each target: repeated stratified 5×5 CV over 3 candidates + baseline → select (D-013) → fit on all training rows → SHAP global importance on training rows → write models, schema, samples, metrics, reference values, plots, manifest.

**DF-6 Backend startup**
Read `manifest.json` → check installed library versions → load 4 bundles → build SHAP explainers → load schema, samples, reference values, metrics → mark ready. Any failure → not-ready (C4 failure behavior).

## 4. Repository structure

```text
CardioLens/
├── CLAUDE_RULES.md
├── README.md
├── docs/                                   # this specification
├── backend/
│   ├── requirements.txt                    # pinned versions
│   ├── requirements-dev.txt                # pytest, httpx
│   ├── data/raw/                           # dataset .xlsx (provided by Satvik; CC BY 4.0)
│   ├── ml/
│   │   ├── config.py                       # paths, seed, targets, excluded columns, CV params, thresholds, FEATURE_METADATA
│   │   ├── dataset.py                      # load + normalize + schema building + holdout selection
│   │   ├── inspect_data.py                 # T2.1 report
│   │   ├── preprocessing.py                # ColumnTransformer + transformed→original feature map
│   │   ├── models.py                       # candidate factory
│   │   ├── evaluate.py                     # CV loop, metrics, OOF predictions, plots
│   │   ├── explain.py                      # SHAP explainer factory, grouping, relative, percentile, summary
│   │   └── train.py                        # entry point
│   ├── app/
│   │   ├── main.py                         # app factory, CORS, size limit, routers, static, error handlers
│   │   ├── settings.py                     # env config
│   │   ├── schemas.py                      # Pydantic request/response models
│   │   ├── registry.py                     # artifact loading + readiness
│   │   ├── validation.py                   # BR-13
│   │   └── predictor.py                    # DF-2 step 5
│   ├── artifacts/                          # generated, committed
│   └── tests/
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts                      # /api and /static proxy → http://localhost:8000
    ├── public/models/heart.glb             # optimized heart asset (provided by Satvik)
    └── src/
        ├── main.tsx, App.tsx
        ├── api/        client.ts, types.ts
        ├── config/     vessels.ts, risk.ts, copy.ts
        ├── state/      analysisReducer.ts, useAnalysis.ts
        ├── components/ layout/, patient/, results/, evaluation/, common/
        └── scene/      HeartViewer.tsx, HeartModel.tsx, ProxyHeart.tsx, Artery.tsx,
                        arteryPaths.ts, ViewPresets.tsx, Legend.tsx, VesselSchematic2D.tsx
```

## 5. Frontend state

- `useAnalysis` hook wraps a reducer implementing PRODUCT_SPEC §6.2: `{status, source: "sample" | "typical" | null, sampleId, loadedValues, values, fieldErrors, result, originalResult, lastGoodResult, latestRequestId, error}`.
- UI state kept separately: `selectedTarget`, `hoveredVessel`, `showGroundTruth`, `showLabels`, `activeTab`.
- No global state library; React context only for passing meta/schema down.

## 6. Extensibility (TC-2) and correspondence (TC-3)

**One key everywhere.** Target ids `cad`, `lad`, `lcx`, `rca` are identical in `ml/config.py` (`TARGETS`), artifact filenames, API JSON keys, `frontend/src/config/vessels.ts`, and 3D object names (`artery-lad`, `artery-lcx`, `artery-rca`).

**Consistency tests.**
- Backend: every target in `TARGETS` has a model bundle, metrics entry and plots.
- Frontend: every `vessel` target from `/api/meta` has an entry in the vessel registry and a path in `arteryPaths.ts`, and vice versa (fails the test suite on mismatch).

**Adding a clinical feature:** add the column + metadata entry (DATA_MODEL §3) → retrain → the form, validation and explanations pick it up from the schema. No UI code change.
**Adding a prediction model/target:** add to `TARGETS` (+ source column) → retrain → if it is a vessel, add a registry entry and a path.
**Adding an anatomical structure:** add a path (or mesh name) in `arteryPaths.ts` and a registry entry.

## 7. Performance plan (TC-1)

**Backend:** models and explainers built once at startup; exact SHAP (linear/tree) only — no sampling explainers; single-row inference.

**Frontend bundle:** 3D viewer `React.lazy` chunk; heart GLB loaded only by the viewer; no chart library (D-022).

**3D rendering:**
- `frameloop="demand"`: render only on interaction or color transitions (`invalidate()` during tweens).
- `dpr={[1, 1.5]}`; antialias on.
- ≤ 3 lights (ambient + 2 directional); no shadows; no HDRI.
- Heart GLB optimized with meshopt + resized textures, ≤ 5 MB, target ≤ 150k triangles (T6.1).
- Artery tubes: ~64 tubular segments × 12 radial segments each; materials reused, only `color`/`emissive` change.
- No per-frame allocations in `useFrame`; colors interpolated with preallocated `THREE.Color`.
- R3F disposes JSX-declared resources on unmount; anything created manually is disposed in effect cleanup.

**Budgets verified in T10.1:** FPS while orbiting on Satvik's laptop, draw calls < 50, asset size, predict latency.

## 8. Security and privacy

- Strict input validation at the API boundary (BR-13); unknown fields rejected; body limit 16 KB.
- CORS allowlist from `ALLOWED_ORIGINS` (default `http://localhost:5173`); in dev, the Vite proxy makes calls same-origin.
- No secrets exist in this project (no API keys, no accounts). `.env` files git-ignored anyway.
- No request-body logging; no persistence; no cookies/analytics (BR-12).
- Only our own artifacts are unpickled (`joblib.load` is unsafe on untrusted files).
- Rate limiting: not needed for a local single-user demo (documented, not implemented).

## 9. Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ALLOWED_ORIGINS` | backend | `http://localhost:5173` | CORS allowlist (comma-separated) |
| `ARTIFACTS_DIR` | backend | `backend/artifacts` | Artifact location |
| `VITE_API_BASE_URL` | frontend | `/api` | API base URL |

## 10. Dependencies (each has a purpose)

| Package | Side | Purpose |
|---|---|---|
| fastapi, uvicorn, pydantic | backend | HTTP API, ASGI server, validation models |
| scikit-learn | backend | Models, pipelines, CV, metrics |
| shap | backend | Per-patient and global explanations |
| pandas, openpyxl | backend | Read `.xlsx`, tabular handling |
| numpy | backend | Numerics |
| joblib | backend | Save/load model bundles |
| matplotlib | backend | ROC / calibration / confusion plots at training time |
| pytest, httpx | backend dev | Tests; FastAPI TestClient |
| react, react-dom | frontend | UI |
| three, @react-three/fiber, @react-three/drei | frontend | 3D rendering, React bindings, helpers (OrbitControls, useGLTF, Html) |
| tailwindcss, @tailwindcss/vite | frontend dev | Styling; Tailwind's Vite plugin |
| typescript, vite, @vitejs/plugin-react | frontend dev | Types, build/dev server, React transform |
| @types/react, @types/react-dom | frontend dev | Type definitions |
| vitest, @testing-library/react (+ its peer @testing-library/dom), jsdom | frontend dev | Unit/component tests |

Exact versions were pinned at install time (T1.3, T1.4) and are recorded in DECISIONS §4. React and R3F major versions must match (R3F v9 ↔ React 19).

## 11. Error-handling matrix

| Failure | Detected by | User sees | Recovery |
|---|---|---|---|
| Backend not running | Boot fetch fails | `boot_error` screen with start command | Retry |
| Artifacts missing / version mismatch | Registry at startup | `boot_error` with "Model service not ready: {reason}" (from 503) | Run `python -m ml.train` / reinstall pinned versions |
| Invalid input | Client validation | Field errors, results "Out of date" | Fix fields |
| Server-side 422 (client/server mismatch) | API response | Field errors mapped from `details` | Fix fields |
| Predict timeout / 5xx | API client | Inline error + Retry; last good result "Out of date" | Retry |
| Heart GLB fails | Error boundary | Proxy heart + small notice "Detailed heart model unavailable" | None needed; arteries still work |
| No WebGL | Capability check | 2D vessel schematic with same colors/clicks | None needed |
| Metrics fetch fails | Model & method tab | Inline error + Retry | Retry |
