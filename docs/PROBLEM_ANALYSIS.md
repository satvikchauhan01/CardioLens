# Problem Analysis

**Project:** CardioLens (working name) — Multimodal AI Hackathon 2026, Track A: Cardiovascular Risk Visualization & Prediction
**Status:** v0.2 — approved by Satvik (T0.2); Python 3.13 per D-025 · **Date:** 2026-10-07
**Builder:** Satvik Chauhan (solo) · **Development ends:** 2026-10-14 EOD (confirm exact time and time zone on Devpost)

> The official Track A problem statement and the Submission Guidelines override everything in this folder. If anything here conflicts with them, stop and ask.
> Facts not yet confirmed against the actual data file are marked **(verify in T2.1)**.

---

## 1. Core problem

Coronary artery disease (CAD) is narrowing (stenosis) of the arteries that supply the heart muscle. In this track's dataset, a patient or vessel counts as diseased at **≥50% diameter narrowing**. Three vessels are targets:

| Vessel | Supplies (per problem statement) |
|---|---|
| LAD — Left Anterior Descending | Front of the heart |
| LCX — Left Circumflex | Side and back of the heart |
| RCA — Right Coronary Artery | Right side and bottom of the heart |

A model can output "CAD probability 0.74", but a bare number does not tell a clinician or patient **which vessel** the model is concerned about, **how strongly**, or **why**.

**What we solve:** make four model estimates (overall CAD + LAD, LCX, RCA) understandable at a glance by placing each vessel's estimate on that vessel in an interactive 3D heart, and explaining which patient measurements drove it.

**How CardioLens solves it:**
1. Four classifiers trained on routine clinical data (demographics, history, symptoms, examination, ECG findings, laboratory values, echo findings).
2. A 3D heart whose LAD, LCX and RCA change color with their predicted probability; clicking a vessel opens its details.
3. A per-patient explanation (SHAP) for each target, shown next to the patient's actual measurements.

**Why it is meaningfully different:** see §7 — what-if explorer, honest validation with held-out ground truth, and vessel-linked explanations.

## 2. Target users

| User | What they need | How CardioLens serves them |
|---|---|---|
| Clinician / cardiology trainee (decision support, education) | Quick view of which vessel the model flags and why | 3D vessel colors + per-vessel explanation |
| Medical educator / student | See how clinical findings relate to model estimates | What-if explorer, explanations, method page |
| Patient (alongside a clinician) | An intuitive picture instead of raw numbers | Plain-language summaries, simple color legend |
| Hackathon judge | Understand the value in ~3 minutes and verify rigor | Seeded sample patients, evaluation page, stated limits |

All use is **educational / decision support only — never diagnosis** (PRODUCT_SPEC §9).

## 3. Mandatory requirements checklist

