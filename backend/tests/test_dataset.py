"""T2.1 to T2.3: loader, feature metadata, leakage guard, held-out samples, schema."""

import re

import pandas as pd
import pytest

from ml.config import (
    EXCLUDED_COLUMNS,
    FEATURE_GROUPS,
    FEATURE_METADATA,
    FEATURES,
    HOLDOUT_NOTE,
    HOLDOUT_SLOTS,
    TARGET_IDS,
    TARGETS,
    VESSEL_IDS,
    feature_id,
)
from ml.dataset import (
    DatasetError,
    LeakageError,
    assert_no_leakage,
    build_samples,
    consistent_rows,
    encode_labels,
    load_raw,
    select_holdout,
    stenotic_count,
    to_canonical,
)
from ml.inspect_data import build_report

LABEL_COLUMNS = [target.source_column for target in TARGETS]


# --- T2.1 loader -----------------------------------------------------------------------------


def test_loads_303_rows_with_all_label_columns(raw):
    assert len(raw) == 303
    assert set(LABEL_COLUMNS) <= set(raw.columns)
    assert not raw.isna().any().any()


def test_missing_file_gives_a_clear_error(tmp_path):
    with pytest.raises(DatasetError, match="Dataset file not found") as error:
        load_raw(tmp_path / "nope.xlsx")
    assert "backend/data/raw" in str(error.value)


def test_unexpected_columns_are_rejected(raw, tmp_path, monkeypatch):
    changed = raw.rename(columns={"Age": "Age (years)"})
    monkeypatch.setattr("ml.dataset.read_sheet", lambda path: changed)

    with pytest.raises(DatasetError, match="Unexpected columns") as error:
        load_raw(tmp_path / "any.xlsx")
    assert "'Age'" in str(error.value) and "'Age (years)'" in str(error.value)


def test_inspection_report_states_the_file_facts():
    report = build_report()

    assert "303 × 59" in report
    assert "| Columns missing from the file | none |" in report
    assert "| Zero-variance input columns (dropped) | Exertional CP |" in report
    assert "Rows where `Cath` ≠ (LAD ∨ LCX ∨ RCA): **1**" in report


# --- T2.2 metadata, normalization, leakage guard ----------------------------------------------


def test_every_non_label_column_has_metadata(raw):
    assert set(raw.columns) - set(LABEL_COLUMNS) == set(FEATURE_METADATA)


def test_feature_ids_are_unique_snake_case():
    ids = [feature.id for feature in FEATURES]
    assert len(ids) == len(set(ids)) == 55
    assert all(re.fullmatch(r"[a-z0-9]+(_[a-z0-9]+)*", identifier) for identifier in ids)
    assert feature_id("EF-TTE") == "ef_tte"
    assert feature_id("Region RWMA") == "region_rwma"


def test_features_use_known_groups_and_types():
    groups = {group["id"] for group in FEATURE_GROUPS}
    assert {feature.group for feature in FEATURES} == groups
    assert {feature.type for feature in FEATURES} == {"numeric", "binary", "categorical", "ordinal"}


def test_every_raw_value_is_mapped_to_a_canonical_type(raw):
    canonical = to_canonical(raw)

    assert list(canonical.columns) == [feature.id for feature in FEATURES]
    for feature in FEATURES:
        column = canonical[feature.id]
        if feature.type == "numeric":
            assert pd.api.types.is_numeric_dtype(column)
        elif feature.type == "binary":
            assert column.dtype == bool
        else:
            assert set(column) <= set(feature.values.values())
    assert set(canonical["sex"]) == {"Male", "Female"}
    assert set(canonical["bbb"]) == {"None", "LBBB", "RBBB"}
    assert set(canonical["vhd"]) == {"None", "Mild", "Moderate", "Severe"}
    assert canonical["dm"].sum() == (raw["DM"] == 1).sum()
    assert canonical["obesity"].sum() == (raw["Obesity"] == "Y").sum()


@pytest.mark.parametrize(("column", "value"), [("Obesity", "Yes"), ("DM", 2), ("Sex", "F"), ("VHD", "Mild")])
def test_unmapped_raw_value_raises(raw, column, value):
    changed = raw.copy()
    changed[column] = changed[column].astype(object)
    changed.at[0, column] = value

    with pytest.raises(DatasetError, match="no canonical mapping"):
        to_canonical(changed)


def test_unexpected_label_value_raises(raw):
    changed = raw.copy()
    changed.at[0, "Cath"] = "Cad"

    with pytest.raises(DatasetError, match='Label column "Cath"'):
        encode_labels(changed)


def test_labels_are_encoded_as_0_1(dataset, raw):
    assert list(dataset.labels.columns) == list(TARGET_IDS)
    assert set(dataset.labels.to_numpy().ravel()) == {0, 1}
    assert dataset.labels["cad"].sum() == (raw["Cath"] == "CAD").sum() == 216
    assert dataset.labels["lad"].sum() == (raw["LAD"] == "Stenotic").sum()


def test_inputs_exclude_every_label_column(dataset):
    excluded_ids = {feature_id(column) for column in EXCLUDED_COLUMNS}
    assert EXCLUDED_COLUMNS == ("LAD", "LCX", "RCA", "Cath")
    assert not excluded_ids & set(dataset.feature_ids)
    assert not set(TARGET_IDS) & set(dataset.feature_ids)


