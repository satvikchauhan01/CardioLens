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
| T2.1 | Done · ⛳ review | `ba4c16b` | 2026-10-07: `python -m ml.inspect_data` writes `backend/artifacts/data_report.md` from the real file (303 × 59, no missing values, no duplicates). DATA_MODEL updated; its §9 lists the eight changes for Satvik's review |
| T2.2 | Done | `ba4c16b` | 55 input columns with metadata, 54 used (`Exertional CP` is constant and dropped); every raw value mapped; leakage guard in the loader, the preprocessor and the trainer |
| T2.3 | Done | `ba4c16b` | Held-out rows 33, 235, 172, 88, 185, 286 (samples A to F); 297 training rows; schema, samples and reference values written by `python -m ml.train` |
| T3.1 | Done | `ba4c16b` | ColumnTransformer gives 57 columns from 54 features; all three candidates and the baseline fit and predict |
| T3.2 | Done · ⛳ review | `ba4c16b` | 25-fold results, selected model per target (ROC-AUC mean ± std): CAD logistic regression 0.917 ± 0.033 · LAD random forest 0.855 ± 0.053 · LCX random forest 0.739 ± 0.056 · RCA logistic regression 0.725 ± 0.045. Baseline 0.500 for all. Threshold, class weighting and calibration left as approved (DECISIONS §3 item 7) |
| T3.3 | Done | `ba4c16b` | Additivity holds for all three model types (error below 1e-8); 4 predictions + 4 explanations for one patient take about 80 ms (p95 about 105 ms) on this laptop |
| T3.4 | Done | `ba4c16b` | `python -m ml.train` runs in about 55 s. A second run reproduced every metric, every predicted probability for all 303 rows and every plot byte for byte. `pytest`: 110 passed |
| T4.1 | Done | `a182aad` | 2026-10-07: artifacts load once at startup; `/api/health` is 200 with them, 503 with the reason when they are missing, incomplete or trained with another scikit-learn version; `/api/meta` matches the contract |
| T4.2 | Done | `a182aad` | `/api/samples`, `/api/metrics` and the twelve plots are served; a missing or oddly named plot gives the 404 envelope |
| T4.3 | Done | `a182aad` | `POST /api/predict`: BR-13 validation with every problem reported together, four probabilities, four explanations, agreement note. Details recorded in D-047 |
| T4.4 | Done | `a182aad` | `pytest`: 183 passed (73 of them in `test_api.py`). Predict over 50 calls: median about 78 ms, p95 about 95 ms on this laptop (target: p95 < 300 ms) |
| T5.1 | Done | `a182aad` | API client with a 10 s timeout and one error type; boot skeleton, boot error with start commands and Retry, "Model service not ready" for a 503 |
| T5.2 | Done | `a182aad` | Sample picker, typical values, schema-driven form (54 inputs in 5 groups), client validation with the same messages as the API, reducer and debounce hook. Quick controls and Reset to original come in T8.1 |
| T5.3 | Done | `a182aad` | CAD card, vessel list, agreement note, all analysis states. Status and level come from the API response, so their boundary tests are in the backend (`test_risk_level_boundaries`); risk colours are added in T6.3 |
| T5.4 | Done | `a182aad` | Per-target explanation: summary, top 8 of 54 contributions with value, unit, percentile and signed share, "Show all". `npm run test`: 89 passed; type-check and build pass. Checked in the browser against the real API: load, edit, invalid input, vessel selection, backend stopped and restarted, three layout widths |
| T6.1 | Done · ⛳ credit pending | `69524ed`, `c8a581d` | 2026-10-07: viewer shell built on a stand-in heart (D-051). 2026-10-08: Satvik provided the BodyParts3D heart parts (113 OBJ files, one anatomical structure each). `tools/heart_model/build_heart.py` keeps 44 of them (the outside of the heart and the coronary arteries), puts them in the viewer's axes and scale, and writes `frontend/public/models/heart.glb`: 0.65 MB, about 92k triangles, six named objects (limits: 5 MB, 150k). Compressed with glTF-Transform 4.5.1 through npx (weld, simplify to 75%, meshopt), which Satvik approved. A file that cannot be used falls back to the stand-in heart with the notice; seen in the browser with a model whose object names did not match. Still to do: the model's credit and licence (DECISIONS §3 item 14) and the frame-rate measurement of T10.1 |
| T6.2 | Done · ⛳ review | `69524ed`, `c8a581d` | 2026-10-08: the arteries are the model's own meshes (D-061, approved): LAD, LCX and RCA are the trunk of each artery (FMA74912, FMA74923, FMA3802) and take the risk colour; the left main stem and twelve branches are drawn in the "No estimate" grey. Each trunk's pieces join up (gaps under 0.2 mm); centre lines of 86, 108 and 88 mm and the label anchors are traced by the build script. Checked in the browser from the front, back, left and right: hover tooltip, click to select, a click on the heart selects CAD, labels sit only where the artery can be seen. The LCX trunk cannot be seen from the front on this anatomy; its list row turns the heart to the back. No point picker was needed. The stand-in heart keeps its tube arteries as the fallback |
| T6.3 | Done | `69524ed` | One colour scale (teal → amber → crimson, darker with risk) for arteries, legend, result bars and the 2D fallback; 0.4 s transition, instant with reduced motion; hover tooltip, click to select, list ↔ viewer highlight. Colour check done with the palette validator instead of DevTools emulation (D-052) |
| T6.4 | Done | `69524ed` | Front / Back / Left / Right / Reset view, labels toggle (labels follow the visible part of each artery), 2D schematic without WebGL, text alternative on the canvas |
| T7.1 | Done | `69524ed` | UF-1 to UF-4 work end to end with the 3D viewer; Reset demo in the header. `npm run test`: 134 passed, including the mocked-API integration tests; type-check and build pass; console clean on a fresh load. `pytest`: 183 passed |
| T7.2 | Done | `69524ed` | See §5 below: no failing row; two rows are open only because of the stand-in heart and the performance measurement that T10.1 does |
| T8.1 | Done · ⛳ review | `9828813` | 2026-10-07: eight quick controls from `/api/meta` (slider + number field, switch, segmented control), before → after differences on all four targets, "Modified (n fields)", Reset to original without a request, the §9.5 note. On Sample A, switching Typical chest pain off moves RCA 52% → 37% in about 0.5 s. Probabilities that would print as 100% or 0% now print ">99%" / "<1%" (D-056, approved). Placement of the badge and the button: D-057 |
| T8.2 | Done · ⛳ review | `9828813` | Toggle with the dataset label and ✓ / ✗ per target and a count of matches; disabled with the reason for typical values and while inputs are modified. Held-out samples with the current models: 4 of 4 targets match on A, B, C and F, 3 of 4 on E (CAD), 2 of 4 on D (LAD, RCA). Placement of the toggle: D-058 |
| T8.3 | Done | `9828813` | All six sections of PRODUCT_SPEC §4.3 from `/api/metrics`, fetched once on first open; loading and error states with Retry; twelve plots served. Details in D-059 |
| T9.1 | Done | `9828813` | `pytest`: 219 passed in about 40 s (was 183). New: one real training run with a single repeat into a temporary folder and the API served from it; startup with nine kinds of damaged artifacts; training aborts on a label column before anything is written; nothing about a request is logged (BR-12). The leakage guard in `ml.train` now runs first (D-060) |
| T9.2 | Done | `9828813` | `npm run test`: 201 passed in 16 files (was 134 in 12); type-check and `npm run build` pass. New: what-if, ground truth and Model & method at component and whole-app level, boot hook, WebGL and reduced-motion detection, metadata context, tab keyboard handling |
| T9.3 | Done in the app's own browser · 🧑 three checks left for Satvik | `9828813` | See §6 below: thirteen of the fifteen checklist items pass, one does not apply while there is no heart file, one needs a person. Edge, CPU throttling and integrated-graphics frame rate are still to do |
| T10.1 | Done · 🧑 on-screen frame rate left for Satvik | `57b6126` | 2026-10-08, on the development laptop (AMD Ryzen 7 5800HS, integrated Radeon graphics, Chromium 152). One frame of the turning heart, drawn and finished by the graphics card: median 1.1 ms, slowest 5.6 ms over 240 frames (zoomed in: median 1.5 ms); the 60 FPS budget is 16.7 ms. 6 draw calls, about 92k triangles, 3 lights, one shader program. Picking: under 0.1 ms per pointer move. Prediction from the browser: median 80 ms, 95th percentile 85 ms over 50 calls. Optimized build on localhost: first estimates on screen after about 0.13 s. Downloads: page code 278 kB (87 kB gzipped), 3D chunk 1.03 MB (280 kB gzipped), heart model 0.65 MB. One regression found and fixed: preparing the heart model blocked the page for about 230 ms, almost all of it building bounding-volume trees; they are now built only for the heart and the three pointer shells, with a faster split strategy, and the whole preparation takes about 46 ms. The frame rate seen on screen could not be measured: the built-in browser redraws at most 30 times a second and once a second when idle |
| T10.2 | Done | `57b6126` | Checked: Reset demo, Sample A on arrival, boot error with the start commands, title and favicon, no console errors on a fresh load of the development and the optimized build. Hardened: after a lost and restored graphics context the heart is drawn again by itself (before, the canvas stayed empty until the next interaction); if the 3D scene fails for any reason the viewer falls back to the 2D schematic; an unexpected error in a view shows a message with a reload button instead of an empty page, with the header, the disclaimer and the footer still on screen; on the three-column layout the viewer card now fits a 768 px high window, so the legend and its note stay in view while the page scrolls. `npm run test`: 251 passed |
| T10.3 | Done · ⛳ credit pending | `57b6126` | README completed: what it is, how it works, prerequisites, setup and run for Windows and for macOS / Linux, using the app, training, rebuilding the heart model, tests, structure, model summary, measured performance, configuration, troubleshooting, attributions, disclaimer, limitations. Checked: the backend start command as written; nothing the app or the tests need is ignored by git; rebuilding the heart model from the same parts reproduces both files byte for byte. No Docker setup (not asked for). The heart model's credit and licence are still missing (DECISIONS §3 item 14). The install from a fresh clone is left to T11.4, as planned |
| T11.1 | Done | `0aad65b` | 2026-10-08. No point picker was ever added (T6.2 did not need one). No debug code found: no `console.*`, `debugger`, `breakpoint(` or leftover TODO in the frontend, the backend or the tests; the only `print` calls are the progress lines of the two command-line scripts and one timing line in a test. The six scene colours that were repeated in five files now live in `frontend/src/scene/colors.ts`; three exports nothing else used are private again; two empty placeholder files are removed. All text in the app, the README and the report was read against PRODUCT_SPEC §9.6: nothing to change. Both tabs looked at in a 1366 × 768 window. `npm run test`: 251 passed |
| T11.2 | Done · ⛳ review | `0aad65b` | Format chosen by Satvik: Markdown and PDF. `docs/REPORT.md` is the text; `tools/report/build_report.py` prints it to `docs/CardioLens_Report.pdf` with the Edge already on the machine and fails above six pages: 5 pages, 0.9 MB, all nine sections of the task. Three figures in `docs/images/`: the app with a what-if change, the ROC curves of CAD and LCX, and held-out Sample D with its dataset labels and the LAD explanation (screenshots by `tools/report/capture_figures.mjs`). Both results tables were generated from `metrics.json`; counts, importances, the 3D facts and the performance numbers were each checked against the artifacts, the code or T10.1. The calibration sentence was recomputed from the out-of-fold predictions and corrected (D-070). Every page of the PDF was looked at. The heart model's credit is stated as still to be added. Nothing was installed |
| T11.3 | 🧑 To do: Satvik records | — | DEMO_FLOW §3.1 now holds a narration draft of about 800 words (six minutes), one paragraph per segment with what to do on screen; every number in it is from the running app or `metrics.json`. The heart model's credit must be in the app before recording, because the footer is on screen |
| T11.4 | Done · open rows are Satvik's | `0aad65b` | See §7 below. Every row of PROBLEM_ANALYSIS §3 was checked: 19 pass, 1 passes with the on-screen check open (TC-1), 1 is open on the heart model's credit (ASSET-1), 4 wait for the video and the submission. Fresh copy of exactly the files git would publish, new environment, README followed: the app runs, 219 backend and 251 frontend tests pass, the build passes. The "master prompt §15 checklist" is not in the project folder, so it was not run (DECISIONS §3 item 17) |
| T11.5 | 🧑 To do: Satvik submits | — | `docs/SUBMISSION.md` holds a draft of the Devpost description, the field values and a list of checks before pressing Submit. The repository page opens without signing in (checked 2026-10-08) |
| Audit | Done · ⛳ review | `d50c3a0` | 2026-10-10, at Satvik's request: every module read, the API and the UI attacked with scripts, the models retrained and compared. See §8 below: four defects fixed, three changes Satvik chose (coloured branches, notes on unusual combinations, Docker Compose, which was run and checked), no change to the models. Then the heart was given its own colours at his request (D-080). `pytest` 221 passed, `npm run test` 286 passed in 24 files, build passes |
| Pages | Done, not committed · ⛳ review | — | 2026-10-11, at Satvik's request ("everything is just on one page", "keep healthy patients too"). See §9 below: four pages (Patients, New patient, Analysis, Model & method), twelve held-out sample patients (six with the dataset label CAD, six with Normal), models retrained on the remaining 291 rows (model version `20261011T1756Z-7393432`), every number in the app's documents refreshed. Reading values from an uploaded report was asked about and left out at his choice (D-086). `pytest`: 229 passed; `npm run test`: 315 passed in 26 files; build passes; 153 browser checks pass on the dev server and through Docker with no console message |
| Interface | Done, not committed · ⛳ review | — | 2026-10-12, at Satvik's request ("enhance the ui make it more interactive and attractive"). See §10 below: a Home page as the first screen, a light and a dark theme, a six-step guided tour, the models' estimates on the patient cards with a filter, a gauge for the overall estimate, details per input in the explanation, a heart that turns once on arrival, estimates that count to their new value. No model, artifact or API change. `pytest`: 229 passed; `npm run test`: 391 passed in 31 files; build passes; 196 browser checks pass on the dev server and through Docker with no console message |

