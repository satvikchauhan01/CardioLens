"""Paths, constants and hand-maintained feature metadata for the ML pipeline (DATA_MODEL)."""

import re
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_FILE_NAME = "extention of Z-Alizadeh sani dataset.xlsx"
DATA_PATH = BACKEND_DIR / "data" / "raw" / DATA_FILE_NAME
# The workbook's other sheet ("Sheet1") holds one row of column names from a larger table, no patients.
DATA_SHEET = "Sheet 1 - Table 1"
ARTIFACTS_DIR = BACKEND_DIR / "artifacts"

DATASET_NAME = "extention of Z-Alizadeh sani dataset"
DATASET_URL = "https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset"
DATASET_LICENSE = "CC BY 4.0"
DATASET_CITATION = (
    "Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). extention of Z-Alizadeh sani dataset "
    "[Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K."
)

SEED = 42

# Validation (DATA_MODEL §6)
N_SPLITS = 5
N_REPEATS = 5
DECISION_THRESHOLD = 0.5
SELECTION_TOLERANCE = 0.01
CALIBRATION_BINS = 5
GLOBAL_IMPORTANCE_TOP = 10
QUICK_CONTROL_COUNT = 8

# Display only (BR-4): [min, max), the last level includes 1.0.
RISK_LEVELS = (
    {"id": "low", "label": "Low", "min": 0.0, "max": 0.35},
    {"id": "moderate", "label": "Moderate", "min": 0.35, "max": 0.65},
    {"id": "high", "label": "High", "min": 0.65, "max": 1.0},
)

# Held-out sample patients (DATA_MODEL §5.3): number of stenotic vessels wanted per slot, A to F.
HOLDOUT_SLOTS = (3, 2, 1, 1, 0, 0)
HOLDOUT_NOTE = "Held out — not used for training or validation."


def feature_id(source_column: str) -> str:
    """snake_case id of a dataset column (DATA_MODEL §3), e.g. "EF-TTE" -> "ef_tte"."""
    return re.sub(r"[^a-z0-9]+", "_", source_column.lower()).strip("_")


@dataclass(frozen=True)
class Target:
    id: str
    source_column: str
    positive: str  # raw value encoded as 1
    negative: str  # raw value encoded as 0
    label: str
    short_label: str
    kind: str  # "overall" | "vessel"
    description: str


TARGETS = (
    Target(
        "cad", "Cath", "CAD", "Normal", "Coronary artery disease", "CAD", "overall",
        "At least one major coronary artery with ≥50% narrowing (dataset definition)",
    ),
    Target(
        "lad", "LAD", "Stenotic", "Normal", "Left Anterior Descending", "LAD", "vessel",
        "Supplies the front of the heart",
    ),
    Target(
        "lcx", "LCX", "Stenotic", "Normal", "Left Circumflex", "LCX", "vessel",
        "Supplies the side and back of the heart",
    ),
    Target(
        "rca", "RCA", "Stenotic", "Normal", "Right Coronary Artery", "RCA", "vessel",
        "Supplies the right side and bottom of the heart",
    ),
)
TARGET_IDS = tuple(target.id for target in TARGETS)
VESSEL_IDS = tuple(target.id for target in TARGETS if target.kind == "vessel")

# Leakage guard (BR-2): these dataset columns are never model inputs, for any target.
EXCLUDED_COLUMNS = ("LAD", "LCX", "RCA", "Cath")
EXCLUDED_IDS = frozenset(feature_id(column) for column in EXCLUDED_COLUMNS) | frozenset(TARGET_IDS)

FEATURE_GROUPS = (
    {"id": "demographic_history", "label": "Demographics & history"},
    {"id": "symptoms_exam", "label": "Symptoms & examination"},
    {"id": "ecg", "label": "ECG findings"},
    {"id": "laboratory", "label": "Laboratory"},
    {"id": "echo", "label": "Echocardiography"},
)

# Raw -> canonical for every binary column; each column uses one of the two encodings.
BINARY_VALUES = {"Y": True, "N": False, 1: True, 0: False}


@dataclass(frozen=True)
class Feature:
    source_column: str
    label: str
    group: str
    type: str  # "numeric" | "binary" | "categorical" | "ordinal"
    unit: str | None = None  # only when confirmed from the dataset's documentation (DATA_MODEL §3)
    description: str | None = None
    step: float | None = None  # numeric only; integer-valued columns default to 1
    values: dict[str, str] | None = None  # categorical/ordinal: raw -> canonical, in display order

    @property
    def id(self) -> str:
        return feature_id(self.source_column)


def _numeric(column, label, group, unit=None, description=None, step=None) -> Feature:
    return Feature(column, label, group, "numeric", unit, description, step)


def _binary(column, label, group, description=None) -> Feature:
    return Feature(column, label, group, "binary", description=description)


_DEMO, _EXAM, _ECG, _LAB, _ECHO = (group["id"] for group in FEATURE_GROUPS)

