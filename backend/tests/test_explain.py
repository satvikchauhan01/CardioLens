"""T3.3: SHAP explanations (BR-7, BR-8)."""

import numpy as np
import pytest

from ml.explain import (
    TargetExplainer,
    build_summary,
    direction,
    format_number,
    format_value,
    global_importance,
    group_by_feature,
    percentile,
    relative_contributions,
    sentence_label,
)
from ml.models import MODEL_TYPES, SHAP_UNITS, make_pipeline
from ml.preprocessing import transformed_to_feature

TARGET = "lad"


@pytest.fixture(scope="module", params=MODEL_TYPES)
def fitted(request, schema, train_features, train_labels, reference_values):
    """(explainer, pipeline) for each model type, fitted on the training rows."""
    model_type = request.param
    pipeline = make_pipeline(model_type, schema).fit(train_features, train_labels[TARGET])
    preprocessor = pipeline.named_steps["preprocess"]
    linear = model_type == "logistic_regression"
    bundle = {
        "target": TARGET,
        "model_type": model_type,
        "pipeline": pipeline,
        "feature_ids": list(train_features.columns),
        "transformed_to_feature": transformed_to_feature(preprocessor),
        "shap_units": SHAP_UNITS[model_type],
        "shap_background": preprocessor.transform(train_features) if linear else None,
    }
    return TargetExplainer(bundle, schema, reference_values), pipeline


def model_output(explainer, pipeline, features) -> np.ndarray:
    """The model output in the units its SHAP values are expressed in."""
    if explainer.shap_units == "probability":
        return pipeline.predict_proba(features)[:, 1]
    return pipeline.decision_function(features)


def test_additivity_holds_for_each_model_type(fitted, train_features):
    explainer, pipeline = fitted
    rows = train_features.iloc[:60]
    grouped, base = explainer.grouped_shap(rows)

    assert grouped.shape == (60, train_features.shape[1])
    np.testing.assert_allclose(base + grouped.sum(axis=1), model_output(explainer, pipeline, rows), atol=1e-8)


def test_base_value_is_the_expected_output_over_training_rows(fitted, train_features):
    explainer, pipeline = fitted
    _, base = explainer.grouped_shap(train_features.iloc[:1])
    mean_output = model_output(explainer, pipeline, train_features).mean()

    # Exact for the linear and boosted models; the forest uses its trees' own training statistics.
    tolerance = 0.01 if explainer.model_type == "random_forest" else 1e-8
    assert base == pytest.approx(mean_output, abs=tolerance)


def test_explanation_of_a_held_out_patient(fitted, dataset, holdout_rows, schema):
    explainer, pipeline = fitted
    patient = dataset.features.loc[[holdout_rows[0]]]
    explanation = explainer.explain(patient)
    contributions = explanation["contributions"]
    kind = {entry["id"]: entry["type"] for entry in schema}

    assert set(explanation) == {
        "model_type", "shap_units", "base_value", "output_value", "contributions", "summary",
    }
    assert explanation["shap_units"] == SHAP_UNITS[explanation["model_type"]]
    assert [item["feature"] for item in contributions] != dataset.feature_ids
    assert {item["feature"] for item in contributions} == set(dataset.feature_ids)
    magnitudes = [abs(item["shap"]) for item in contributions]
    assert magnitudes == sorted(magnitudes, reverse=True)
    assert sum(abs(item["relative"]) for item in contributions) == pytest.approx(1.0)
    assert explanation["output_value"] == pytest.approx(
        explanation["base_value"] + sum(item["shap"] for item in contributions)
    )
    assert explanation["output_value"] == pytest.approx(model_output(explainer, pipeline, patient)[0])
    for item in contributions:
        assert item["value"] == patient[item["feature"]].iloc[0]
        assert type(item["value"]) in (int, float, bool, str)
        assert item["direction"] == direction(item["shap"])
        assert np.sign(item["relative"]) == np.sign(item["shap"])
        if kind[item["feature"]] == "numeric":
            assert isinstance(item["percentile"], int) and 0 <= item["percentile"] <= 100
        else:
            assert item["percentile"] is None
    assert explanation["summary"].startswith("Factor")
    assert explanation["summary"] == build_summary(contributions, explainer.schema_by_id)


def test_grouping_sums_transformed_columns_per_feature():
    values = np.array([[1.0, 2.0, 3.0, 4.0], [0.5, -0.5, 1.5, -2.0]])
    grouped = group_by_feature(values, ["a", "b", "b", "c"], ["c", "a", "b"])

    assert grouped.tolist() == [[4.0, 1.0, 5.0], [-2.0, 0.5, 1.0]]


def test_one_hot_parts_are_summed_back_to_one_contribution(fitted, train_features):
    explainer, _ = fitted
    grouped, _ = explainer.grouped_shap(train_features.iloc[:5])
    assert explainer.transformed_to_feature.count("bbb") == 3
    assert grouped.shape[1] == len(explainer.feature_ids) < len(explainer.transformed_to_feature)