## 5. Requirements trace check (T7.2, 2026-10-07)

Rows of PROBLEM_ANALYSIS §3 in the PM, VIS, DASH, SAFE and TC groups.

| ID | Requirement | Result | Evidence |
|---|---|---|---|
| PM-1 | Classifier for overall CAD | Pass | `cad` model, `backend/artifacts/models/cad.joblib` |
| PM-2 | Stenosis status for LAD, LCX, RCA | Pass | Three vessel models, same pipeline |
| PM-3 | Demographic, examination, ECG, laboratory and echo features | Pass | 54 of the 55 inputs (one constant column dropped), all five groups |
| PM-4 | LAD, LCX, RCA, Cath never used as inputs | Pass | Guard in loader, preprocessor, trainer and API registry; `test_leakage_guard_*` |
| PM-5 | Accuracy, precision, recall, F1, ROC-AUC | Pass | `metrics.json` (25 folds, mean ± std), shown on the Model & method tab for every candidate and the baseline |
| VIS-1 | Interactive 3D heart | Pass · credit pending | React Three Fiber viewer with the BodyParts3D heart model and its own coronary arteries (T6.1, T6.2, ASSET-1). The model's credit and licence are still to be added |
| VIS-2 | Arteries coloured by predicted probability | Pass | `config/risk.ts`; colours follow every new prediction |
| VIS-3 | Rotate, zoom, select | Pass | Orbit and zoom, hover tooltip, click to select, view presets |
| DASH-1 | CAD status and vessel probabilities beside the canvas | Pass | Results panel |
| DASH-2 | Interpretable breakdown (SHAP) | Pass | Per-target explanation panel |
| DASH-3 | Measurements with their relative contribution | Pass | Value, unit, percentile and signed share per input |
| SAFE-1 | Visible disclaimer | Pass | Banner on every tab, CAD caption, legend note |
| TC-1 | Responsive 3D without a dedicated GPU | Pass on the measured frame time · on-screen check open | T10.1 on integrated Radeon graphics: a frame of the turning heart takes 1.1 ms (median) and at most 5.6 ms to draw, against 16.7 ms for 60 FPS; 6 draw calls, about 92k triangles, frames drawn on demand, pixel ratio capped at 1.5. Still to do by Satvik: watch the frame rate on screen in Chrome while rotating, and with the CPU throttled 4× |
| TC-2 | New features, models or structures without redesign | Pass | Form from the schema; targets from `TARGETS`; vessels from the registry and paths |
| TC-3 | Outputs match the displayed arteries | Pass | One id end to end; `arteryPaths.test.ts` and the integration tests |

