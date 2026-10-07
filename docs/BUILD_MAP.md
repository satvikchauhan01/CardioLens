# Build Map

**Status:** v0.2 — approved by Satvik (T0.2); Python 3.13 per D-025 · **Date:** 2026-10-07
**Rule:** phases run strictly in order, and each phase is built in one go (D-036): all its tasks → checks → fixes → one report. Claude never commits on its own; the commit names below are suggestions for Satvik.
**Legend:** 🧑 Satvik does this (installs, downloads, accounts, assets) · ⛳ checkpoint: Satvik reviews before the next task starts.

---

## 1. Calendar (IST)

| Day | Date | Work | End-of-day goal |
|---|---|---|---|
| 0 | Wed Oct 7 | Phase 0 · T1.1 🧑 | Spec approved; tools installed; dataset downloaded; folder connected |
| 1 | Thu Oct 8 | Phase 1 · Phase 2 · T3.1 | App shells run; data inspected and approved; pipelines build |
| 2 | Fri Oct 9 | T3.2–T3.4 · Phase 4 | Models trained, artifacts written, API complete and tested |
| 3 | Sat Oct 10 | Phase 5 | Form, results and explanations working against the real API |
| 4 | Sun Oct 11 | Phase 6 | 3D heart with colored, selectable arteries |
| 5 | Mon Oct 12 | Phase 7 · Phase 8 | Full flow + differentiators. **Feature freeze 23:59** |
| 6 | Tue Oct 13 | Phase 9 · Phase 10 · T11.1 · start T11.2 | Tested, fast, README done, polished |
| 7 | Wed Oct 14 | T11.2–T11.5 | Report, video, audit, **submit by 18:00 IST** |

## 2. Global definition of done