def test_relative_contributions():
    assert relative_contributions(np.array([2.0, -1.0, 1.0])).tolist() == [0.5, -0.25, 0.25]
    assert relative_contributions(np.zeros(3)).tolist() == [0.0, 0.0, 0.0]


def test_direction():
    assert [direction(value) for value in (0.2, -0.2, 0.0)] == ["raises", "lowers", "neutral"]


def test_percentile_edges():
    reference = [1, 2, 2, 4]
    assert [percentile(value, reference) for value in (0, 1, 2, 3.9, 4, 99)] == [0, 25, 75, 75, 100, 100]
    # 1 of 8 = 12.5%: halves round up.
    assert percentile(1, [1, 2, 3, 4, 5, 6, 7, 8]) == 13


def test_number_and_value_formatting():
    assert format_number(67, 1) == "67"
    assert format_number(29.387755, 0.1) == "29.4"
    assert format_number(30.0, 0.1) == "30"
    assert format_number(1.15, 0.05) == "1.15"
    assert format_number(0.7, 0.05) == "0.7"

    numeric = {"type": "numeric", "step": 1}
    assert format_value({**numeric, "unit": "years"}, 67) == "67 years"
    assert format_value({**numeric, "unit": "%"}, 55) == "55%"
    assert format_value({**numeric, "unit": None}, 2) == "2"
    assert format_value({"type": "binary"}, True) == "yes"
    assert format_value({"type": "binary"}, False) == "no"
    assert format_value({"type": "categorical"}, "LBBB") == "LBBB"


def test_sentence_label_keeps_abbreviations():
    assert sentence_label("Age") == "age"
    assert sentence_label("Regions with RWMA") == "regions with RWMA"
    assert sentence_label("ST elevation") == "ST elevation"
    assert sentence_label("Q wave") == "Q wave"
    assert sentence_label("T-wave inversion") == "T-wave inversion"


SUMMARY_SCHEMA = {
    "typical_chest_pain": {"label": "Typical chest pain", "type": "binary"},
    "age": {"label": "Age", "type": "numeric", "unit": "years", "step": 1},
    "region_rwma": {"label": "Regions with RWMA", "type": "numeric", "unit": None, "step": 1},
    "ef_tte": {"label": "Ejection fraction", "type": "numeric", "unit": "%", "step": 1},
    "bmi": {"label": "Body mass index", "type": "numeric", "unit": "kg/m²", "step": 0.1},
}


def _item(feature, value, shap):
    return {"feature": feature, "value": value, "shap": shap}


def test_summary_with_raising_and_lowering_factors():
    contributions = [
        _item("typical_chest_pain", True, 0.07),
        _item("age", 67, 0.03),
        _item("ef_tte", 55, -0.02),
        _item("region_rwma", 2, 0.015),
        _item("bmi", 31.24, 0.01),
    ]
    assert build_summary(contributions, SUMMARY_SCHEMA) == (
        "Factors that most increased this estimate: typical chest pain (yes), age (67 years), "
        "regions with RWMA (2). Factor that most decreased it: ejection fraction (55%)."
    )


def test_summary_without_a_lowering_factor():
    contributions = [_item("age", 67, 0.03), _item("ef_tte", 55, 0.0)]
    assert build_summary(contributions, SUMMARY_SCHEMA) == (
        "Factor that most increased this estimate: age (67 years)."
    )


def test_summary_without_a_raising_factor():
    contributions = [_item("ef_tte", 55, -0.02), _item("bmi", 24.96, -0.01), _item("age", 40, 0.0)]
    assert build_summary(contributions, SUMMARY_SCHEMA) == (
        "Factor that most decreased this estimate: ejection fraction (55%)."
    )


def test_summary_when_nothing_contributes():
    assert build_summary([_item("age", 40, 0.0)], SUMMARY_SCHEMA) == "No factor changed this estimate."


def test_global_importance_shares():
    grouped = np.array([[1.0, -3.0, 0.0], [-1.0, 1.0, 0.0]])
    ranking = global_importance(grouped, ["a", "b", "c"])

    assert ranking == [
        {"feature": "b", "share": pytest.approx(2 / 3)},
        {"feature": "a", "share": pytest.approx(1 / 3)},
        {"feature": "c", "share": 0.0},
    ]
    assert all(item["share"] == 0 for item in global_importance(np.zeros((2, 3)), ["a", "b", "c"]))


def test_global_importance_on_a_fitted_model(fitted, train_features):
    explainer, _ = fitted
    grouped, _ = explainer.grouped_shap(train_features)
    ranking = global_importance(grouped, explainer.feature_ids)

    assert sum(item["share"] for item in ranking) == pytest.approx(1.0)
    shares = [item["share"] for item in ranking]
    assert shares == sorted(shares, reverse=True)