## 6. Manual end-to-end checklist (T9.3, 2026-10-07)

DEMO_FLOW §4, run against the real backend (model version `20261007T1423Z-7393432`) in the Claude desktop app's built-in browser, which is Chromium-based. Clicks, drags, scrolling and key presses on the 3D viewer and the result rows were real input events; form edits were made from a script that sets the value and fires the input event.

| # | Check | Result | What was seen |
|---|---|---|---|
| 1 | Backend starts; `/api/health` → 200 | Pass | 200, `models_loaded: true` |
| 2 | Frontend boots; Sample A loads; zero console errors | Pass | On a fresh tab: Sample A selected, four estimates shown; no errors or warnings after the interactions of items 3 to 9 and 15 |
| 3 | Samples A–F each predict; 3D colours match the % in the results panel | Pass | For every sample the result rows, the 3D labels and the canvas's text alternative show the API's probabilities; bars and arteries take their colour from the same function |
| 4 | Hover and click each artery; list ↔ 3D selection in sync; keyboard selection | Pass | Hover on LAD: tooltip "LAD · Left Anterior Descending · 58%", pointer cursor, LAD row highlighted. Clicks on LAD, RCA, LCX select them in the list and the explanation; a click on the heart selects CAD; a click on empty space changes nothing. Enter and Space on a focused row select it |
| 5 | Explanation switches per target; "Show all" works | Pass | Four different explanations; 8 → 54 rows → back to 8 |
| 6 | Quick control edit updates within ~0.5 s; differences correct; Reset to original | Pass | Age 60 → 75: new estimates on screen 523 ms after the edit, one request, differences on all four targets, 3D labels updated, "Modified (1 field)". Reset: original estimates at once, no request |
| 7 | Invalid input → field error and no request; fixing it resumes updates | Pass | Age 200: message at the quick control and in the form, "Out of date — fix highlighted fields" on viewer and results, no request; a valid value predicts again |
| 8 | Ground-truth toggle only for unmodified samples | Pass | Labels on A (4 of 4), D (2 of 4), E (3 of 4); toggle disabled with the reason for typical values and while inputs are modified; back after Reset to original |
| 9 | Model & method tab shows metrics and plots | Pass | Method box, both tables with the real numbers, twelve plots (three per target) load, top 10 inputs, limitations, credits; `/api/metrics` requested once |
| 10 | Disclaimer on both tabs; CAD caption and legend note | Pass | All present; the banner also stays on the boot error screen |
| 11 | Backend stopped → error states; restart + Retry recovers | Pass | Prediction: "The estimates could not be updated." with Retry, last results kept as "Out of date". Model & method opened for the first time: "The evaluation results could not be loaded." with Retry. Reload: boot error with the start commands. After the restart, Retry on the boot screen loads Sample A, and the Model & method tab loads. The Retry buttons of the prediction and evaluation errors were not pressed in this run; they are covered by tests |
| 12 | Heart file missing → stand-in heart + notice | Pass (2026-10-08) | With a heart file whose object names did not match the registry, the viewer drew the stand-in heart with "Detailed heart model unavailable" and the stand-in note; the same path handles a file that cannot be loaded, and both are covered by tests |
| 13 | WebGL disabled → 2D schematic | Pass | With canvas contexts refused inside the page, the app shows the 2D schematic with the same artery colours, no view presets and its notice, and selects an artery on click |
| 14 | Smooth rotation on integrated graphics; usable with CPU throttled 4× | Frame time measured · 🧑 on-screen check to do | T10.1: on this laptop's integrated graphics a frame takes 1.1 ms (median), 5.6 ms at most, of which the page's own code is 0.1 to 0.3 ms, so a 4× slower CPU leaves it far below the 16.7 ms budget. Needs a person: DevTools → Rendering → Frame rendering stats while rotating, and Performance → CPU 4× slowdown |
| 15 | Reset demo restores the initial state | Pass | From the Model & method tab with another patient loaded and the ground-truth toggle on: back to Patient analysis, Sample A, CAD selected, toggle off, no modifications |

