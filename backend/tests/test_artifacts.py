"""T3.4: the committed artifacts written by `python -m ml.train` (DATA_MODEL §7)."""

import json
import platform
import re
from importlib.metadata import version

import joblib
import pytest

from ml.config import (
    ARTIFACTS_DIR,
    DATA_FILE_NAME,
    DATA_PATH,
    DECISION_THRESHOLD,
    EXCLUDED_COLUMNS,
    FEATURE_GROUPS,
    GLOBAL_IMPORTANCE_TOP,
    N_REPEATS,
    N_SPLITS,
    QUICK_CONTROL_COUNT,
    SEED,
    TARGET_IDS,
)
from ml.dataset import assert_no_leakage, build_samples, file_sha256
from ml.evaluate import METRICS, cross_validate
from ml.models import BASELINE, MODEL_TYPES, SHAP_UNITS
from ml.train import MANIFEST_LIBRARIES, METRIC_DECIMALS

PLOT_KINDS = ("roc", "calibration", "confusion")
BUNDLE_KEYS = {
    "target", "model_type", "pipeline", "feature_ids", "transformed_to_feature",
    "shap_units", "shap_background", "sklearn_version",
}


def read(name: str):
    path = ARTIFACTS_DIR / name
    assert path.is_file(), f"{path} is missing. Run: python -m ml.train"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def manifest():
    return read("manifest.json")


@pytest.fixture(scope="module")
def metrics():
    return read("metrics.json")


@pytest.fixture(scope="module")
def schema_artifact():
    return read("feature_schema.json")


@pytest.fixture(scope="module")
def bundles():
    return {target: joblib.load(ARTIFACTS_DIR / "models" / f"{target}.joblib") for target in TARGET_IDS}


def test_every_target_has_a_model_metrics_and_plots(metrics):
    assert (ARTIFACTS_DIR / "data_report.md").is_file()
    assert list(metrics["targets"]) == list(TARGET_IDS)
    for target in TARGET_IDS:
        assert (ARTIFACTS_DIR / "models" / f"{target}.joblib").is_file()
        plots = metrics["targets"][target]["plots"]
        assert plots == {kind: f"/static/plots/{target}_{kind}.png" for kind in PLOT_KINDS}
        for kind in PLOT_KINDS:
            assert (ARTIFACTS_DIR / "plots" / f"{target}_{kind}.png").stat().st_size > 0


def test_manifest_matches_the_data_file_and_installed_versions(manifest, metrics):
    assert re.fullmatch(r"\d{8}T\d{4}Z-[0-9a-f]{7}", manifest["model_version"])
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", manifest["trained_at"])
    assert manifest["data_file"] == DATA_FILE_NAME
    assert manifest["data_sha256"] == file_sha256(DATA_PATH)
    assert manifest["model_version"].endswith(manifest["data_sha256"][:7])
    assert manifest["seed"] == SEED
    assert manifest["targets"] == list(TARGET_IDS)
    assert manifest["python"] == platform.python_version()
    assert manifest["libraries"] == {name: version(name) for name in MANIFEST_LIBRARIES}
    assert metrics["model_version"] == manifest["model_version"]


def test_bundles_have_the_documented_keys(bundles, manifest, metrics, schema_artifact):
    feature_ids = [entry["id"] for entry in schema_artifact["features"]]
    for target, bundle in bundles.items():
        assert set(bundle) == BUNDLE_KEYS
        assert bundle["target"] == target
        assert bundle["model_type"] == metrics["targets"][target]["selected_model"]
        assert bundle["shap_units"] == SHAP_UNITS[bundle["model_type"]]
        assert bundle["feature_ids"] == feature_ids
        assert bundle["sklearn_version"] == manifest["libraries"]["scikit-learn"]
        width = len(bundle["transformed_to_feature"])
        assert set(bundle["transformed_to_feature"]) == set(feature_ids)
        if bundle["model_type"] == "logistic_regression":
            assert bundle["shap_background"].shape == (metrics["validation"]["n_rows"], width)
        else:
            assert bundle["shap_background"] is None