@pytest.mark.parametrize("leaked", ["LAD", "lcx", "RCA", "Cath", "cad"])
def test_leakage_guard_raises_when_violated(dataset, leaked):
    with pytest.raises(LeakageError, match="Leakage guard"):
        assert_no_leakage([*dataset.feature_ids, leaked])


def test_zero_variance_column_is_dropped_and_listed(dataset):
    assert dataset.dropped == ({"source_column": "Exertional CP", "reason": "zero variance"},)
    assert "exertional_cp" not in dataset.feature_ids
    assert len(dataset.feature_ids) == 54


# --- T2.3 held-out samples, schema, reference values -------------------------------------------


def test_holdout_is_deterministic(dataset, holdout_rows):
    assert select_holdout(dataset.labels) == holdout_rows
    assert select_holdout(dataset.labels, seed=7) != holdout_rows


def test_holdout_follows_the_slot_rule(dataset, holdout_rows):
    count = stenotic_count(dataset.labels)
    assert [int(count[row]) for row in holdout_rows] == list(HOLDOUT_SLOTS)
    assert len(set(holdout_rows)) == len(HOLDOUT_SLOTS) == 6
    assert consistent_rows(dataset.labels)[holdout_rows].all()

    single = [row for row in holdout_rows if count[row] == 1]
    vessels = [next(v for v in VESSEL_IDS if dataset.labels.at[row, v] == 1) for row in single]
    assert len(set(vessels)) == 2


def test_inconsistent_row_is_never_a_sample(dataset):
    inconsistent = dataset.labels.index[~consistent_rows(dataset.labels)]
    assert len(inconsistent) == 1
    for seed in range(25):
        assert not set(select_holdout(dataset.labels, seed=seed)) & set(inconsistent)


def test_samples_are_disjoint_from_training_rows(dataset, holdout_rows, train_rows):
    assert len(train_rows) == 297
    assert not set(train_rows) & set(holdout_rows)
    assert set(train_rows) | set(holdout_rows) == set(dataset.features.index)


def test_samples_have_the_contract_shape(dataset, holdout_rows):
    samples = build_samples(dataset, holdout_rows)

    assert [sample["id"] for sample in samples] == [f"sample-{letter}" for letter in "abcdef"]
    assert samples[0]["title"] == "Sample A"
    for sample, row in zip(samples, holdout_rows):
        assert set(sample["features"]) == set(dataset.feature_ids)
        assert set(sample["ground_truth"]) == set(TARGET_IDS)
        assert set(sample["ground_truth"].values()) <= {0, 1}
        assert sample["subtitle"] == f"{sample['features']['age']} y · {sample['features']['sex']}"
        assert sample["note"] == HOLDOUT_NOTE
        assert sample["source_row"] == row
        assert all(type(value) in (int, float, bool, str) for value in sample["features"].values())


def test_schema_matches_the_dataset(dataset, schema):
    assert [entry["id"] for entry in schema] == dataset.feature_ids
    for entry in schema:
        column = dataset.features[entry["id"]]
        if entry["type"] == "numeric":
            assert entry["min"] == column.min() and entry["max"] == column.max()
            assert entry["min"] <= entry["default"] <= entry["max"]
            assert entry["step"] > 0
            assert entry["integer"] == bool((column % 1 == 0).all())
            assert entry["categories"] is None
        elif entry["type"] == "binary":
            assert isinstance(entry["default"], bool)
            assert entry["min"] is entry["max"] is entry["step"] is entry["categories"] is None
        else:
            assert set(entry["categories"]) == set(column)
            assert entry["default"] in entry["categories"]
    by_id = {entry["id"]: entry for entry in schema}
    assert by_id["vhd"]["categories"] == ["None", "Mild", "Moderate", "Severe"]
    assert by_id["age"] | {"default": None} == {
        "id": "age", "source_column": "Age", "label": "Age", "description": None,
        "group": "demographic_history", "type": "numeric", "unit": "years", "integer": True,
        "min": 30, "max": 86, "step": 1, "categories": None, "default": None,
    }


def test_schema_defaults_come_from_training_rows(dataset, schema, train_rows):
    by_id = {entry["id"]: entry for entry in schema}
    train = dataset.features.loc[train_rows]
    assert by_id["age"]["default"] == train["age"].median()
    assert by_id["bmi"]["default"] == train["bmi"].median()
    assert by_id["sex"]["default"] == train["sex"].mode()[0]
    assert by_id["htn"]["default"] == bool(train["htn"].mode()[0])


def test_every_sample_is_valid_against_the_schema(dataset, holdout_rows, schema):
    for sample in build_samples(dataset, holdout_rows):
        for entry in schema:
            value = sample["features"][entry["id"]]
            if entry["type"] == "numeric":
                assert entry["min"] <= value <= entry["max"]
                assert not entry["integer"] or isinstance(value, int)
            elif entry["type"] == "binary":
                assert isinstance(value, bool)
            else:
                assert value in entry["categories"]


def test_reference_values_are_sorted_training_values(schema, reference_values, train_rows):
    numeric = [entry["id"] for entry in schema if entry["type"] == "numeric"]
    assert list(reference_values) == numeric
    for values in reference_values.values():
        assert len(values) == len(train_rows)
        assert values == sorted(values)