Still to do by Satvik: item 14, the same pass in Microsoft Edge, and the vision-deficiency emulation of DECISIONS §3 item 10. The three-column layout was checked at 1280 px and 1366 px wide; the built-in browser pane could not show a wider window, so a look at full-screen width is worth a minute.

Added 2026-10-08 (T11.2, T11.4): the app was also run in Microsoft Edge 154 without a window, driven by `tools/report/capture_figures.mjs`. There it loaded Sample A, drew the 3D heart with WebGL, applied a what-if change, loaded Sample D, showed the dataset labels and opened the LAD explanation; the report's screenshots are from these runs. A person looking at a visible Edge window is still worth a minute.

## 7. Final audit (T11.4, 2026-10-08)

### 7.1 Requirements checklist

Every row of PROBLEM_ANALYSIS §3, checked against the working tree of 2026-10-08 (commit `57b6126` plus the Phase 11 changes).

| ID | Requirement | Result | Evidence |
|---|---|---|---|
| PM-1 | Classifier for overall CAD | Pass | `cad` model in `backend/artifacts/models/`; ROC-AUC 0.917 ± 0.033 |
| PM-2 | Stenosis status for LAD, LCX, RCA | Pass | Three vessel models from the same pipeline; ROC-AUC 0.855, 0.739, 0.725 |
| PM-3 | Demographic, examination, ECG, laboratory and echo features | Pass | 54 of the 55 inputs in all five groups (17, 13, 7, 14, 3); the constant column is dropped |
| PM-4 | LAD, LCX, RCA, Cath never used as inputs | Pass | Guard in the loader, the preprocessor, the trainer and the API registry; the leakage tests pass |
| PM-5 | Accuracy, precision, recall, F1, ROC-AUC | Pass | `metrics.json`: 25 folds, mean ± std, with specificity, average precision and Brier score; on the Model & method tab and in the report |
| VIS-1 | Interactive 3D heart | Pass | React Three Fiber viewer with a heart model of about 92,000 triangles |
| VIS-2 | Arteries coloured by predicted probability | Pass | One colour function for arteries, legend and bars; seen to follow a what-if change (report, Figure 1) |
| VIS-3 | Rotate, zoom, select | Pass | Orbit, zoom, hover tooltip, click to select, view presets, list ↔ viewer |
| DASH-1 | CAD status and vessel probabilities beside the canvas | Pass | Results panel |
| DASH-2 | Interpretable breakdown (SHAP) | Pass | Per-target SHAP explanation; additivity tested for every model type |
| DASH-3 | Measurements with their relative contribution | Pass | Value, unit, percentile and signed share per input (report, Figure 3) |
| ASSET-1 | Open-source anatomical mesh, credited | **Open** | The BodyParts3D model is in use and named, but its full credit, source address and licence are not stated yet (DECISIONS §3 item 14). The model is already in the public repository |
| SAFE-1 | Visible disclaimer | Pass | Banner on both tabs and on the error screens, CAD caption, legend note; the README and the report open with it |
| DEL-1 | Web prototype: 3D viewer integrated with the ML backend | Pass | Runs from a fresh copy (§7.2): estimates, colours, explanations, what-if and dataset labels in one flow |
| DEL-2 | Trained pipeline: code and model weights | Pass | `backend/ml/` and the four committed models; the fresh copy served them without training, and its probabilities for the six samples equal the recorded ones |
| DEL-3 | Explanation dashboard: metrics, importances, patient breakdown | Pass | Explanation panel and Model & method tab |
| DEL-4 | Documentation of at most 6 pages | Pass | `docs/CardioLens_Report.pdf`: 5 pages; preprocessing (§2), models (§3), evaluation (§4), 3D pipeline (§6), usage (§7) |
| DEL-5 | YouTube video, 3 to 10 minutes | 🧑 To do | Script and narration draft in DEMO_FLOW §3 |
| SUB-1 | Devpost project description | 🧑 To do | Draft in `docs/SUBMISSION.md` |
| SUB-2 | Public repository with a README: setup, prerequisites, how to run | Pass | The repository page opens without signing in; the README's steps were followed in the fresh copy. The Phase 11 changes still have to be committed and pushed |
| SUB-3 | Video on YouTube, not private, English | 🧑 To do | — |
| SUB-4 | Real full name; Devpost account on the submission | 🧑 To do | — |
| TC-1 | Responsive 3D without a dedicated GPU | Pass on the measured frame time · on-screen check open | T10.1: 1.1 ms median and 5.6 ms at most per frame on integrated graphics, against 16.7 ms. The frame rate on screen has not been watched by a person yet |
| TC-2 | New features, models or structures without redesign | Pass | Form from the schema, targets and vessels from registries |
| TC-3 | Outputs match the displayed arteries | Pass | One id end to end; the tests load the shipped heart model and check each vessel's mesh |