A task is done when: its tests pass · no new console errors or warnings · docs are updated if behavior changed (with Satvik's approval) · `git status` + `git diff --stat` + summary shown and Satvik approved the commit.

---

## Phase 0 — Specification

### T0.1 Write the specification
- **Objective:** Create the 8 docs + CLAUDE_RULES.md.
- **Files:** `docs/*.md`, `CLAUDE_RULES.md`
- **Depends on:** problem statement, submission guidelines, master prompt, rules
- **Output:** this folder
- **Acceptance:** every requirement traced (PROBLEM_ANALYSIS §3); no invented data or metrics; unverified facts marked
- **Tests:** cross-document consistency review (ids, endpoints, task references)
- **Done when:** Satvik approves or requests changes

### T0.2 ⛳🧑 Approve decisions
- **Objective:** Approve or change every PROPOSED entry in DECISIONS.md and answer its open questions.
- **Files:** `docs/DECISIONS.md`
- **Done when:** no PROPOSED entries block Phase 1.

## Phase 1 — Foundation

### T1.1 🧑 Prerequisites and inputs
- **Objective:** Tools, repo and dataset in place.
- **Steps (portal → CLI equivalent):**
  1. Python 3.13 — python.org → Downloads → Windows installer (tick "Add python.exe to PATH") → `winget install -e --id Python.Python.3.13`
  2. Node.js LTS — nodejs.org → LTS installer → `winget install -e --id OpenJS.NodeJS.LTS`
  3. Git — git-scm.com → Download for Windows → `winget install -e --id Git.Git`
  4. Verify: `python --version` (must print 3.13.x) · `node --version` · `npm --version` · `git --version`
  5. GitHub — github.com → New repository → `CardioLens`, Public, no README/.gitignore/license → Create. Repo: `https://github.com/satvikchauhan01/CardioLens.git`
  6. Dataset — UCI page (DATA_MODEL §1) → Download → extract → put `extention of Z-Alizadeh sani dataset.xlsx` in `backend/data/raw/`
  7. Connect the `D:\CardioLens` folder (the project root, D-034) to this Claude conversation (desktop app → "+" → Add folder)
- **Done when:** the four version commands print versions and the folder is connected.

### T1.2 Repository scaffold
- **Objective:** Folder structure and repo hygiene.
- **Files:** `.gitignore`, `README.md` (skeleton), `CLAUDE_RULES.md`, `docs/`, `backend/` and `frontend/` folders per ARCHITECTURE §4
- **Depends on:** T1.1
- **Acceptance:** tree matches ARCHITECTURE §4; `.gitignore` covers `.venv/`, `node_modules/`, `dist/`, `__pycache__/`, `.env*`, `.pytest_cache/`
- **Tests:** structure check
- **Commit:** `chore: scaffold repository`

### T1.3 Backend foundation (ask before installing packages)
- **Objective:** Running FastAPI skeleton with the error envelope.
- **Files:** `backend/requirements*.txt`, `backend/app/{main,settings}.py`, `backend/tests/test_health.py`
- **Depends on:** T1.2
- **Output:** app factory, CORS allowlist, 16 KB body limit, custom error handlers, `GET /api/health` returning 503 "not trained yet" until artifacts exist
- **Commands (PowerShell):** `cd backend` · `python -m venv .venv` · `.\.venv\Scripts\Activate.ps1` · `pip install -r requirements.txt -r requirements-dev.txt` · `uvicorn app.main:app --reload --port 8000` · `pytest`
  (macOS/Linux: `python3.13 -m venv .venv` · `source .venv/bin/activate`)
- **Acceptance:** server starts; `/api/health` → 503 body per API_CONTRACT §2; unknown route → 404 envelope
- **Tests:** health 503 without artifacts; error envelope shape; oversized body → 413
- **Commit:** `feat: add backend foundation`

### T1.4 Frontend foundation (ask before installing packages)
- **Objective:** App shell with disclaimer and tabs.
- **Files:** `frontend/*` (Vite React TS), `src/App.tsx`, `src/components/layout/*`, `src/config/copy.ts`
- **Depends on:** T1.2
- **Output:** header, tabs, disclaimer banner (PRODUCT_SPEC §9.1 exact text), footer, Tailwind theme tokens, `/api` + `/static` dev proxy, font choice recorded in DECISIONS
- **Acceptance:** `npm run dev` shows the shell; banner visible on both tabs; `npm run build` and `npm run test` pass
- **Tests:** banner renders exact text; tab switching
- **Commit:** `feat: add frontend foundation`

## Phase 2 — Data layer

### T2.1 ⛳ Dataset loader and inspection report
- **Objective:** Facts about the real file before any modeling.
- **Files:** `backend/ml/{config,dataset,inspect_data}.py`, `backend/artifacts/data_report.md`, `backend/tests/test_dataset.py`
- **Depends on:** T1.3, dataset file
- **Output:** `python -m ml.inspect_data` → report: shape; column names; dtypes; unique values (listed if ≤ 10, else min/max); label distributions; `Cath` vs (LAD ∨ LCX ∨ RCA) mismatch count; zero-variance columns; duplicate rows; every deviation from DATA_MODEL §2, §4, §5
- **Acceptance:** report generated from the real file; no modeling code
- **Tests:** 303 rows loaded; label columns present; clear error when the file is missing
- **Done when:** Satvik approves the DATA_MODEL updates the report requires
- **Commit:** `feat: add dataset loader and inspection report`

### T2.2 Feature metadata, normalization, leakage guard
- **Objective:** Canonical, typed features with the guard enforced.
- **Files:** `backend/ml/{config,dataset}.py`, `backend/tests/test_dataset.py`
- **Depends on:** T2.1
- **Output:** `FEATURE_METADATA` (DATA_MODEL §3), raw → canonical maps (§5.1), `EXCLUDED_COLUMNS`, zero-variance drop
- **Acceptance:** every non-label column has metadata; ids unique snake_case; every raw value mapped
- **Tests:** excluded ∩ inputs = ∅; guard raises when violated; unmapped raw value raises; canonical types correct
- **Commit:** `feat: add feature metadata and leakage guard`

### T2.3 Held-out samples, feature schema, reference values
- **Objective:** Fixed demo patients and the schema that drives form + validation.
- **Files:** `backend/ml/dataset.py`, artifacts `samples.json`, `feature_schema.json`, `reference_values.json`
- **Depends on:** T2.2
- **Output:** 6 samples per DATA_MODEL §5.3; schema with min/max (dataset range), defaults and percentile references (training rows)
- **Acceptance:** deterministic with seed 42; samples disjoint from training rows; every sample valid against the schema
- **Tests:** determinism; disjointness; min ≤ default ≤ max; categories complete
- **Commit:** `feat: add held-out samples and feature schema`

## Phase 3 — Core logic (ML)

### T3.1 Preprocessing and candidate models
- **Files:** `backend/ml/{preprocessing,models}.py`, tests
- **Depends on:** T2.3
- **Output:** ColumnTransformer per DATA_MODEL §5.2 + `transformed_to_feature`; 3 candidates + prior baseline
- **Acceptance:** each pipeline fits and predicts on training rows
- **Tests:** mapping length = transformed width; no label column reaches the preprocessor
- **Commit:** `feat: add preprocessing and candidate models`

### T3.2 ⛳ Cross-validated evaluation
- **Files:** `backend/ml/evaluate.py`, tests, plots
- **Depends on:** T3.1
- **Output:** per target × candidate: 25-fold metrics (mean ± std), out-of-fold predictions, ROC/calibration/confusion plots
- **Acceptance:** preprocessing fitted inside folds; identical results on rerun
- **Tests:** metric helpers on toy data (incl. specificity); determinism
- **Done when:** Satvik has seen the real numbers. Threshold, class weighting and calibration stay as approved unless he approves a change
- **Commit:** `feat: add cross-validated evaluation`

### T3.3 Explanation module
- **Files:** `backend/ml/explain.py`, `backend/tests/test_explain.py`
- **Depends on:** T3.2
- **Output:** explainer factory per model type; one-hot grouping; relative; direction; percentile; summary (BR-7, BR-8); global importance
- **Acceptance:** additivity holds for each model type
- **Tests:** additivity; grouping sums; Σ|relative| = 1; percentile edges; summary with/without lowering factor
- **Commit:** `feat: add shap explanation module`

### T3.4 Training entry point and artifact export
- **Files:** `backend/ml/train.py`, all artifacts
- **Depends on:** T3.3
- **Output:** `python -m ml.train` runs DF-5 end to end; selection per D-013; models, metrics, manifest, quick controls
- **Acceptance:** completes from the raw file in < 5 min on Satvik's laptop; rerun reproduces metrics
- **Tests:** artifacts exist; bundle keys; manifest versions; guard asserted
- **Commit:** `feat: train models and export artifacts`

## Phase 4 — API

### T4.1 Registry, health, meta
- **Files:** `backend/app/{registry,schemas,main}.py`, tests
- **Depends on:** T3.4
- **Acceptance:** health 200 with artifacts, 503 when missing or library version mismatched; meta matches API_CONTRACT §3
- **Commit:** `feat: load artifacts and serve metadata`

### T4.2 Samples, metrics, plots
- **Files:** `backend/app/main.py`, tests
- **Acceptance:** contract shapes; plots served; missing plot → 404 envelope
- **Commit:** `feat: serve samples, metrics and plots`

### T4.3 Predict endpoint
- **Files:** `backend/app/{validation,predictor}.py`
- **Acceptance:** DF-2 step 5; BR-3, BR-4, BR-6, BR-7, BR-8, BR-13 implemented
- **Commit:** `feat: add prediction endpoint`

### T4.4 API test suite
- **Files:** `backend/tests/test_api.py`
- **Tests:** each sample predicts; every FieldError issue type; 413; determinism; agreement cases; informational p95 latency over 50 calls
- **Commit:** `test: cover api behavior`

## Phase 5 — Core UI

### T5.1 API client, types, boot states
- **Files:** `src/api/*`, `src/components/common/*`
- **Tests:** error normalization (mocked fetch); boot error screen
- **Commit:** `feat: add api client and boot states`

### T5.2 Patient input and analysis state
- **Files:** `src/state/*`, `src/components/patient/*`
- **Output:** sample picker, typical values, schema-driven grouped form, client validation, reducer (PRODUCT_SPEC §6.2)
- **Tests:** every reducer transition; stale response discarded; validation mirrors BR-13
- **Commit:** `feat: add patient input workflow`

### T5.3 Results panel
- **Files:** `src/components/results/{CadSummaryCard,VesselList,AgreementNote}.tsx`
- **Tests:** level boundaries 0.35/0.65; status text at 0.5; agreement note
- **Commit:** `feat: add results panel`

### T5.4 Explanation panel
- **Files:** `src/components/results/ExplanationPanel.tsx`, `ContributionBar.tsx`
- **Tests:** sort order; "<1%" formatting; switches with `selectedTarget`
- **Commit:** `feat: add explanation panel`

## Phase 6 — 3D experience

### T6.1 ⛳🧑 Heart asset and viewer shell
- **Satvik provides:** an open-licensed heart model. Criteria: CC0 or CC BY (CC BY-SA acceptable with share-alike noted); GLB/GLTF/OBJ download; anatomically recognizable exterior; ≤ 50 MB raw; coronary arteries not required. Sources from the problem statement: BodyParts3D, Sketchfab (downloadable, license shown), NIH 3D. Satvik records the URL, author and license.
- **Optimization (ask before installing the tool):** `npx @gltf-transform/cli optimize heart-raw.glb public/models/heart.glb --compress meshopt --texture-size 1024`
- **Files:** `src/scene/{HeartViewer,HeartModel,ProxyHeart}.tsx`
- **Output:** lazy viewer, Suspense loader, error boundary → ProxyHeart, OrbitControls (zoom limits, no pan), 3 lights, `dpr={[1, 1.5]}`, `frameloop="demand"`
- **Acceptance:** asset ≤ 5 MB; smooth orbit; credit in footer + README draft
- **Tests:** fallback renders when the loader throws
- **Commit:** `feat: integrate 3d heart viewer`

### T6.2 ⛳ Artery geometry
- **Files:** `src/scene/{Artery.tsx,arteryPaths.ts}`, `src/config/vessels.ts`
- **Output:** tube arteries for LAD, LCX, RCA + neutral left main; courses follow the problem statement's descriptions (front; side and back; right side and bottom); dev-only point picker for authoring (removed in T11.1)
- **Acceptance:** Satvik approves screenshots from 4 views
- **Tests:** registry ↔ paths ↔ target ids consistency (TC-3)
- **Commit:** `feat: add coronary artery geometry`

### T6.3 Risk coloring and interaction
- **Files:** `src/config/risk.ts`, `src/scene/{Artery,Legend}.tsx`
- **Output:** BR-5 colors with ≤ 400 ms transition (instant with reduced motion); hover highlight + tooltip; click select; 3D ↔ list sync; legend + §9.3 note
- **Acceptance:** colors distinguishable under Chrome DevTools vision-deficiency emulation
- **Tests:** color endpoints/midpoint; luminance decreases with risk
- **Commit:** `feat: color and select arteries by risk`

### T6.4 Presets, labels, fallbacks
- **Files:** `src/scene/{ViewPresets,VesselSchematic2D}.tsx`
- **Output:** Front/Back/Left/Right/Reset; labels toggle; 2D schematic without WebGL; canvas text alternative
- **Tests:** schematic renders colors and handles clicks
- **Commit:** `feat: add view presets and 3d fallbacks`

## Phase 7 — Integration

### T7.1 End-to-end wiring and live updates
- **Output:** UF-1 to UF-4 working; 400 ms debounce; stale discard; out-of-date states; Reset demo
- **Tests:** integration test with mocked API (load sample → predict → panels + colors)
- **Commit:** `feat: connect prediction flow end to end`

### T7.2 Requirements trace check
- **Output:** PROBLEM_ANALYSIS §3 rows PM, VIS, DASH, SAFE, TC marked pass/fail in §4 below; gaps fixed before Phase 8

## Phase 8 — Differentiators

### T8.1 What-if explorer (DIFF-1)
- **Output:** quick controls (BR-9), deltas (BR-10), Modified badge, Reset to original, §9.5 note
- **Tests:** delta math; reset; badge count
- **Commit:** `feat: add what-if explorer`

### T8.2 Ground-truth reveal (DIFF-2)
- **Output:** BR-11 toggle with ✓/✗
- **Tests:** hidden when modified; match logic
- **Commit:** `feat: add held-out ground truth reveal`

### T8.3 Model & method tab (DIFF-2, DEL-3)
- **Output:** PRODUCT_SPEC §4.3 sections 1–6
- **Tests:** renders from mocked metrics; error state
- **Commit:** `feat: add model and method view`

## Phase 9 — Testing

### T9.1 Backend tests complete
- BR-2, BR-6, BR-7, BR-8, BR-13 and startup failures covered; `pytest` green. **Commit:** `test: complete backend coverage`

### T9.2 Frontend tests complete
- Reducer, risk/color, formatting, registry consistency (TC-3), key components; `npm run test`, `npm run build` and type-check green. **Commit:** `test: complete frontend coverage`

### T9.3 Manual end-to-end checklist
- DEMO_FLOW §4 on Chrome and Edge; integrated GPU; CPU throttled 4× in DevTools; backend stopped; heart file renamed (fallback); WebGL disabled (2D schematic). Results recorded in §4 below.

## Phase 10 — Performance and demo hardening

### T10.1 3D performance audit
- Measure FPS while orbiting (DevTools frame rendering stats), draw calls, asset size, predict latency; fix regressions; record numbers. **Commit:** `perf: optimize 3d rendering`

### T10.2 Demo hardening
- Reset demo; default Sample A; boot-error copy with exact start commands; zero console errors; title + favicon. **Commit:** `fix: harden demo flow`

### T10.3 README and reproducibility
- README: what it is · prerequisites · setup (PowerShell first, then macOS/Linux) · train · run backend · run frontend · tests · structure · model summary · attributions (dataset citation + CC BY 4.0, 3D asset credit + license) · disclaimer · limitations. Docker only if Satvik approves. **Commit:** `docs: complete readme`

## Phase 11 — Final polish and submission

### T11.1 Polish and cleanup
- Remove the point picker and debug code; consistent spacing/colors; copy checked against PRODUCT_SPEC §9.6. **Commit:** `style: refine health platform ui`

### T11.2 Project report (≤ 6 pages)
- Sections: overview and problem · dataset and preprocessing · models, validation and leakage guard · results (numbers copied from `metrics.json` only) · interpretability method · 3D pipeline · architecture and usage · limitations and disclaimer · references and attributions. Format chosen by Satvik.

### T11.3 🧑 Demo video
- Script in DEMO_FLOW §3. Satvik records screen + English voice-over; subtitles if possible; YouTube **Unlisted**; check it plays while logged out.

### T11.4 Final hackathon audit
- Master prompt §15 checklist; PROBLEM_ANALYSIS §3 all pass; fresh clone into a new folder → follow README exactly → app runs.

### T11.5 🧑 Devpost submission
- Description, public repo link, YouTube link, real full name, team member added. Submit by **18:00 IST Oct 14**; keep a screenshot of the confirmation.

---

## 3. Cut list (only with Satvik's approval at the time)

Cut in this order if behind schedule:
1. Optional Docker setup
2. 2D schematic fallback (keep proxy heart)
3. Labels toggle (keep tooltips)
4. Left/Right presets (keep Front/Back/Reset)
5. What-if deltas (keep live what-if updates)
6. Calibration plot (keep Brier score)

**Never cut:** leakage guard, CV metrics, SHAP panel, 3D coloring + selection, disclaimer, README, report, video, submission.

## 4. Progress tracker

| Task | Status | Commit | Notes |
|---|---|---|---|
| T0.1 | Done | — | Spec drafted and approved 2026-10-07 |
| T0.2 | Done | — | All PROPOSED decisions approved 2026-10-07; D-025 changed to Python 3.13. Still open: DECISIONS §3 items 2, 4, 5, 7, 8 |
| T1.1 | Done | — | Verified 2026-10-07: Python 3.13.14, Node 22.16.0, npm 10.9.2, Git 2.51.2. Project root is `D:\CardioLens` with the git repository at the root (D-034). Dataset downloaded from the UCI page with Satvik's approval and placed in `backend/data/raw/` |
| T1.2 | Done | `9ce1cb8` | Scaffold built 2026-10-07; structure check passed |
| T1.3 | Done | `9ce1cb8` | 2026-10-07: `pytest` 13 passed. Checked on a running server: `/api/health` → 503 contract body, unknown route → 404 envelope, 16 KB + 1 byte → 413. Known warning: Starlette deprecates `httpx` for its TestClient in favour of `httpx2` (tests still pass; swapping needs Satvik's approval) |
| T1.4 | Done | `9ce1cb8` | 2026-10-07: `npm run test` 4 passed, type-check and `npm run build` pass; shell checked in the browser on both tabs, no console errors. The header's Reset demo button is added in T7.1, when there is something to reset |
| T2.1 | Done, not committed · ⛳ review | — | 2026-10-07: `python -m ml.inspect_data` writes `backend/artifacts/data_report.md` from the real file (303 × 59, no missing values, no duplicates). DATA_MODEL updated; its §9 lists the eight changes for Satvik's review |
| T2.2 | Done, not committed | — | 55 input columns with metadata, 54 used (`Exertional CP` is constant and dropped); every raw value mapped; leakage guard in the loader, the preprocessor and the trainer |
| T2.3 | Done, not committed | — | Held-out rows 33, 235, 172, 88, 185, 286 (samples A to F); 297 training rows; schema, samples and reference values written by `python -m ml.train` |
| T3.1 | Done, not committed | — | ColumnTransformer gives 57 columns from 54 features; all three candidates and the baseline fit and predict |
| T3.2 | Done, not committed · ⛳ review | — | 25-fold results, selected model per target (ROC-AUC mean ± std): CAD logistic regression 0.917 ± 0.033 · LAD random forest 0.855 ± 0.053 · LCX random forest 0.739 ± 0.056 · RCA logistic regression 0.725 ± 0.045. Baseline 0.500 for all. Threshold, class weighting and calibration left as approved (DECISIONS §3 item 7) |
| T3.3 | Done, not committed | — | Additivity holds for all three model types (error below 1e-8); 4 predictions + 4 explanations for one patient take about 80 ms (p95 about 105 ms) on this laptop |
| T3.4 | Done, not committed | — | `python -m ml.train` runs in about 55 s. A second run reproduced every metric, every predicted probability for all 303 rows and every plot byte for byte. `pytest`: 110 passed |
