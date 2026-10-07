"""T3.2: metric helpers, model selection and the cross-validation loop."""

import numpy as np
import pytest
from sklearn.preprocessing import StandardScaler

from ml.config import TARGETS
from ml.evaluate import (
    METRICS,
    cross_validate,
    fold_metrics,
    predict_positive,
    select_model,
    specificity_score,
    write_plots,
)
from ml.models import BASELINE, MODEL_TYPES

SUBSET = 100


@pytest.fixture(scope="module")
def subset(train_features, train_labels):
    return train_features.iloc[:SUBSET], train_labels["lad"].iloc[:SUBSET]


@pytest.fixture(scope="module")
def validation(subset, schema):
    return cross_validate(*subset, schema, n_repeats=2)


def test_fold_metrics_on_toy_data():
    # At threshold 0.5: TP 2, FN 1, FP 1, TN 2.
    metrics = fold_metrics([1, 1, 1, 0, 0, 0], [0.9, 0.6, 0.4, 0.7, 0.2, 0.1])

    assert set(metrics) == set(METRICS)
    assert metrics["accuracy"] == pytest.approx(4 / 6)
    assert metrics["precision"] == pytest.approx(2 / 3)
    assert metrics["recall"] == pytest.approx(2 / 3)
    assert metrics["specificity"] == pytest.approx(2 / 3)
    assert metrics["f1"] == pytest.approx(2 / 3)
    assert metrics["roc_auc"] == pytest.approx(7 / 9)
    assert metrics["average_precision"] == pytest.approx((1 + 2 / 3 + 3 / 4) / 3)
    assert metrics["brier"] == pytest.approx(1.07 / 6)


def test_threshold_is_inclusive():
    assert list(predict_positive([0.5, 0.4999, 0.0, 1.0])) == [True, False, False, True]
    assert fold_metrics([1, 0], [0.5, 0.2])["recall"] == 1.0


def test_specificity():
    assert specificity_score([0, 0, 0, 1], [0, 1, 0, 1]) == pytest.approx(2 / 3)
    assert specificity_score([0, 0], [0, 0]) == 1.0
    assert specificity_score([1, 1], [1, 0]) == 0.0


def test_no_positive_prediction_scores_zero_without_warning(recwarn):
    metrics = fold_metrics([1, 0, 1, 0], [0.4, 0.1, 0.3, 0.2])

    assert (metrics["precision"], metrics["recall"], metrics["f1"]) == (0.0, 0.0, 0.0)
    assert metrics["specificity"] == 1.0
    assert not recwarn.list


def _with_auc(logistic, forest, boosting):
    values = dict(zip(MODEL_TYPES, (logistic, forest, boosting)))
    return {model: {"roc_auc": {"mean": value, "std": 0.0}} for model, value in values.items()}


@pytest.mark.parametrize(
    ("auc", "expected"),
    [
        ((0.90, 0.85, 0.80), ("logistic_regression", "Highest mean ROC-AUC")),
        ((0.80, 0.805, 0.79), ("logistic_regression", "Within 0.01 of best; simplest model preferred")),
        ((0.80, 0.79, 0.809), ("logistic_regression", "Within 0.01 of best; simplest model preferred")),
        ((0.80, 0.79, 0.811), ("gradient_boosting", "Highest mean ROC-AUC")),
        ((0.80, 0.85, 0.79), ("random_forest", "Highest mean ROC-AUC")),
        ((0.80, 0.82, 0.85), ("gradient_boosting", "Highest mean ROC-AUC")),
        ((0.80, 0.80, 0.80), ("logistic_regression", "Highest mean ROC-AUC")),
    ],
)
def test_select_model(auc, expected):
    assert select_model(_with_auc(*auc)) == expected


def test_cross_validation_reports_every_candidate_and_metric(validation):
    assert set(validation.metrics) == {*MODEL_TYPES, BASELINE}
    for scores in validation.metrics.values():
        assert set(scores) == set(METRICS)
        for stat in scores.values():
            assert set(stat) == {"mean", "std"}
            assert 0 <= stat["mean"] <= 1 and stat["std"] >= 0
    assert validation.metrics[BASELINE]["roc_auc"] == {"mean": 0.5, "std": 0.0}


def test_out_of_fold_predicts_every_row_once(validation):
    for probabilities in validation.out_of_fold.values():
        assert probabilities.shape == (SUBSET,)
        assert not np.isnan(probabilities).any()
        assert ((probabilities >= 0) & (probabilities <= 1)).all()


def test_cross_validation_is_deterministic(validation, subset, schema):
    again = cross_validate(*subset, schema, n_repeats=2)

    assert again.metrics == validation.metrics
    for model_type, probabilities in validation.out_of_fold.items():
        assert np.array_equal(again.out_of_fold[model_type], probabilities)


def test_preprocessing_is_fitted_inside_each_fold(subset, schema, monkeypatch):
    seen = []
    original = StandardScaler.fit

    def recording_fit(self, X, y=None, **kwargs):
        seen.append(len(X))
        return original(self, X, y, **kwargs)

    monkeypatch.setattr(StandardScaler, "fit", recording_fit)
    cross_validate(*subset, schema, model_types=("logistic_regression",), n_repeats=1)

    assert seen == [SUBSET * 4 // 5] * 5


def test_plots_are_written_for_a_target(validation, subset, tmp_path):
    target = next(target for target in TARGETS if target.id == "lad")
    paths = write_plots(tmp_path, target, subset[1], validation, "random_forest")

    assert paths == {
        "roc": "/static/plots/lad_roc.png",
        "calibration": "/static/plots/lad_calibration.png",
        "confusion": "/static/plots/lad_confusion.png",
    }
    for kind in paths:
        assert (tmp_path / f"lad_{kind}.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