### 7.2 Fresh copy, README followed

- **What was copied:** exactly the files git would publish from the working tree (tracked and new files, without ignored and deleted ones): 158 files, 10 MB, into an empty temporary folder. This stands in for a clone, because the Phase 11 changes are not committed yet. After the push, a real `git clone` from GitHub repeats it in a few minutes.
- **Setup, as written in the README (PowerShell):** `python -m venv .venv`, `Activate.ps1`, `pip install -r requirements.txt -r requirements-dev.txt` finished without an error in 113 s; `npm install` in 7 s (171 packages, 0 vulnerabilities reported).
- **Run:** backend on port 8000 and frontend on port 5173, both from the copy. `/api/health` answered 200 with `models_loaded: true` within a few seconds of the start. In Microsoft Edge 154 (without a window) the page loaded Sample A, drew the 3D heart and went through the what-if, Sample D and dataset-label steps. The probabilities for all six samples equal the recorded ones (Sample A: 99.8, 58.0, 60.0 and 51.7%).
- **One difference from the README's commands:** the two servers were started by the development tool, with `python -m uvicorn app.main:app --app-dir <backend> --port 8000` and `npm --prefix <frontend> run dev`. The README's own form, `uvicorn app.main:app --port 8000` typed inside `backend`, was not typed in the copy; what was checked there is that `uvicorn` resolves to the new environment after activation. The command as written was run in T10.3.
- **Tests in the copy:** `pytest` 219 passed in 41 s; `npm run test` 251 passed in 21 files; `npm run build` passed (page code 278 kB, 3D chunk 1.03 MB). `tools/report/build_report.py` rebuilt the 5-page PDF there as well.
- The temporary folder was removed afterwards. Nothing outside it was installed or changed.

### 7.3 Not done

- **Master prompt §15 checklist.** The task names it, but no such document is in the project folder, so it could not be run. If Satvik has it, each item can be checked in a few minutes.
- **macOS and Linux.** The README's commands for them were not run on those systems; the README says so.
- **On screen by a person:** the frame rate while rotating, the CPU throttled 4×, a visible Edge window, the colour-vision emulation (DECISIONS §3 items 10 and 12).

### 7.4 Before submitting (Satvik)

1. Heart model credit and licence (ASSET-1): the text goes into `frontend/src/config/copy.ts` (footer and credits), the README and `docs/REPORT.md`; then rebuild the PDF.
2. Read the report and the two drafts (DEMO_FLOW §3.1, `docs/SUBMISSION.md`).
3. Record and upload the video (T11.3).
4. Commit, push, submit on Devpost (T11.5); check the exact deadline on the Devpost page.

## 8. Full audit (2026-10-10)

Asked for by Satvik after Phase 11: check every requirement and every feature again, look for gaps and defects, fix them. Working tree: commit `0aad65b` plus the changes listed here.

### 8.1 What was checked

