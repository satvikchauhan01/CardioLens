"""Shared fixtures: the dataset is read once per test session."""

import pytest

from ml.dataset import (
    build_feature_schema,
    build_reference_values,
    load_dataset,
    load_raw,
    select_holdout,
    training_rows,
)


@pytest.fixture(scope="session")
def raw():
    return load_raw()


@pytest.fixture(scope="session")
def dataset():
    return load_dataset()


@pytest.fixture(scope="session")
def holdout_rows(dataset):
    return select_holdout(dataset.labels)


@pytest.fixture(scope="session")
def train_rows(dataset, holdout_rows):
    return training_rows(dataset, holdout_rows)


@pytest.fixture(scope="session")
def schema(dataset, train_rows):
    return build_feature_schema(dataset, train_rows)


@pytest.fixture(scope="session")
def reference_values(dataset, train_rows):
    return build_reference_values(dataset, train_rows)


@pytest.fixture(scope="session")
def train_features(dataset, train_rows):
    return dataset.features.loc[train_rows]


@pytest.fixture(scope="session")
def train_labels(dataset, train_rows):
    return dataset.labels.loc[train_rows]