def test_leakage_guard_holds_for_every_bundle(bundles, schema_artifact):
    assert schema_artifact["excluded_columns"] == list(EXCLUDED_COLUMNS)
    for bundle in bundles.values():
        assert_no_leakage(bundle["feature_ids"])
        preprocessor = bundle["pipeline"].named_steps["preprocess"]
        assert_no_leakage(preprocessor.feature_names_in_)


def test_feature_schema_artifact_matches_the_code(schema_artifact, schema, dataset):
    assert schema_artifact["features"] == schema
    assert schema_artifact["feature_groups"] == list(FEATURE_GROUPS)
    assert schema_artifact["dropped_features"] == list(dataset.dropped)
    quick = schema_artifact["quick_controls"]
    assert len(quick) == len(set(quick)) == QUICK_CONTROL_COUNT
    assert set(quick) <= set(dataset.feature_ids)


def test_samples_and_reference_values_match_the_code(dataset, holdout_rows, reference_values):
    assert read("samples.json") == {"samples": build_samples(dataset, holdout_rows)}
    assert read("reference_values.json") == reference_values


def test_metrics_follow_the_contract(metrics, train_rows, dataset):
    validation = metrics["validation"]
    assert validation == validation | {
        "scheme": "repeated_stratified_kfold",
        "n_splits": N_SPLITS,
        "n_repeats": N_REPEATS,
        "seed": SEED,
        "n_rows": len(train_rows),
        "decision_threshold": DECISION_THRESHOLD,
        "preprocessing_inside_folds": True,
        "excluded_columns": list(EXCLUDED_COLUMNS),
    }
    assert validation["holdout_note"]

    for target, scores in metrics["targets"].items():
        labels = dataset.labels.loc[train_rows, target]
        assert scores["n_positive"] == labels.sum()
        assert scores["n_positive"] + scores["n_negative"] == len(train_rows)
        assert scores["prevalence"] == round(float(labels.mean()), METRIC_DECIMALS)
        assert scores["selected_model"] in MODEL_TYPES
        assert scores["selection_reason"] in (
            "Highest mean ROC-AUC", "Within 0.01 of best; simplest model preferred",
        )
        assert list(scores["candidates"]) == [*MODEL_TYPES, BASELINE]
        for candidate in scores["candidates"].values():
            assert list(candidate) == list(METRICS)
            for stat in candidate.values():
                assert 0 <= stat["mean"] <= 1 and 0 <= stat["std"] <= 1

        importance = scores["global_importance"]
        shares = [item["share"] for item in importance]
        assert len(importance) == GLOBAL_IMPORTANCE_TOP
        assert shares == sorted(shares, reverse=True)
        assert 0 < sum(shares) <= 1
        assert {item["feature"] for item in importance} <= set(dataset.feature_ids)


def test_selected_model_beats_the_baseline(metrics):
    for scores in metrics["targets"].values():
        selected = scores["candidates"][scores["selected_model"]]
        baseline = scores["candidates"][BASELINE]
        assert selected["roc_auc"]["mean"] > baseline["roc_auc"]["mean"] == 0.5
        assert selected["brier"]["mean"] < baseline["brier"]["mean"]


def test_rerunning_cross_validation_reproduces_the_stored_metrics(metrics, schema, train_features, train_labels):
    # The fast candidates only; the full rerun is `python -m ml.train`.
    models = ("logistic_regression", BASELINE)
    rerun = cross_validate(train_features, train_labels["cad"], schema, model_types=models)

    for model in models:
        stored = metrics["targets"]["cad"]["candidates"][model]
        assert stored == {
            name: {key: round(value, METRIC_DECIMALS) for key, value in stat.items()}
            for name, stat in rerun.metrics[model].items()
        }


def test_bundles_predict_the_held_out_samples(bundles, dataset, holdout_rows):
    patients = dataset.features.loc[holdout_rows]
    for bundle in bundles.values():
        probabilities = bundle["pipeline"].predict_proba(patients[bundle["feature_ids"]])[:, 1]
        assert ((probabilities >= 0) & (probabilities <= 1)).all()
