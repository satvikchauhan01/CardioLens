"""T9.1: the training entry point, run once on the real data with a single repeat."""

import json
import re
from dataclasses import replace
from importlib.metadata import version

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient

import ml.train as train_module
from app.main import create_app
from app.settings import Settings
from ml.config import (
    ARTIFACTS_DIR,
    DATA_PATH,
    EXCLUDED_COLUMNS,
    QUICK_CONTROL_COUNT,
    TARGET_IDS,
    feature_id,
)
from ml.dataset import LeakageError, file_sha256
from ml.train import quick_controls, train

PLOT_KINDS = ("roc", "calibration", "confusion")


def read(directory, name: str):
    return json.loads((directory / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    """One real training run with a single repeat of the 5-fold validation."""
    directory = tmp_path_factory.mktemp("artifacts")
    return directory, train(artifacts_dir=directory, n_repeats=1)


# --- quick controls (BR-9) ---------------------------------------------------------------------


def ranking(**shares: float) -> list[dict]:
    return [{"feature": feature, "share": share} for feature, share in shares.items()]


def test_quick_controls_rank_by_the_mean_share_across_targets():
    # Shares are binary fractions, so the means below are exact.
    importance = {
        "cad": ranking(a=0.25, b=0.5, c=0.25),
        "lad": ranking(a=0.625, b=0.125, c=0.25),
        "lcx": ranking(a=0.625, b=0.125, c=0.25),
    }

    # Means: a 0.5, b 0.25, c 0.25. One target's favourite (b for cad) does not win on its own.
    assert quick_controls(importance, ["a", "b", "c"]) == ["a", "b", "c"]
    assert quick_controls(importance, ["c", "b", "a"]) == ["a", "c", "b"]


def test_quick_controls_keep_the_schema_order_between_equal_scores():
    importance = {"cad": ranking(a=0.25, b=0.25, c=0.25, d=0.25)}

    assert quick_controls(importance, ["d", "b", "a", "c"]) == ["d", "b", "a", "c"]


def test_quick_controls_are_limited_to_the_documented_number():
    features = [f"f{index:02d}" for index in range(QUICK_CONTROL_COUNT + 4)]
    # The later a feature is in the schema, the larger its share.
    importance = {"cad": ranking(**{feature: index + 1.0 for index, feature in enumerate(features)})}

    chosen = quick_controls(importance, features)

    assert QUICK_CONTROL_COUNT == 8
    assert chosen == features[::-1][:QUICK_CONTROL_COUNT]


# --- leakage guard (BR-2) ----------------------------------------------------------------------


@pytest.mark.parametrize("column", EXCLUDED_COLUMNS)
def test_training_aborts_before_writing_when_a_label_column_is_an_input(
    monkeypatch, tmp_path, dataset, column
):
    leaky = replace(dataset, features=dataset.features.assign(**{column: dataset.labels["cad"]}))
    monkeypatch.setattr(train_module, "load_dataset", lambda path: leaky)

    with pytest.raises(LeakageError, match=feature_id(column)):
        train(artifacts_dir=tmp_path, n_repeats=1)

    assert list(tmp_path.iterdir()) == []


# --- one real run ------------------------------------------------------------------------------


def test_training_writes_every_artifact(trained):
    directory, _ = trained
    written = {path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file()}

    assert written == {
        "manifest.json", "metrics.json", "feature_schema.json", "samples.json", "reference_values.json",
        *(f"models/{target}.joblib" for target in TARGET_IDS),
        *(f"plots/{target}_{kind}.png" for target in TARGET_IDS for kind in PLOT_KINDS),
    }
    assert all((directory / name).stat().st_size > 0 for name in written)


def test_manifest_describes_the_run(trained):
    directory, manifest = trained

    assert manifest == read(directory, "manifest.json")
    assert re.fullmatch(r"\d{8}T\d{4}Z-[0-9a-f]{7}", manifest["model_version"])
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", manifest["trained_at"])
    assert manifest["data_file"] == DATA_PATH.name
    assert manifest["data_sha256"] == file_sha256(DATA_PATH)
    assert manifest["model_version"].endswith(manifest["data_sha256"][:7])
    assert manifest["libraries"]["scikit-learn"] == version("scikit-learn")
    assert manifest["targets"] == list(TARGET_IDS)


def test_metrics_record_the_validation_that_was_run(trained):
    directory, manifest = trained
    metrics = read(directory, "metrics.json")

    assert metrics["model_version"] == manifest["model_version"]
    assert metrics["validation"]["n_repeats"] == 1
    assert metrics["validation"]["n_splits"] == 5
    assert metrics["validation"]["n_rows"] == 297
    assert metrics["validation"]["excluded_columns"] == list(EXCLUDED_COLUMNS)
    assert list(metrics["targets"]) == list(TARGET_IDS)
    for scores in metrics["targets"].values():
        assert scores["selected_model"] in scores["candidates"]
        assert scores["n_positive"] + scores["n_negative"] == 297


def test_inputs_do_not_depend_on_the_number_of_repeats(trained):
    """The schema, the samples and the reference values come from the data alone."""
    directory, _ = trained
    schema, committed = read(directory, "feature_schema.json"), read(ARTIFACTS_DIR, "feature_schema.json")

    assert schema["features"] == committed["features"]
    assert schema["excluded_columns"] == list(EXCLUDED_COLUMNS)
    assert read(directory, "samples.json") == read(ARTIFACTS_DIR, "samples.json")
    assert read(directory, "reference_values.json") == read(ARTIFACTS_DIR, "reference_values.json")

    feature_ids = [feature["id"] for feature in schema["features"]]
    assert len(schema["quick_controls"]) == len(set(schema["quick_controls"])) == QUICK_CONTROL_COUNT
    assert set(schema["quick_controls"]) <= set(feature_ids)
    assert not set(feature_ids) & {feature_id(column) for column in EXCLUDED_COLUMNS}


def test_final_models_are_reproducible(trained):
    """Where the same model type is selected, a new fit predicts exactly what the stored model does."""
    directory, _ = trained
    samples = pd.DataFrame([sample["features"] for sample in read(directory, "samples.json")["samples"]])
    compared = 0

    for target in TARGET_IDS:
        new = joblib.load(directory / "models" / f"{target}.joblib")
        stored = joblib.load(ARTIFACTS_DIR / "models" / f"{target}.joblib")
        assert new["target"] == target and new["feature_ids"] == stored["feature_ids"]
        if new["model_type"] != stored["model_type"]:
            continue  # one repeat can rank the candidates differently from five
        compared += 1
        assert (
            new["pipeline"].predict_proba(samples)[:, 1].tolist()
            == stored["pipeline"].predict_proba(samples)[:, 1].tolist()
        )

    assert compared >= 1


def test_api_serves_the_newly_trained_artifacts(trained):
    directory, manifest = trained
    client = TestClient(create_app(Settings(allowed_origins=(), artifacts_dir=directory)))

    health = client.get("/api/health")
    assert (health.status_code, health.json()["model_version"]) == (200, manifest["model_version"])
    assert client.get("/api/metrics").json()["validation"]["n_repeats"] == 1
    assert client.get("/static/plots/cad_roc.png").status_code == 200

    for sample in client.get("/api/samples").json()["samples"]:
        response = client.post("/api/predict", json={"features": sample["features"]})
        assert response.status_code == 200
        assert list(response.json()["predictions"]) == list(TARGET_IDS)
