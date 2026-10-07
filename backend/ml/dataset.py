"""Load the dataset, normalize it to canonical values, and build the schema and held-out samples."""

import hashlib
import math
import string
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from ml.config import (
    BINARY_VALUES,
    DATA_FILE_NAME,
    DATA_PATH,
    DATA_SHEET,
    DATASET_URL,
    EXCLUDED_IDS,
    FEATURES,
    FEATURES_BY_ID,
    HOLDOUT_NOTE,
    HOLDOUT_SLOTS,
    SEED,
    TARGET_IDS,
    TARGETS,
    VESSEL_IDS,
    feature_id,
)


class DatasetError(ValueError):
    """The dataset file is missing or does not match DATA_MODEL."""


class LeakageError(DatasetError):
    """A label column was about to be used as a model input (BR-2)."""


@dataclass(frozen=True)
class Dataset:
    features: pd.DataFrame  # canonical inputs, one column per feature id, zero-variance columns removed
    labels: pd.DataFrame  # 0/1, one column per target id
    dropped: tuple[dict[str, str], ...]  # {"source_column", "reason"} per removed input column

    @property
    def feature_ids(self) -> list[str]:
        return list(self.features.columns)


def read_sheet(path: Path = DATA_PATH) -> pd.DataFrame:
    """Read the data sheet as it is, without validation."""
    if not path.is_file():
        raise DatasetError(
            f"Dataset file not found: {path}\n"
            f'Download it from {DATASET_URL} and put "{DATA_FILE_NAME}" in backend/data/raw/.'
        )
    try:
        return pd.read_excel(path, sheet_name=DATA_SHEET)
    except ValueError as error:
        raise DatasetError(f'Sheet "{DATA_SHEET}" not found in {path.name}.') from error


def load_raw(path: Path = DATA_PATH) -> pd.DataFrame:
    """Read the data sheet and fail fast if its columns differ from FEATURE_METADATA + labels."""
    raw = read_sheet(path)
    expected = {feature.source_column for feature in FEATURES} | {t.source_column for t in TARGETS}
    missing = sorted(expected - set(raw.columns))
    unexpected = sorted(set(raw.columns) - expected)
    if missing or unexpected:
        raise DatasetError(
            f"Unexpected columns in {path.name}. Missing: {missing}. "
            f"Not in FEATURE_METADATA: {unexpected}."
        )
    with_gaps = sorted(raw.columns[raw.isna().any()])
    if with_gaps:
        raise DatasetError(f"{path.name} has missing values in: {with_gaps}.")
    return raw


def to_canonical(raw: pd.DataFrame) -> pd.DataFrame:
    """Map every input column to canonical values (DATA_MODEL §5.1); columns become feature ids."""
    columns = {}
    for feature in FEATURES:
        series = raw[feature.source_column]
        if feature.type == "numeric":
            if not pd.api.types.is_numeric_dtype(series) or pd.api.types.is_bool_dtype(series):
                raise DatasetError(f'Column "{feature.source_column}" must be numeric.')
            columns[feature.id] = series
            continue
        mapping = BINARY_VALUES if feature.type == "binary" else feature.values
        unmapped = sorted({value for value in series.unique() if value not in mapping}, key=str)
        if unmapped:
            raise DatasetError(
                f'Column "{feature.source_column}" has values with no canonical mapping: {unmapped}.'
            )
        mapped = series.map(mapping)
        columns[feature.id] = mapped.astype(bool) if feature.type == "binary" else mapped
    return pd.DataFrame(columns, index=raw.index)


def encode_labels(raw: pd.DataFrame) -> pd.DataFrame:
    """Encode the four label columns as 0/1 (DATA_MODEL §4); columns become target ids."""
    labels = {}
    for target in TARGETS:
        series = raw[target.source_column]
        encoding = {target.positive: 1, target.negative: 0}
        unexpected = sorted(set(series.unique()) - set(encoding), key=str)
        if unexpected:
            raise DatasetError(
                f'Label column "{target.source_column}" has unexpected values: {unexpected}. '
                f"Expected: {list(encoding)}."
            )
        labels[target.id] = series.map(encoding).astype(int)
    return pd.DataFrame(labels, index=raw.index)


def zero_variance_features(canonical: pd.DataFrame) -> list[str]:
    return [column for column in canonical.columns if canonical[column].nunique() == 1]


def assert_no_leakage(feature_names: Iterable[str]) -> None:
    """Leakage guard (BR-2): abort if a label column is among the model inputs."""
    leaked = sorted({feature_id(name) for name in feature_names} & EXCLUDED_IDS)
    if leaked:
        raise LeakageError(f"Leakage guard: label columns cannot be model inputs: {leaked}.")