| Area | How | Result |
|---|---|---|
| Requirements | The 25 rows of PROBLEM_ANALYSIS §3 against the code and the running app. The official problem statement itself is not in the project folder; the rows are its record | As in §7.1: no new gap. ASSET-1 (heart model credit) is still the one open row that is not waiting for the video or the submission |
| Source code | Every file of `backend/ml`, `backend/app` and `frontend/src` read | No defect found by reading; the ones below came from running |
| API | A script with 111 single-input extremes, 300 random valid patients and 45 kinds of malformed or hostile requests (wrong types, NaN, 1e999, a 400-digit integer, label columns as inputs, oversized bodies, path traversal on the plots, a foreign origin) | Every valid request answered 200 with consistent fields, except the defect of §8.2 item 1. Every bad request got the contract's error envelope, never a 500 or a stack trace |
| UI | Microsoft Edge 154 without a window, driven by real key and mouse events: typing (empty, decimals, exponent, out of range), sliders by keyboard, six sample switches 15 ms apart, an edit overtaken by a sample switch, dataset labels, both tabs, Reset demo, six window sizes from 1920 to 390 px wide, tab order and focus rings | 70 checks pass, no console message, no horizontal overflow at any width |
| 3D viewer | Hover, click and drag with real mouse events on each artery, on the heart and on empty space; zoom limits; every view preset; labels | 28 checks pass. A drag that ends on an artery does not select it; the page does not scroll while zooming |
| Reproducibility | `ml.train` into a temporary folder, compared with the shipped artifacts | Every metric, schema, sample and reference value identical; all 12 plots identical byte for byte; probabilities for all 303 rows differ by 0. Only the model version (it holds the time of the run) differs |
| Models | Class weighting, a prevalence threshold and sigmoid calibration on the same 25 folds | No change made (D-078): each trades recall against specificity, ROC-AUC moves by at most 0.005 |
| Firefox | Firefox 157 without a window | The page and its styles load; the 3D viewer could not be driven this way. Firefox stays "best effort" (PRODUCT_SPEC §12) |

### 8.2 Defects found and fixed (D-074)

1. **Explanation fields that contradicted each other.** `direction` was taken from the unrounded SHAP value, so a contribution that rounds to 0 was sent as "raises" or "lowers" beside `0.0`, sometimes as `-0.0`: 6 of the first 417 audit requests. The panel then printed "0%" for an input that had moved the estimate. Now `direction` follows the value as sent, `-0.0` is never sent, and the panel prints "<1%" where BR-14 asks for it. Tests added on both sides.
2. **The dev server depended on how `localhost` resolves.** On this machine it resolves to the IPv6 address first, where uvicorn does not listen (a plain client needs 2.1 s per request that way; 3 ms to `127.0.0.1`). The proxy now names `127.0.0.1:8000`.
3. **Windows commands on every system.** The "backend not running" screen showed the PowerShell activation line to macOS and Linux users as well. It now shows the line for the system the browser runs on.
4. **Node.js requirement.** The README said 22.12; the test tools declare 22.13 (`jsdom`) and exclude Node 23 and 25 (`vitest`). README corrected, `engines` added to `package.json`, two troubleshooting entries added (port 8000 in use; `127.0.0.1:5173` does not open).

5. **The report build could claim a PDF it had not written.** The browser's command can return before the file exists; the script then counted the pages of the old PDF and said "wrote". Seen on 2026-10-10 when a rebuild left the file untouched. It now prints into a temporary folder, waits for the file and only then replaces the PDF, and it fails if none appears. The screenshot script now asks the browser to quit; before, its helper processes stayed behind (18 of them after a day of checks, all stopped).

### 8.3 Changes Satvik chose (asked together, 2026-10-10)

- **Coloured branches (D-073).** Each vessel's named branches take its colour and are picked with it; the build verifies that every branch springs from the trunk it is listed under. All three arteries are now visible in the starting view, which was turned from 22° to 35°. Still labelled on the trunks only, so the LCX label shows from the back and the left.
- **A heart in the colours of a heart (D-080, asked for the same day).** Rose ventricles, mauve atria, pale great vessels; the tones are lighter than the whole risk scale and a test keeps them at a measured distance from it. Every artery has a permanent dark edge, so it stays clearly visible at every risk level and for viewers who cannot tell red from green. The stand-in heart and the 2D schematic follow.
- **Unusual combinations (D-075, BR-15).** An advisory note when an edit breaks a relation that holds in every row of the dataset. Silent for the six samples and for the typical values.
- **Docker Compose (D-076).** `docker compose up --build` runs both parts: the model service in one container, nginx with the built frontend in the other, on port 5173. Checked on 2026-10-10 once Docker Desktop was running: the six samples get the recorded probabilities, and the API script and all 98 browser checks pass against the containers.
- **No licence file (D-077).**

### 8.4 Measured again

Frame cost with the branches coloured: median 1.5 ms, 3.6 ms at most; 5 draw calls (6 with an artery selected) (D-079). With the heart's colours and the arteries' edges on top (D-080): median 1.7 ms, 95th percentile 2.2 ms over nine runs of 240 frames, one frame of 16.5 ms; 9 draw calls; about 123k triangles drawn; heart model 0.66 MB. Page code 281 kB (88 kB gzipped), 3D chunk 1.03 MB (281 kB gzipped). The report's three figures and the README screenshot were taken again; the PDF is still 5 pages.

### 8.5 Open after the audit

1. Heart model credit and licence (unchanged, urgent: §7.4 item 1).
2. A person's look at the screen: frame rate while rotating, a visible Edge window, colour-vision emulation (DECISIONS §3 items 10 and 12).
3. Video and Devpost submission (T11.3, T11.5). The narration draft and the description draft are updated for the coloured branches.

## 9. Four pages and twelve sample patients (2026-10-11)

Asked for by Satvik after the audit: the app looked like "a very basic project" on one page, every sample patient seemed to be sick, the built-in patients and a patient of one's own should be separate, and could a medical report be uploaded and read. Three questions were asked together before any work (D-036). His answers: **twelve sample patients, six with CAD and six without**; **four pages**; **no report upload for now**. Working tree: commit `d50c3a0` plus the changes listed here.

### 9.1 What changed

