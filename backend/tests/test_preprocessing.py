"""T3.1: preprocessing and candidate models."""

from collections import Counter

import numpy as np
import pytest

from ml.config import EXCLUDED_IDS
from ml.dataset import LeakageError
from ml.models import BASELINE, MODEL_TYPES, SHAP_UNITS, make_classifier, make_pipeline
from ml.preprocessing import build_preprocessor, transformed_to_feature


@pytest.fixture(scope="module")
def fitted(schema, train_features):
    return build_preprocessor(schema).fit(train_features)


def test_mapping_length_equals_transformed_width(fitted, schema, train_features):
    transformed = fitted.transform(train_features)
    mapping = transformed_to_feature(fitted)

    assert isinstance(transformed, np.ndarray)
    assert transformed.shape == (len(train_features), len(mapping))
    per_feature = Counter(mapping)
    for entry in schema:
        width = len(entry["categories"]) if entry["type"] == "categorical" else 1
        assert per_feature[entry["id"]] == width
    assert len(mapping) == len(fitted.get_feature_names_out())


def test_mapping_follows_the_output_column_order(fitted):
    mapping = transformed_to_feature(fitted)
    for name, feature in zip(fitted.get_feature_names_out(), mapping):
        assert name.split("__", 1)[1].startswith(feature)


def test_each_type_is_encoded_as_specified(fitted, schema, train_features):
    transformed = fitted.transform(train_features)
    mapping = transformed_to_feature(fitted)
    kind = {entry["id"]: entry["type"] for entry in schema}

    for column, feature in enumerate(mapping):
        values = transformed[:, column]
        if kind[feature] == "numeric":
            assert abs(values.mean()) < 1e-9 and abs(values.std() - 1) < 1e-9
        elif kind[feature] in ("binary", "categorical"):
            assert set(values) <= {0.0, 1.0}
    vhd = transformed[:, mapping.index("vhd")]
    order = {"None": 0, "Mild": 1, "Moderate": 2, "Severe": 3}
    assert list(vhd) == [order[value] for value in train_features["vhd"]]
    sex = transformed[:, [i for i, feature in enumerate(mapping) if feature == "sex"]]
    assert (sex.sum(axis=1) == 1).all()


def test_no_label_column_reaches_the_preprocessor(schema, dataset, fitted):
    used = {column for _, _, columns in build_preprocessor(schema).transformers for column in columns}
    assert used == set(dataset.feature_ids)
    assert not used & EXCLUDED_IDS

    with_labels = dataset.features.join(dataset.labels)
    assert fitted.transform(with_labels).shape[1] == len(transformed_to_feature(fitted))


@pytest.mark.parametrize("label", ["lad", "lcx", "rca", "cath", "cad"])
def test_schema_containing_a_label_is_rejected(schema, label):
    with pytest.raises(LeakageError):
        build_preprocessor([*schema, {**schema[0], "id": label}])


def test_unknown_category_is_ignored(fitted, train_features):
    row = train_features.iloc[[0]].copy()
    row["sex"] = "Other"
    mapping = transformed_to_feature(fitted)
    sex = fitted.transform(row)[0, [i for i, feature in enumerate(mapping) if feature == "sex"]]
    assert list(sex) == [0.0, 0.0]


@pytest.mark.parametrize("model_type", [*MODEL_TYPES, BASELINE])
def test_each_pipeline_fits_and_predicts(model_type, schema, train_features, train_labels):
    pipeline = make_pipeline(model_type, schema).fit(train_features, train_labels["lad"])
    probabilities = pipeline.predict_proba(train_features)

    assert list(pipeline.classes_) == [0, 1]
    assert probabilities.shape == (len(train_features), 2)
    assert ((probabilities >= 0) & (probabilities <= 1)).all()


def test_candidates_use_fixed_settings():
    forest = make_classifier("random_forest")
    assert (forest.n_estimators, forest.random_state) == (300, 42)
    assert make_classifier("gradient_boosting").random_state == 42
    assert make_classifier("logistic_regression").max_iter == 1000
    assert make_classifier(BASELINE).strategy == "prior"
    assert set(SHAP_UNITS) == set(MODEL_TYPES)
    with pytest.raises(ValueError, match="Unknown model type"):
        make_classifier("xgboost")