# One entry per input column of the dataset, in display order.
FEATURES = (
    _numeric("Age", "Age", _DEMO, "years"),
    _numeric("Weight", "Weight", _DEMO, "kg"),
    _numeric("Length", "Height", _DEMO, "cm", "Dataset column “Length”."),
    Feature("Sex", "Sex", _DEMO, "categorical", values={"Male": "Male", "Fmale": "Female"}),
    _numeric("BMI", "Body mass index", _DEMO, "kg/m²", step=0.1),
    _binary("DM", "Diabetes mellitus", _DEMO),
    _binary("HTN", "Hypertension", _DEMO),
    _binary("Current Smoker", "Current smoker", _DEMO),
    _binary("EX-Smoker", "Ex-smoker", _DEMO),
    _binary("FH", "Family history", _DEMO),
    _binary("Obesity", "Obesity", _DEMO, "Recorded as yes when BMI is above 25 (dataset definition)."),
    _binary("CRF", "Chronic renal failure", _DEMO),
    _binary("CVA", "Cerebrovascular accident", _DEMO),
    _binary("Airway disease", "Airway disease", _DEMO),
    _binary("Thyroid Disease", "Thyroid disease", _DEMO),
    _binary("CHF", "Congestive heart failure", _DEMO),
    _binary("DLP", "Dyslipidemia", _DEMO),
    _numeric("BP", "Blood pressure", _EXAM, "mmHg"),
    _numeric("PR", "Pulse rate", _EXAM, "ppm", "Pulses per minute (ppm)."),
    _binary("Edema", "Edema", _EXAM),
    _binary("Weak Peripheral Pulse", "Weak peripheral pulse", _EXAM),
    _binary("Lung rales", "Lung rales", _EXAM),
    _binary("Systolic Murmur", "Systolic murmur", _EXAM),
    _binary("Diastolic Murmur", "Diastolic murmur", _EXAM),
    _binary("Typical Chest Pain", "Typical chest pain", _EXAM),
    _binary("Dyspnea", "Dyspnea", _EXAM),
    _numeric("Function Class", "Function class", _EXAM),
    _binary("Atypical", "Atypical chest pain", _EXAM),
    _binary("Nonanginal", "Non-anginal chest pain", _EXAM),
    _binary("Exertional CP", "Exertional chest pain", _EXAM),
    _binary("LowTH Ang", "Low-threshold angina", _EXAM),
    _binary("Q Wave", "Q wave", _ECG),
    _binary("St Elevation", "ST elevation", _ECG),
    _binary("St Depression", "ST depression", _ECG),
    _binary("Tinversion", "T-wave inversion", _ECG),
    _binary("LVH", "Left ventricular hypertrophy", _ECG),
    _binary("Poor R Progression", "Poor R-wave progression", _ECG),
    Feature(
        "BBB", "Bundle branch block", _ECG, "categorical",
        description="LBBB: left bundle branch block. RBBB: right bundle branch block.",
        values={"N": "None", "LBBB": "LBBB", "RBBB": "RBBB"},
    ),
    _numeric("FBS", "Fasting blood sugar", _LAB, "mg/dL"),
    _numeric("CR", "Creatinine", _LAB, "mg/dL", step=0.05),
    _numeric("TG", "Triglycerides", _LAB, "mg/dL"),
    _numeric("LDL", "Low-density lipoprotein", _LAB, "mg/dL"),
    _numeric("HDL", "High-density lipoprotein", _LAB, "mg/dL", step=0.1),
    _numeric("BUN", "Blood urea nitrogen", _LAB, "mg/dL"),
    _numeric("ESR", "Erythrocyte sedimentation rate", _LAB, "mm/h"),
    _numeric("HB", "Hemoglobin", _LAB, "g/dL", step=0.1),
    _numeric("K", "Potassium", _LAB, "mEq/L", step=0.1),
    _numeric("Na", "Sodium", _LAB, "mEq/L"),
    _numeric("WBC", "White blood cell count", _LAB),
    _numeric("Lymph", "Lymphocytes", _LAB, "%"),
    _numeric("Neut", "Neutrophils", _LAB, "%"),
    _numeric("PLT", "Platelet count", _LAB),
    _numeric(
        "EF-TTE", "Ejection fraction", _ECHO, "%",
        "Measured by transthoracic echocardiography (TTE).",
    ),
    _numeric(
        "Region RWMA", "Regions with RWMA", _ECHO,
        description="Number of regions with regional wall motion abnormality (RWMA).",
    ),
    Feature(
        "VHD", "Valvular heart disease", _ECHO, "ordinal",
        values={"N": "None", "mild": "Mild", "Moderate": "Moderate", "Severe": "Severe"},
    ),
)

FEATURE_METADATA = {feature.source_column: feature for feature in FEATURES}
FEATURES_BY_ID = {feature.id: feature for feature in FEATURES}