| Area | Change | Decision |
|---|---|---|
| Held-out patients | `HOLDOUT_SLOTS` has twelve slots instead of six. The rule is the same and picks slot by slot, so Samples A to F are the same patients as before (a test checks it); G to L are rows 13, 225, 79, 41, 203, 300. Six have the dataset label CAD, six Normal; the three single-vessel patients cover LAD, LCX and RCA | D-081 |
| Models | Retrained on the remaining 291 rows. The same model type is selected for every target. ROC-AUC before → after: CAD 0.917 ± 0.033 → 0.917 ± 0.037 · LAD 0.855 ± 0.053 → 0.851 ± 0.049 · LCX 0.739 ± 0.056 → 0.726 ± 0.076 · RCA 0.725 ± 0.045 → 0.728 ± 0.057. Model version `20261011T1756Z-7393432` | D-081 |
| Pages | Patients · New patient · Analysis · Model & method, as tabs in the header, each with its own address, so Back and Forward work. The app still opens on Analysis with Sample A. A page is built when first opened and then kept, so nothing entered is lost when changing page | D-082 |
| Patients page | The twelve samples as cards in two groups by the dataset's overall label, with four of their inputs each; the one in analysis is marked | D-083 |
| New patient page | The full form on its own page, starting from typical values or from any sample; nothing is sent until "Analyse this patient". On the Analysis page such a patient is called "Your patient" and has no dataset label to compare with | D-084 |
| Percent display | An estimate below 50% is never shown as "50%": Sample A's RCA is 49.5% after the retrain and would have read "50% · Stenosis not predicted" | D-085 |
| Report upload | Not built; named as future work in the README, the report, the Devpost draft and the Q&A table | D-086 |
| Report and README | Figure 1 is the Analysis page with the new numbers; Figure 3 shows Sample B (three of four targets match, the miss marked) instead of Sample D; the README has two more screenshots (Patients page, a patient without CAD) | D-087 |

### 9.2 The twelve sample patients with the retrained models

The models' predictions match the dataset labels for 39 of 48 targets: four of four for C, F, I, J, K and L; three of four for A (RCA), B (LCX), E (CAD) and G (RCA); two of four for H (LAD, RCA); one of four for D (LAD, LCX, RCA). Five of the six patients with the label Normal get a CAD estimate between 7% and 41%; Sample E gets 91%. The table with every estimate is in DEMO_FLOW §1. With six samples and the earlier models it was 21 of 24; Sample A is no longer a full match, because its RCA estimate fell from 52% to 49.5%.

### 9.3 What was checked

| Area | How | Result |
|---|---|---|
| Backend | `pytest` | 229 passed (221 before): the twelve slots, half with CAD and half without, the first six unchanged, 291 training rows, twelve samples through the API |
| Frontend | `npm run test`, `npm run build` | 315 passed in 26 files (286 before); type-check and build pass. New: both new pages, the four tabs by mouse and keyboard, addresses and Back, a patient without disease end to end, a patient of the user's own end to end, pages built on first opening, the percent rule |
| API | The audit script of §8.1 against the retrained service | No problem. Through Docker, three of its checks (`/docs`, `/openapi.json`, an encoded `..` in a plot path) are answered by the web container with the app's own page, because those paths are not forwarded to the service; no API page or model file is returned |
| UI | The two browser scripts of §8.1, rewritten for the pages, in Microsoft Edge 155 without a window | 118 and 35 checks pass on the dev server and through Docker, no console message, no horizontal overflow on any of the four pages from 1920 to 390 px wide. Every sample's four estimates on screen equal the API's answer, and the count of matches equals the labels |
| Docker | `docker compose up --build`, Engine 28.5.1 | Both images build; health 200 with the new model version; the twelve samples get the same estimates as without Docker |
| Report | Rebuilt with new screenshots | 5 pages; every page looked at |

### 9.4 Measured again (2026-10-11, Edge 155, same laptop)

One prediction with four explanations from the browser: median 86 ms, 95th percentile 99 to 123 ms over three runs of 50 calls. First estimates after opening the optimized build: about 0.2 s (0.15 to 0.22 s over warm loads; about 0.35 s on a first visit). One frame of the turning heart: median 1.0 ms, 95th percentile 1.3 ms, 2.0 ms at most over nine runs of 240 frames; 1.3 ms zoomed in; 9 draw calls; 122,593 triangles. Page code 288 kB (90 kB gzipped); 3D chunk and heart model unchanged. A first attempt gave slower and unsteady numbers: six test browsers left running by two measurement scripts that had failed were using the machine. They were closed, and the test harness now closes its browser when a script fails (D-088).

### 9.5 Open after this work

1. Everything of §8.5: the heart model's credit and licence (still the one open requirement), the on-screen checks, the video and the Devpost submission.
2. The narration draft (DEMO_FLOW §3.1) and the Devpost draft (`docs/SUBMISSION.md`) were rewritten for the pages and the new numbers; they need Satvik's reading again.
3. For Satvik's review: the Patients page shows each sample's overall dataset label before its analysis is opened (D-083), and Figure 3 of the report now shows Sample B (D-087).

## 10. A more interactive interface (2026-10-12)

Asked for by Satvik on top of the four pages of §9, which were not yet committed: "enhance the ui make it more interactive and attractive". Three questions were asked together before any work (D-036). His answers: **light plus dark mode**; **all four interactive additions** (estimates on the patient cards, a living heart and results, a guided tour, a CAD gauge and richer charts); **a Home page as the first screen**. Working tree: commit `d50c3a0` plus the changes of §9 and of this section.

### 10.1 What changed