def load_dataset(path: Path = DATA_PATH) -> Dataset:
    raw = load_raw(path)
    canonical = to_canonical(raw)
    constant = zero_variance_features(canonical)
    features = canonical.drop(columns=constant)
    assert_no_leakage(features.columns)
    dropped = tuple(
        {"source_column": FEATURES_BY_ID[column].source_column, "reason": "zero variance"}
        for column in constant
    )
    return Dataset(features=features, labels=encode_labels(raw), dropped=dropped)


def stenotic_count(labels: pd.DataFrame) -> pd.Series:
    return labels[list(VESSEL_IDS)].sum(axis=1)


def consistent_rows(labels: pd.DataFrame) -> pd.Series:
    """True where the overall label equals (LAD or LCX or RCA) (DATA_MODEL §4)."""
    return labels["cad"] == (stenotic_count(labels) > 0).astype(int)


def select_holdout(labels: pd.DataFrame, seed: int = SEED) -> list[int]:
    """Pick the held-out sample rows by the fixed rule of DATA_MODEL §5.3, in slot order A to F."""
    rng = np.random.default_rng(seed)
    count = stenotic_count(labels)
    eligible = consistent_rows(labels)

    def single_vessel(row: int) -> str:
        return next(vessel for vessel in VESSEL_IDS if labels.at[row, vessel] == 1)

    chosen: list[int] = []
    for wanted in HOLDOUT_SLOTS:
        free = eligible & ~labels.index.isin(chosen)
        pool = list(labels.index[free & (count == wanted)])
        if not pool:
            # Empty group: use the group with the most remaining rows.
            remaining = count[free].value_counts()
            largest = min(remaining.index, key=lambda group: (-remaining[group], group))
            pool = list(labels.index[free & (count == largest)])
        elif wanted == 1:
            # Prefer a stenotic vessel that no earlier single-vessel sample already shows.
            shown = {single_vessel(row) for row in chosen if count[row] == 1}
            pool = [row for row in pool if single_vessel(row) not in shown] or pool
        chosen.append(int(rng.choice(pool)))
    return chosen


def training_rows(dataset: Dataset, holdout_rows: list[int]) -> pd.Index:
    return dataset.features.index.difference(holdout_rows)


def plain_value(value):
    """numpy scalar -> plain Python value, so it can be written as JSON."""
    return value.item() if isinstance(value, np.generic) else value


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_samples(dataset: Dataset, holdout_rows: list[int]) -> list[dict]:
    samples = []
    for letter, row in zip(string.ascii_lowercase, holdout_rows):
        features = {
            column: plain_value(dataset.features.at[row, column]) for column in dataset.feature_ids
        }
        samples.append(
            {
                "id": f"sample-{letter}",
                "title": f"Sample {letter.upper()}",
                "subtitle": f"{features['age']} y · {features['sex']}",
                "features": features,
                "ground_truth": {target: int(dataset.labels.at[row, target]) for target in TARGET_IDS},
                "note": HOLDOUT_NOTE,
                "source_row": int(row),  # 0-based data row; spreadsheet row = source_row + 2
            }
        )
    return samples


def _most_frequent(values: pd.Series, order: Iterable) -> object:
    """Mode of `values`; ties go to the value that comes first in `order`."""
    counts = values.value_counts()
    return max(order, key=lambda value: counts.get(value, 0))


def build_feature_schema(dataset: Dataset, train_rows: pd.Index) -> list[dict]:
    """FeatureSchema entries (API_CONTRACT §3): ranges from all rows, defaults from training rows."""
    schema = []
    for column in dataset.feature_ids:
        feature = FEATURES_BY_ID[column]
        every = dataset.features[column]
        train = every.loc[train_rows]
        entry = {
            "id": feature.id,
            "source_column": feature.source_column,
            "label": feature.label,
            "description": feature.description,
            "group": feature.group,
            "type": feature.type,
            "unit": feature.unit,
            "integer": False,
            "min": None,
            "max": None,
            "step": None,
            "categories": None,
        }
        if feature.type == "numeric":
            integer = bool((every % 1 == 0).all())
            if not integer and feature.step is None:
                raise DatasetError(f'Non-integer column "{feature.source_column}" needs a step.')
            median = float(train.median())
            entry.update(
                integer=integer,
                min=int(every.min()) if integer else float(every.min()),
                max=int(every.max()) if integer else float(every.max()),
                step=feature.step or 1,
                default=math.floor(median + 0.5) if integer else median,
            )
        elif feature.type == "binary":
            entry["default"] = bool(_most_frequent(train, (False, True)))
        else:
            observed = set(every)
            entry["categories"] = [value for value in feature.values.values() if value in observed]
            entry["default"] = _most_frequent(train, entry["categories"])
        schema.append(entry)
    return schema


def build_reference_values(dataset: Dataset, train_rows: pd.Index) -> dict[str, list]:
    """Sorted training values per numeric feature, used for percentiles (DATA_MODEL §7.5)."""
    return {
        column: sorted(plain_value(value) for value in dataset.features.loc[train_rows, column])
        for column in dataset.feature_ids
        if FEATURES_BY_ID[column].type == "numeric"
    }