Sources: Track A problem statement (**PS**) and Submission Guidelines (**SG**). Feature IDs (F#) are defined in PRODUCT_SPEC.md; task IDs (T#) in BUILD_MAP.md; decisions (D-#) in DECISIONS.md.

| ID | Requirement | Source | How we satisfy it | Tasks |
|---|---|---|---|---|
| PM-1 | Train classification model(s) for overall CAD status | PS 1.a | `cad` model (F3) | T3.1–T3.4 |
| PM-2 | Predict stenosis status for LAD, LCX, RCA | PS 1.b | `lad`, `lcx`, `rca` models (F3) | T3.1–T3.4 |
| PM-3 | Use demographic, examination, ECG, laboratory and echo features | PS 1.c | All non-label dataset features feed all four models (DATA_MODEL §2) | T2.2 |
| PM-4 | Exclude LAD, LCX, RCA and Cath from inputs for every target | PS 1.d | Leakage guard in code + automated test (BR-2) | T2.2, T9.1 |
| PM-5 | Evaluate with accuracy, precision, recall, F1, ROC-AUC | PS 1.e | Repeated stratified CV, mean ± std; plus specificity, average precision, Brier score (F9) | T3.2 |
| VIS-1 | Interactive 3D torso/heart (Three.js / WebGL / R3F / VTK.js) | PS 2.a | React Three Fiber heart viewer (F5) | T6.1 |
| VIS-2 | Color LAD/LCX/RCA dynamically by predicted stenosis probability | PS 2.b | Artery color = f(probability) (BR-5) | T6.3 |
| VIS-3 | Rotate, zoom, select regions to inspect vessel-specific risk | PS 2.c | Orbit + zoom, hover, click-to-select → vessel panel (F5, F6) | T6.3, T6.4 |
| DASH-1 | Show overall CAD status and vessel probabilities beside the 3D canvas | PS 3.a | Results panel (F4) | T5.3 |
| DASH-2 | Interpretable breakdown of the prediction (SHAP or LIME) | PS 3.b | Per-target SHAP (F6) | T3.3, T5.4 |
| DASH-3 | Physiological measurements with their relative contribution | PS 3.c | Contribution list: value, unit, dataset percentile, % contribution (F6) | T5.4 |
| ASSET-1 | Open-source anatomical meshes allowed (.obj/.gltf) | PS 4.a | Open-licensed heart mesh + attribution (D-019) | T6.1 |
| SAFE-1 | Clear, visible disclaimer: decision support / education only, not a substitute for diagnostic imaging | PS 5 | Persistent banner + result captions + legend note (F10) | T1.4, T5.3 |
| DEL-1 | Web prototype: interactive 3D viewer integrated with the ML backend | PS | F1–F11 working end to end | Phase 7 |
| DEL-2 | Trained pipeline: clean code + model weights | PS | `backend/ml/` + committed `backend/artifacts/models/` | T3.4 |
| DEL-3 | Explanation dashboard: prediction metrics, feature importances, patient physiological breakdown | PS | F6 + F9 | T5.4, T8.3 |
| DEL-4 | Documentation ≤ 6 pages: preprocessing, model architecture, 3D pipeline, usage, evaluation | PS | Project report | T11.2 |
| DEL-5 | YouTube video 3–10 min: working system, input workflow, 3D interactions, technical implementation | PS | DEMO_FLOW §3 | T11.3 |
| SUB-1 | Devpost project description: what was built, problem, how it works | SG 1 | Written from PRODUCT_SPEC §1 | T11.5 |
| SUB-2 | Public GitHub repo with README: setup, prerequisites/dependencies, how to run | SG 2 | README (Windows-first, plus macOS/Linux) | T10.3 |
| SUB-3 | Video on YouTube (unlisted OK, private not), shows the project running and explains the approach, English audio or subtitles | SG 3 | DEMO_FLOW §3 | T11.3 |
| SUB-4 | Team info with real full name; Devpost account added to the submission (needed for the certificate) | SG 4 | Satvik's Devpost profile | T11.5 |
| TC-1 | Responsive 3D in modern browsers without a dedicated GPU | PS | Performance plan (ARCHITECTURE §7) | T10.1 |
| TC-2 | Add clinical features, models or anatomical structures without redesign | PS | Schema-driven form, target registry, vessel registry (ARCHITECTURE §6) | T2.2, T4.1, T6.2 |
| TC-3 | Consistent correspondence between model outputs and displayed LAD/LCX/RCA | PS | One target-id key end to end + consistency test (ARCHITECTURE §6) | T6.2, T6.3, T9.2 |

## 4. Constraints

| Constraint | Impact |
|---|---|
| Solo builder, ~7 calendar days left (Oct 7 → Oct 14 EOD) | Strict scope; feature freeze Oct 12 23:59 IST; Oct 13–14 reserved for testing, report, video, submission |
| Dataset: UCI "extention of Z-Alizadeh sani dataset" — 303 patients, `.xlsx`, CC BY 4.0, no missing values (per UCI page) | Small data → noisy metrics; repeated CV with mean ± std; no deep learning; no hyperparameter search |
| Dataset note: CAD occurs when at least one of LAD/LCX/RCA is stenotic; only one of LAD/LCX/RCA/Cath may be kept per classification task | Leakage guard is non-negotiable |
| Features are tabular findings (e.g., "ST elevation: yes/no"), not raw ECG/echo signals or images | We must not claim signal/image analysis or lesion localization |
| Must run on laptops without a dedicated GPU | CPU-only ML; lightweight 3D (on-demand rendering, capped pixel ratio) |
| Satvik provides all installs, downloads, assets and accounts (CLAUDE_RULES §10) | Explicit hand-off tasks in BUILD_MAP |
| Health domain | Safe wording, visible disclaimers, no invented clinical claims |
| Devpost submission: public repo, YouTube video (3–10 min, English), real full name | Phase 11 tasks |

## 5. Judging criteria → what wins each

| Criterion | Weight | What judges reward | Our plan |
|---|---|---|---|
| Predictive performance | 30% | Classification performance, risk-estimation quality, validation methodology | Repeated stratified 5-fold CV (×5), mean ± std, baseline comparison, calibration (Brier + reliability plot), leakage guard, held-out samples with ground truth. No inflated or cherry-picked numbers |
| 3D visualization | 25% | Anatomical representation, spatial risk mapping, interaction | Real heart mesh with clearly separated LAD/LCX/RCA, smooth orbit/zoom, hover/click, view presets, legend stating exactly what color means |
| Clinical interpretability | 20% | Feature attribution quality, clarity, physiological breakdown | Per-vessel SHAP grouped to original features; values + units + dataset percentile; plain-language summary; global importance |
| System integration | 15% | Data pipeline, model–dashboard integration, real-time updates | Schema-driven form; live re-prediction on edit (what-if); 3D ↔ panel sync |
| Technical implementation | 10% | Architecture, code quality, reproducibility, use of public datasets/anatomical resources | One-command training, pinned versions, fixed seeds, committed artifacts, tests, clear README, proper attributions |

## 6. Minimum feature set (must ship)

1. Four trained models with leakage guard and cross-validated metrics (F3, F9).
2. Patient input: held-out sample patients + editable schema-driven form (F1, F2).
3. Results panel: CAD status + LAD/LCX/RCA probabilities (F4).
4. 3D heart with three colored, selectable arteries; rotate/zoom; legend (F5).
5. Per-target SHAP explanation with measurements and relative contribution (F6).
6. Visible disclaimer wherever predictions appear (F10).
7. Loading/error fallbacks, including 3D load failure (F11).
8. README, report, video, Devpost submission.

## 7. Differentiators (three only)

| ID | Differentiator | Why it is credible | Criterion targeted |
|---|---|---|---|
| DIFF-1 | **What-if explorer** — change a measurement (quick controls for the most influential features) and watch probabilities, 3D colors and explanations update live, with before → after deltas and one-click reset | Uses the trained models directly; framed as model sensitivity, not treatment effect | System integration, interpretability, demo impact |
| DIFF-2 | **Honest validation** — six patients held out from all training and CV; after predicting, reveal the dataset's angiography labels next to the estimates; evaluation page shows mean ± std over 25 folds against a baseline, plus calibration | Shows real behaviour including misses; answers "validation methodology" and "risk estimation quality" directly | Predictive performance (30%) |
| DIFF-3 | **Vessel-linked explanations** — clicking an artery in 3D (or in the list) opens that vessel's own model explanation; 3D and panels stay in sync | Each vessel has its own model and SHAP values, so the 3D view is functional, not decorative | 3D visualization, interpretability |

Quality attributes designed in (not separate features): color-blind-safe risk encoding with text labels, no storage of entered data, runs on integrated graphics.

## 8. Explicit non-goals

- No diagnosis, treatment advice or lesion localization (the dataset has no position information along an artery).
- No generative AI or chatbot (not required by Track A; adds hallucination risk in a health context) — D-008.
- No accounts, authentication, database or stored patient data — D-005, D-006.
- No torso model; no mobile-first layout (judging happens on laptops/desktops).
- No hyperparameter tuning, deep learning or external datasets.
- No public deployment unless Satvik approves later (requires accounts) — D-024.

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No suitable open-licensed heart mesh found quickly | Medium | High (25% criterion) | Search criteria in T6.1; proxy-heart fallback keeps the vessel mapping working |
| Vessel-level metrics are modest | High | Medium | Report honestly with mean ± std and baseline; emphasize methodology; never cherry-pick |
| Column names or encodings differ from expectations | Medium | Medium | T2.1 inspection checkpoint before any modeling; DATA_MODEL updated with approval |
| CAD and vessel models disagree for a patient | Medium | Low | Agreement note (BR-6) instead of silently forcing consistency |
| SHAP units differ by model family (log-odds vs probability) | High | Medium | UI shows signed relative contribution (%); units documented in the API (D-017) |
| Windows install problems (Python ML wheels) | Medium | Medium | Python 3.13 (D-025), wheels confirmed at T1.3; pinned versions; README troubleshooting |
| Running out of time | High | High | Feature freeze Oct 12 23:59 IST; cut list in BUILD_MAP §3 |
| Exact Devpost deadline time/time zone unknown | Medium | High | Satvik confirms on Devpost; plan submits Oct 14 by 18:00 IST |

## 10. Honesty boundaries

**We can say:** "estimates the probability of ≥50% narrowing in each vessel from routine clinical data"; "validated with repeated stratified 5-fold cross-validation on the training patients"; "explains each estimate with SHAP values".

**We cannot say:** "diagnoses CAD", "detects or locates blockages", "clinically validated", "accurate" without numbers, "analyzes ECG/echo signals", "generalizes to other populations" (303-patient research dataset).