| Area | Change | Decision |
|---|---|---|
| Home page | A fifth page and the first screen: headline, a heart that turns slowly in the colours of the estimates of the patient in analysis, four numbers from the model service, three ways in, four steps. Sample A is still analysed at once, behind it. The heart on Home exists only while Home is on screen, so there is one 3D scene at a time | D-089 |
| Themes | A light and a dark theme from one set of colour tokens; the app starts as the system has it and a switch in the header changes it for the visit (nothing is stored, BR-12). Risk colours are the same in both; risk bars, rings and the gauge lie on a light track; the evaluation plots stay light images on white. The header has two rows: mark, name and actions, then the tabs with icons | D-090 |
| Patients page | Every card shows the models' estimates for its patient: a ring for CAD and a bar per artery. They are asked from `POST /api/predict` when the page is first opened, three at a time and marked as less urgent. "Show" narrows the page to one dataset label | D-091 |
| Results | The overall estimate is a half-circle gauge in its risk colour with a mark at the 50% threshold. Estimates count to their new value; bars slide; an artery lights up once when its estimate changes or it is selected and is then back at exactly its risk colour | D-092 |
| Guided tour | "Take the tour" in the header and on Home: six notes on the Analysis page, each with one part of the page lit. Keyboard, focus and reduced motion are handled; the page is not changed by it | D-093 |
| Viewer and explanation | The heart turns once around on arrival and stops for good when it is touched, an artery is under the pointer or a view is asked for; "Auto-rotate" starts it again. Pointing at an input of the explanation, or focusing it, opens a note with its SHAP value and unit, share, percentile in words and dataset range | D-094 |
| Report and README | The figures were retaken in the light theme; the README gained the Home page and a dark-theme tour screenshot; the report says five pages, two themes, one tour, and is still 5 pages long | D-095 |

### 10.2 What was checked

| Area | How | Result |
|---|---|---|
| Backend | `pytest` | 229 passed; nothing in the backend changed |
| Frontend | `npm run test`, `npm run build` | 391 passed in 31 files (315 in 26 before). New: Home, the theme switch from a light and from a dark system, the tour alone and in the app, the cards' estimates (hook, page, whole app, failure and Retry), the filter, the gauge, the details note, counting up, the heart's turn in both places |
| UI | The two browser scripts of §9.3, extended, and a third for the tour, in Microsoft Edge 155 without a window, light theme forced | 137, 41 and 18 checks pass on the dev server and through Docker; no console message; no horizontal overflow on any of the five pages from 1920 to 390 px wide; every card's ring and bars equal the API's answer; the tour's light is on its target and its note inside the window at 1366, 1024 and 390 px wide |
| Both themes | Every page looked at in the light and the dark theme, 1366 and 390 px wide | As intended. This laptop's system is dark, so the app opens dark here |
| API | The audit script of §8.1, through Docker | As in §9.3: every API request as expected; the same three paths that the web container answers with its own page |
| Docker | `docker compose up --build`, Engine 28.5.1 | Both images build; all checks above pass against the containers |
| Report | Rebuilt | 5 pages, after the new sentences were shortened; every page looked at |

One thing the checks found: the first browser run read estimates while they were still counting up. The app was right; the scripts now wait for the count to end.

### 10.3 Measured again (2026-10-12, Edge 155, same laptop)

One prediction with four explanations from the browser: median 88 ms, 95th percentile 93 to 98 ms over four runs of 50 calls. First estimates after opening the app on Home, optimized build: about 0.15 s (0.14 to 0.17 s over warm loads; about 0.4 s on a first visit). One frame of the turning heart: median 1.0 ms, 95th percentile 1.6 ms at most, 2.6 ms at most over nine runs of 240 frames; 1.4 ms zoomed in; 9 draw calls; 122,593 triangles. The twelve cards have their estimates 1.0 to 1.1 s after the Patients page is opened; a patient chosen while they are still loading is analysed in 0.4 to 0.5 s, the count-up included. Page code 315 kB (97 kB gzipped), styles 37 kB (7 kB gzipped); 3D chunk and heart model unchanged.

### 10.4 Open after this work

1. Everything of §9.5 and §8.5: the heart model's credit and licence (still the one open requirement), the on-screen checks, the video and the Devpost submission.
2. For Satvik's review: the app now opens on Home, not on the analysis (D-089); it opens in the dark theme on a system that is dark, as this laptop is (D-090); the selected artery lights up once and is not lit permanently (D-092).
3. The narration draft and the demo script were adjusted for Home, the gauge and the cards' estimates; they need his reading again before recording.

## 11. A colour of its own for each artery (2026-10-12)

Asked for by Satvik after §10: "a small correction in the heart model, keep different colour for each of the arteries so that they can be easily distinguishable". One question was asked first, because the arteries' colour is the estimate (BR-5, the track's requirement): where should the identity colour go? He chose **on the rim**, and the fill stays the risk colour (D-096).

| Area | Change |
|---|---|
| Registry | `rimColor` and `rimColorName` per vessel in `config/vessels.ts`: LAD blue, LCX magenta, RCA green, chosen as one set with the palette validator |
| 3D heart | The edge copy under each artery has its own colour and is wider (0.5, hovered 0.85 of the radius); selected stays the ink colour; the left main stem keeps the dark edge. No new draw call: still 9 |
| 2D schematic | The same rims, a dot beside each label, wider hover line |
| Labels, list, tooltip, legend | A colour bar on the 3D label (Home and Analysis), a bar before the artery's name in the list, a dot on the tooltip, and a key in the legend with the colour names |
| Tests | 391 passed in 31 files (383 before): rim colours pairwise, against the heart and against the risk scale; schematic rims, hover and selection; labels, tooltip, legend key, list swatches; the scene is still given the risk colours, not the rims |
| Browser | Both audits and the tour check pass again (137, 41 and 18 checks, no console message); the heart looked at on three patients in both themes, selected, and under four colour-vision simulations |
| Documents | README, report (still 5 pages: the new Figure 3 has the legend key, so two other sentences were shortened), PRODUCT_SPEC BR-5 and §11, DATA_MODEL, DEMO_FLOW, SUBMISSION; figures retaken |

Open: the video should show the legend key once; the narration says the three colours. Satvik's review of the colours themselves (DECISIONS §3 item 32).

